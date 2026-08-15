import wx from 'wx';

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
  },

  onLoad() {
    this.enteredNavigationThisPress = false;
    this.refreshItems();
  },

  onShow() {
    this.refreshItems();
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

