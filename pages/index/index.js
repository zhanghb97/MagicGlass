import wx from 'wx';
import { CAPTURE_INTERVAL_MS } from '../../config/config.js';
import { releaseCamera, takePhoto } from '../../services/camera-service.js';
import { analyzePhoto, destroyVisionSession } from '../../services/vision-service.js';
import { loadObservations, saveObservation } from '../../services/memory-service.js';
import { buildSearchResult, findLastSeen } from '../../services/search-service.js';
import { recognizeOnce, stopRecognition } from '../../services/speech-service.js';
import { makeObservationId, relativeTime } from '../../utils/time.js';

const OBSERVATIONS_KEY = 'magic-glass.observations';

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
    statusText: '等待操作',
    statusDetail: '',
    statusMeta: '',
    isMemoryActive: false,
    memoryButtonText: '开始记忆',
    recentItems: [],
    focusIndex: -1,
    navigationLevel: 'menu',
    listFocusIndex: 0,
    listScrollTop: 0,
    captureInProgress: false,
    isListening: false,
  },

  onLoad() {
    this.enteredNavigationThisPress = false;
    this.captureTimer = null;
    this.recognition = null;
    this.pageActive = true;
    this.refreshItems();
  },

  onShow() {
    this.pageActive = true;
    this.refreshItems();
    if (this.data.isMemoryActive) this.startCaptureTimer();
  },

  onHide() {
    this.pageActive = false;
    this.stopCaptureTimer();
    this.stopVoiceSearch();
  },

  onUnload() {
    this.pageActive = false;
    this.stopCaptureTimer();
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
    if (code === 'Enter' && this.data.focusIndex < 0) {
      this.enteredNavigationThisPress = true;
      this.setFocusIndex(0);
      this.setData({ statusText: '已进入导航' });
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
    if (this.data.recentItems.length === 0) {
      this.setData({ statusText: '暂无物品记录' });
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
      statusText: '已返回一级菜单',
      statusDetail: '',
      statusMeta: '',
    });
  },

  toggleMemory() {
    const isMemoryActive = !this.data.isMemoryActive;
    this.setData({
      isMemoryActive,
      memoryButtonText: isMemoryActive ? '停止记忆' : '开始记忆',
      statusText: isMemoryActive ? '开始记忆' : '停止记忆',
    });
    if (isMemoryActive) {
      this.captureAndRemember();
      this.startCaptureTimer();
    } else {
      this.stopCaptureTimer();
    }
  },

  startCaptureTimer() {
    if (!this.pageActive || this.captureTimer) return;
    this.captureTimer = setInterval(() => {
      this.captureAndRemember();
    }, CAPTURE_INTERVAL_MS);
  },

  stopCaptureTimer() {
    if (this.captureTimer) clearInterval(this.captureTimer);
    this.captureTimer = null;
  },

  async captureAndRemember() {
    if (!this.pageActive || !this.data.isMemoryActive || this.data.captureInProgress || this.data.isListening) return;
    this.setData({
      captureInProgress: true,
      statusText: '正在拍照',
    });

    try {
      const photo = await takePhoto();
      if (!this.pageActive || !this.data.isMemoryActive) return;
      this.setData({ statusText: '正在识别物品' });

      const visual = await analyzePhoto(photo);
      if (!this.pageActive || !this.data.isMemoryActive) return;

      saveObservation({
        id: makeObservationId(),
        timestamp: Date.now(),
        scene: visual.scene,
        placeHint: visual.placeHint,
        summary: visual.summary,
        location: null,
        items: visual.items,
      });
      this.refreshItems();
      this.setData({
        statusText: visual.items.length > 0
          ? `记录到 ${visual.items.length} 个物品`
          : '没有识别到物品',
      });
    } catch (error) {
      console.error('[MagicGlass] capture failed', error);
      this.setData({
        statusText: error && error.message ? error.message : '观察失败，30秒后重试',
      });
    } finally {
      this.setData({ captureInProgress: false });
    }
  },

  findItem() {
    if (this.data.isListening) return;
    if (this.data.captureInProgress) {
      this.setData({ statusText: '正在记录物品，请稍后查找' });
      return;
    }

    try {
      this.recognition = recognizeOnce({
        onStart: () => {
          this.setData({
            isListening: true,
            statusText: '请说出物品名称',
            statusDetail: '',
            statusMeta: '',
          });
        },
        onResult: (transcript) => {
          this.showItemLocation(transcript);
        },
        onError: (message) => {
          this.setData({
            isListening: false,
            statusText: message ? `语音识别失败：${message}` : '语音识别失败',
            statusDetail: '',
            statusMeta: '',
          });
        },
        onEnd: () => {
          this.recognition = null;
          this.setData({ isListening: false });
        },
      });
    } catch (error) {
      this.recognition = null;
      this.setData({
        isListening: false,
        statusText: error && error.message ? error.message : '语音识别暂时不可用',
        statusDetail: '',
        statusMeta: '',
      });
    }
  },

  showItemLocation(transcript) {
    const query = typeof transcript === 'string' ? transcript.trim() : '';
    if (!query) {
      this.setData({
        statusText: '没有听清物品名称',
        statusDetail: '',
        statusMeta: '',
      });
      return;
    }

    const match = findLastSeen(loadObservations(), query);
    const result = buildSearchResult(match, query);
    if (!result.found) {
      this.setData({
        statusText: `没有${result.name}的位置记录`,
        statusDetail: '',
        statusMeta: '',
      });
      return;
    }

    this.showItemDetails(makeDisplayItem(match.observation, match.item));
  },

  stopVoiceSearch() {
    stopRecognition(this.recognition);
    this.recognition = null;
    if (this.data.isListening) this.setData({ isListening: false });
  },

  selectItem(event) {
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
