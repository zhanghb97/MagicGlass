import wx from 'wx';
import {
  CAPTURE_INTERVAL_MS,
  MOTION_SETTLE_CAPTURE_DELAY_MS,
  UI_IDLE_TIMEOUT_MS,
} from '../../config/config.js';
import { releaseCamera, takePhoto } from '../../services/camera-service.js';
import { analyzePhoto, destroyVisionSession } from '../../services/vision-service.js';
import { loadObservations, saveObservation } from '../../services/memory-service.js';
import { buildSearchResult, findLastSeen } from '../../services/search-service.js';
import { recognizeOnce, stopRecognition } from '../../services/speech-service.js';
import { updateCapturePolicy } from '../../services/capture-policy.js';
import { makeObservationId, relativeTime } from '../../utils/time.js';

const OBSERVATIONS_KEY = 'magic-glass.observations';
const DEFAULT_DISPLAY = {
  statusText: '魔镜',
  statusDetail: '在无感知负担下，让用户永远找到东西。',
  statusMeta: '',
};

function makeDisplayItem(observation, item) {
  return {
    name: typeof item.name === 'string' ? item.name.trim() : '',
    place: [observation.scene, observation.placeHint].filter(Boolean).join(' · ') || '位置未知',
    relativeLocation: item.relativeLocation || '没有具体位置描述',
    description: item.description || '',
    timestamp: observation.timestamp,
  };
}

function readRecentItems() {
  try {
    const observations = wx.getStorageSync(OBSERVATIONS_KEY);
    if (!Array.isArray(observations)) return [];

    const names = new Set();
    const items = [];
    const newestFirst = [...observations].sort(
      (left, right) => Number(right.timestamp) - Number(left.timestamp)
    );

    for (const observation of newestFirst) {
      for (const item of observation.items || []) {
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (!name || names.has(name)) continue;
        names.add(name);
        items.push(makeDisplayItem(observation, item));
        if (items.length >= 6) return items;
      }
    }
    return items;
  } catch (error) {
    console.error('[MagicGlass] load recent items failed', error);
    return [];
  }
}

