<script type="application/json" def>
{
  "navigationBarTitleText": "魔镜"
}
</script>

<script setup>
export default {
  data: {
    statusText: '等待操作',
  },

  startMemory() {
    this.setData({
      statusText: '开始记忆',
    });
  },

  findItem() {
    this.setData({
      statusText: '查找物品',
    });
  },
};
</script>

<page>
  <view class="container">
    <view class="status-card">
      <text class="status-label">当前状态</text>
      <text class="status-text">{{statusText}}</text>
    </view>

    <view class="button-list" role="navigation">
      <button class="action-button" bindtap="startMemory">开始记忆</button>
      <button class="action-button" bindtap="findItem">查找物品</button>
    </view>
  </view>
</page>

<style>
.container {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  padding: 32px;
  box-sizing: border-box;
  background: #07100d;
  color: #ffffff;
}

.status-card {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 16px;
  background: #13251d;
  border: 1px solid #315342;
}

.status-label {
  font-size: 14px;
  color: #9db5a9;
}

.status-text {
  font-size: 28px;
  font-weight: 700;
  color: #65f2a1;
}

.button-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-button {
  width: 100%;
  height: 56px;
  border-radius: 12px;
  border: 2px solid #ffffff;
  background: #ffffff;
  color: #07100d;
  font-size: 18px;
  font-weight: 700;
}
</style>
