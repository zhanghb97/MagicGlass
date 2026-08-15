export default {
  data: {
    statusText: '等待操作',
  },

  onLoad() {
    console.log('[MagicGlass] index page loaded');
  },

  startMemory() {
    console.log('[MagicGlass] startMemory tapped');
    this.setData({
      statusText: '开始记忆',
    });
  },

  findItem() {
    console.log('[MagicGlass] findItem tapped');
    this.setData({
      statusText: '查找物品',
    });
  },
};