export default {
  data: {
    ...DEFAULT_DISPLAY,
    isMemoryActive: false,
    memoryButtonText: '开始记忆',
    recentItems: [],
    controlsEnabled: true,
    focusIndex: -1,
    navigationLevel: 'menu',
    listFocusIndex: 0,
    listScrollTop: 0,
    captureInProgress: false,
    isListening: false,
    recognitionStatusText: '等待识别',
    isRecognitionActive: false,
    screenFading: false,
    screenSleeping: false,
  },

  onLoad() {
    this.enteredNavigationThisPress = false;
    this.captureTimer = null;
    this.nextCaptureDelayMs = CAPTURE_INTERVAL_MS;
    this.lastSceneKey = '';
    this.samePlaceCount = 0;
    this.orientationWasUnstable = false;
    this.captureAfterMovement = false;
    this.sleepTimer = null;
    this.screenFadeTimer = null;
    this.wakeSuppressionTimer = null;
    this.suppressNextActivation = false;
    this.wakeKeyCode = null;
    this.recognition = null;
    this.pageActive = true;
    if (typeof this.enableWorldAwareness === 'function') {
      this.enableWorldAwareness();
    }
    this.refreshItems();
  },

  onShow() {
    this.pageActive = true;
    this.refreshItems();
    if (this.data.isMemoryActive) {
      this.startCaptureTimer();
      this.resetSleepTimer();
    }
  },

  onHide() {
    this.pageActive = false;
    this.stopCaptureTimer();
    this.clearSleepTimer();
    this.clearScreenFadeTimer();
    this.clearWakeSuppression();
    if (this.data.screenSleeping || this.data.screenFading) {
      this.setData({
        screenSleeping: false,
        screenFading: false,
        controlsEnabled: true,
      });
    }
    this.stopVoiceSearch();
  },

  onUnload() {
    this.pageActive = false;
    this.stopCaptureTimer();
    this.clearSleepTimer();
    this.clearScreenFadeTimer();
    this.clearWakeSuppression();
    this.stopVoiceSearch();
    destroyVisionSession();
    releaseCamera();
  },

  refreshItems() {
    const recentItems = readRecentItems();
    const update = { recentItems };
    if (recentItems.length === 0 && this.data.navigationLevel === 'list') {
      update.navigationLevel = 'menu';
      update.focusIndex = 2;
      update.listFocusIndex = 0;
      update.listScrollTop = 0;
    } else if (this.data.listFocusIndex >= recentItems.length && recentItems.length > 0) {
      update.listFocusIndex = recentItems.length - 1;
      update.listScrollTop = Math.max(0, (recentItems.length - 2) * 40);
    }
    this.setData(update);
  },

  setFocusIndex(nextIndex) {
    this.setData({ focusIndex: Math.max(0, Math.min(2, nextIndex)) });
  },

  itemDetailData(item) {
    return {
      statusText: item.name,
      statusDetail: `${item.place} · ${item.relativeLocation}`,
      statusMeta: `最后看到 ${relativeTime(item.timestamp)}${item.description ? ` · ${item.description}` : ''}`,
    };
  },

  showItemDetails(item) {
    if (!item) return;
    this.setData(this.itemDetailData(item));
  },

  showDefaultDisplay() {
    this.setData(DEFAULT_DISPLAY);
  },

  setListFocusIndex(nextIndex) {
    const lastIndex = this.data.recentItems.length - 1;
    if (lastIndex < 0) return;
    const listFocusIndex = Math.max(0, Math.min(lastIndex, nextIndex));
    const item = this.data.recentItems[listFocusIndex];
    this.setData({
      listFocusIndex,
      listScrollTop: Math.max(0, (listFocusIndex - 1) * 40),
      ...this.itemDetailData(item),
    });
  },

  onKeyDown(event) {
    const code = event && event.code;
    if (this.data.screenSleeping || this.data.screenFading) {
      if (code === 'Enter' || code === 'GlobalHook') {
        this.wakeKeyCode = code;
        if (this.data.screenFading) {
          this.clearScreenFadeTimer();
          this.enterScreenSleep();
        }
      }
      return;
    }
    this.noteUserActivity();

    if (code === 'Enter' && this.data.focusIndex < 0) {
      this.enteredNavigationThisPress = true;
      this.setFocusIndex(0);
      return;
    }

    if (code === 'ArrowDown') {
      if (this.data.navigationLevel === 'list') {
        this.setListFocusIndex(this.data.listFocusIndex + 1);
      } else {
        this.setFocusIndex(this.data.focusIndex < 0 ? 0 : this.data.focusIndex + 1);
      }
    } else if (code === 'ArrowUp') {
      if (this.data.navigationLevel === 'list') {
        this.setListFocusIndex(this.data.listFocusIndex - 1);
      } else {
        this.setFocusIndex(this.data.focusIndex < 0 ? 0 : this.data.focusIndex - 1);
      }
    }
  },

  onKeyUp(event) {
    const code = event && event.code;
    if (this.wakeKeyCode === code) {
      this.wakeKeyCode = null;
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      this.wakeScreen();
      return;
    }
    if ((this.data.screenSleeping || this.data.screenFading)
      && (code === 'Enter' || code === 'GlobalHook')) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      this.wakeScreen();
      return;
    }
    if ((this.data.screenSleeping || this.data.screenFading)
      && (code === 'ArrowUp' || code === 'ArrowDown')) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      return;
    }

    if (code === 'Backspace') {
      if (this.data.navigationLevel === 'list') {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        this.exitItemList();
      }
      return;
    }

    if (code !== 'Enter' && code !== 'ArrowUp' && code !== 'ArrowDown') return;

    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    if (code !== 'Enter') return;
    if (this.enteredNavigationThisPress) {
      this.enteredNavigationThisPress = false;
      return;
    }
    if (this.data.navigationLevel === 'list') {
      this.activateItem(this.data.listFocusIndex);
    } else {
      this.activateMenuItem();
    }
  },

  activateMenuItem() {
    const index = this.data.focusIndex;
    if (index === 0) {
      this.toggleMemory();
    } else if (index === 1) {
      this.findItem();
    } else if (index === 2) {
      this.enterItemList();
    }
  },

  enterItemList() {
    if (this.consumeWakeActivation()) return;
    if (this.data.recentItems.length === 0) {
      return;
    }
    const listFocusIndex = Math.min(
      this.data.listFocusIndex,
      this.data.recentItems.length - 1
    );
    const item = this.data.recentItems[listFocusIndex];
    this.setData({
      navigationLevel: 'list',
      listFocusIndex,
      listScrollTop: Math.max(0, (listFocusIndex - 1) * 40),
      ...this.itemDetailData(item),
    });
  },

  exitItemList() {
    this.setData({
      navigationLevel: 'menu',
      focusIndex: 2,
      ...DEFAULT_DISPLAY,
    });
  },

  toggleMemory() {
    if (this.consumeWakeActivation()) return;
    this.showDefaultDisplay();
    const isMemoryActive = !this.data.isMemoryActive;
    this.setData({
      isMemoryActive,
      memoryButtonText: isMemoryActive ? '停止记忆' : '开始记忆',
    });
    if (isMemoryActive) {
      this.captureAndRemember();
      this.startCaptureTimer();
      this.resetSleepTimer();
    } else {
      this.stopCaptureTimer();
      this.captureAfterMovement = false;
      this.orientationWasUnstable = false;
      this.clearSleepTimer();
      this.clearScreenFadeTimer();
      if (this.data.screenSleeping || this.data.screenFading) {
        this.setData({ screenSleeping: false, screenFading: false });
      }
    }
  },

  clearSleepTimer() {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = null;
  },

  clearScreenFadeTimer() {
    if (this.screenFadeTimer) clearTimeout(this.screenFadeTimer);
    this.screenFadeTimer = null;
  },

  enterScreenSleep() {
    this.enteredNavigationThisPress = false;
    this.setData({
      screenFading: false,
      screenSleeping: true,
      controlsEnabled: false,
      navigationLevel: 'menu',
      focusIndex: -1,
      listFocusIndex: 0,
      listScrollTop: 0,
      ...DEFAULT_DISPLAY,
    });
  },

  resetSleepTimer() {
    this.clearSleepTimer();
    if (!this.pageActive || !this.data.isMemoryActive
      || this.data.screenSleeping || this.data.screenFading) return;
    this.sleepTimer = setTimeout(() => {
      this.sleepTimer = null;
      if (this.pageActive && this.data.isMemoryActive) {
        this.setData({ screenFading: true });
        this.screenFadeTimer = setTimeout(() => {
          this.screenFadeTimer = null;
          if (this.pageActive && this.data.isMemoryActive) {
            this.enterScreenSleep();
          }
        }, 1200);
      }
    }, UI_IDLE_TIMEOUT_MS);
  },

  noteUserActivity() {
    if (this.data.isMemoryActive && !this.data.screenSleeping && !this.data.screenFading) {
      this.resetSleepTimer();
    }
  },

  wakeScreen() {
    const wasDormant = this.data.screenSleeping || this.data.screenFading;
    this.clearSleepTimer();
    this.clearScreenFadeTimer();
    if (wasDormant) {
      this.setData({
        screenSleeping: false,
        screenFading: false,
        controlsEnabled: true,
        listFocusIndex: 0,
        listScrollTop: 0,
      });
      this.armWakeSuppression();
    }
    if (this.pageActive && this.data.isMemoryActive) this.resetSleepTimer();
  },

  armWakeSuppression() {
    this.clearWakeSuppression();
    this.suppressNextActivation = true;
    this.wakeSuppressionTimer = setTimeout(() => {
      this.wakeSuppressionTimer = null;
      this.suppressNextActivation = false;
    }, 400);
  },

  clearWakeSuppression() {
    if (this.wakeSuppressionTimer) clearTimeout(this.wakeSuppressionTimer);
    this.wakeSuppressionTimer = null;
    this.suppressNextActivation = false;
  },

  consumeWakeActivation() {
    if (!this.suppressNextActivation) return false;
    this.clearWakeSuppression();
    this.noteUserActivity();
    return true;
  },

  startCaptureTimer() {
    if (!this.pageActive || this.captureTimer) return;
    this.captureTimer = setTimeout(() => {
      this.captureTimer = null;
      this.captureAndRemember();
    }, this.nextCaptureDelayMs || CAPTURE_INTERVAL_MS);
  },

  scheduleCapture(delayMs) {
    this.stopCaptureTimer();
    if (!this.pageActive || !this.data.isMemoryActive) return;
    this.nextCaptureDelayMs = Math.max(1000, Number(delayMs) || CAPTURE_INTERVAL_MS);
    this.startCaptureTimer();
  },

  onOrientationStabilityChange(event) {
    if (!this.data.isMemoryActive) return;
    const stable = !!(event && event.stable);
    if (!stable) {
      this.orientationWasUnstable = true;
      return;
    }
    if (!this.orientationWasUnstable) return;
    this.orientationWasUnstable = false;
    if (this.data.captureInProgress || this.data.isListening) {
      this.captureAfterMovement = true;
      return;
    }
    this.scheduleCapture(MOTION_SETTLE_CAPTURE_DELAY_MS);
  },

  stopCaptureTimer() {
    if (this.captureTimer) clearTimeout(this.captureTimer);
    this.captureTimer = null;
  },

  async captureAndRemember() {
    if (!this.pageActive || !this.data.isMemoryActive) return;
    if (this.data.captureInProgress || this.data.isListening) {
      this.scheduleCapture(5000);
      return;
    }
    this.setData({
      captureInProgress: true,
      isRecognitionActive: true,
      recognitionStatusText: '正在拍照',
    });

    try {
      const photo = await takePhoto();
      if (!this.pageActive) return;
      this.setData({
        recognitionStatusText: '正在识别',
      });

      const visual = await analyzePhoto(photo);
      if (!this.pageActive) return;

      const policy = updateCapturePolicy(this.lastSceneKey, this.samePlaceCount, visual);
      this.lastSceneKey = policy.sceneKey;
      this.samePlaceCount = policy.samePlaceCount;
      this.nextCaptureDelayMs = policy.nextDelayMs;

      if (visual.items.length > 0) {
        const observation = {
          id: makeObservationId(),
          timestamp: Date.now(),
          scene: visual.scene,
          placeHint: visual.placeHint,
          summary: visual.summary,
          location: null,
          items: visual.items,
        };
        saveObservation(observation);
        this.refreshItems();
      }
    } catch (error) {
      console.error('[MagicGlass] capture failed', error);
    } finally {
      this.setData({
        captureInProgress: false,
        isRecognitionActive: this.data.isListening,
        recognitionStatusText: this.data.isListening ? '正在聆听' : '等待识别',
      });
      if (this.data.isMemoryActive) {
        const delay = this.captureAfterMovement
          ? MOTION_SETTLE_CAPTURE_DELAY_MS
          : this.nextCaptureDelayMs;
        this.captureAfterMovement = false;
        this.scheduleCapture(delay);
      }
    }
  },

  findItem() {
    if (this.consumeWakeActivation()) return;
    if (this.data.isListening) return;
    if (this.data.captureInProgress) {
      return;
    }
    this.showDefaultDisplay();

    try {
      this.recognition = recognizeOnce({
        onStart: () => {
          this.setData({
            isListening: true,
            isRecognitionActive: true,
            recognitionStatusText: '正在聆听',
          });
        },
        onResult: (transcript) => {
          this.showItemLocation(transcript);
        },
        onError: (message) => {
          this.setData({
            isListening: false,
            isRecognitionActive: false,
            recognitionStatusText: '等待识别',
          });
        },
        onEnd: () => {
          this.recognition = null;
          this.setData({
            isListening: false,
            isRecognitionActive: false,
            recognitionStatusText: '等待识别',
          });
        },
      });
    } catch (error) {
      this.recognition = null;
      this.setData({
        isListening: false,
        isRecognitionActive: false,
        recognitionStatusText: '等待识别',
      });
    }
  },

  showItemLocation(transcript) {
    const query = typeof transcript === 'string' ? transcript.trim() : '';
    if (!query) {
      return;
    }

    const match = findLastSeen(loadObservations(), query);
    const result = buildSearchResult(match, query);
    if (!result.found) {
      return;
    }

    this.showItemDetails(makeDisplayItem(match.observation, match.item));
  },

  stopVoiceSearch() {
    stopRecognition(this.recognition);
    this.recognition = null;
    if (this.data.isListening || this.data.isRecognitionActive) {
      this.setData({
        isListening: false,
        isRecognitionActive: this.data.captureInProgress,
        recognitionStatusText: this.data.captureInProgress ? '正在识别' : '等待识别',
      });
    }
  },

  selectItem(event) {
    if (this.consumeWakeActivation()) return;
    const attributes = (event && event.currentTarget && event.currentTarget.attributes) || {};
    const index = Number(attributes['data-index']);
    if (Number.isInteger(index)) {
      this.setData({ navigationLevel: 'list' });
      this.setListFocusIndex(index);
      this.activateItem(index);
    }
  },

  activateItem(index) {
    const item = this.data.recentItems[index];
    this.showItemDetails(item);
  },
};
