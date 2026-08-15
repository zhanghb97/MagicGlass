import wx from 'wx';
import { CAPTURE_INTERVAL_MS } from '../../config/config.js';
import { releaseCamera, takePhoto } from '../../services/camera-service.js';
import { analyzePhoto, destroyVisionSession } from '../../services/vision-service.js';
import { saveObservation } from '../../services/memory-service.js';
import { makeObservationId } from '../../utils/time.js';

const OBSERVATIONS_KEY = 'magic-glass.observations';

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
        items.push({
          name,
          place: [observation.scene, observation.placeHint].filter(Boolean).join(' · ') || '位置未知',
        });
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
    isMemoryActive: false,
    memoryButtonText: '开始记忆',
    recentItems: [],
    focusIndex: -1,
    focusableCount: 2,
    activeItemId: '',
    captureInProgress: false,
  },

  onLoad() {
    this.enteredNavigationThisPress = false;
    this.captureTimer = null;
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
  },

  onUnload() {
    this.pageActive = false;
    this.stopCaptureTimer();
    destroyVisionSession();
    releaseCamera();
  },

  refreshItems() {
    const recentItems = readRecentItems();
    this.setData({
      recentItems,
      focusableCount: recentItems.length + 2,
    });
  },

  setFocusIndex(nextIndex) {
    const count = Math.max(2, this.data.focusableCount);
    const focusIndex = Math.max(0, Math.min(count - 1, nextIndex));
    this.setData({
      focusIndex,
      activeItemId: focusIndex >= 2 ? `item-${focusIndex - 2}` : '',
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
      this.setFocusIndex(this.data.focusIndex < 0 ? 0 : this.data.focusIndex + 1);
    } else if (code === 'ArrowUp') {
      this.setFocusIndex(this.data.focusIndex < 0 ? 0 : this.data.focusIndex - 1);
    }
  },

  onKeyUp(event) {
    const code = event && event.code;
    if (code !== 'Enter' && code !== 'ArrowUp' && code !== 'ArrowDown') return;

    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    if (code !== 'Enter') return;
    if (this.enteredNavigationThisPress) {
      this.enteredNavigationThisPress = false;
      return;
    }
    this.activateFocused();
  },

  activateFocused() {
    const index = this.data.focusIndex;
    if (index === 0) {
      this.toggleMemory();
    } else if (index === 1) {
      this.findItem();
    } else if (index >= 2) {
      this.activateItem(index - 2);
    }
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
    if (!this.pageActive || !this.data.isMemoryActive || this.data.captureInProgress) return;
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
    this.setData({ statusText: '查找物品' });
  },

  selectItem(event) {
    const attributes = (event && event.currentTarget && event.currentTarget.attributes) || {};
    const index = Number(attributes['data-index']);
    if (Number.isInteger(index)) {
      this.setFocusIndex(index + 2);
      this.activateItem(index);
    }
  },

  activateItem(index) {
    const item = this.data.recentItems[index];
    if (!item) return;
    this.setData({
      statusText: `已选择：${item.name}`,
      activeItemId: `item-${index}`,
    });
  },
};
