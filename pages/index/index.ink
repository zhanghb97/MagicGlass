<script type="application/json" def>
{
  "navigationBarTitleText": "魔镜"
}
</script>

<script setup>
import { CAPTURE_INTERVAL_MS, DEBUG, MOCK_MODE } from '../../config/config.js';
import { cameraAvailable, releaseCamera, takePhoto } from '../../services/camera-service.js';
import { analyzePhoto, destroyVisionSession, visionAvailable } from '../../services/vision-service.js';
import { clearObservations, loadObservations, loadSettings, replaceObservations, saveObservation, saveSettings } from '../../services/memory-service.js';
import { buildSearchResult, findLastSeen, recentItems } from '../../services/search-service.js';
import { asrAvailable, recognizeOnce, speak, stopRecognition, stopSpeaking, ttsAvailable } from '../../services/speech-service.js';
import { makeMockObservations } from '../../services/mock-service.js';
import { makeObservationId, relativeTime } from '../../utils/time.js';

function errorText(error, fallback) {
  return error && (error.message || error.errMsg) ? error.message || error.errMsg : fallback;
}

export default {
  data: {
    memoryEnabled: false,
    pipelineState: 'idle',
    statusText: '已暂停',
    statusMessage: '准备就绪',
    observations: [],
    recent: [],
    observationCount: 0,
    itemCount: 0,
    query: '',
    listening: false,
    result: null,
    clearPending: false,
    debug: DEBUG,
    mockMode: MOCK_MODE,
    capabilities: '检测中…',
    captureCount: 0,
    lastInferenceMs: 0,
  },

  async onLoad() {
    this.captureTimer = null;
    this.recognition = null;
    this.pageActive = true;
    this.clearConfirmTimer = null;
    const settings = loadSettings();
    this.setData({ memoryEnabled: !!settings.memoryEnabled });
    this.refreshMemory(loadObservations());
    await this.refreshCapabilities();
  },

  onShow() {
    this.pageActive = true;
    if (this.data.memoryEnabled) this.startTimer();
  },

  onHide() {
    this.pageActive = false;
    this.stopRuntime();
  },

  onUnload() {
    this.pageActive = false;
    this.stopRuntime();
    destroyVisionSession();
    releaseCamera();
    if (this.clearConfirmTimer) clearTimeout(this.clearConfirmTimer);
  },

  async refreshCapabilities() {
    const camera = cameraAvailable();
    const llm = await visionAvailable();
    this.setData({
      capabilities: `Camera ${camera ? 'Ready' : 'N/A'} · LLM ${llm ? 'Ready' : 'N/A'} · ASR ${asrAvailable() ? 'Ready' : 'N/A'} · TTS ${ttsAvailable() ? 'Ready' : 'N/A'}`,
    });
  },

  refreshMemory(observations) {
    const recent = recentItems(observations).map((item) => ({ ...item, timeText: relativeTime(item.timestamp) }));
    const itemCount = observations.reduce((sum, observation) => sum + (observation.items || []).length, 0);
    this.setData({ observations, recent, observationCount: observations.length, itemCount });
  },

  toggleMemory() {
    const enabled = !this.data.memoryEnabled;
    saveSettings({ ...loadSettings(), memoryEnabled: enabled });
    this.setData({ memoryEnabled: enabled, statusText: enabled ? '记忆中' : '已暂停', statusMessage: enabled ? '下一次观察约 30 秒后' : '周期观察已停止' });
    if (enabled) this.startTimer(); else this.stopTimer();
  },

  startTimer() {
    if (!this.pageActive || !this.data.memoryEnabled || this.captureTimer) return;
    this.setData({ statusText: '记忆中' });
    this.captureTimer = setInterval(() => {
      if (this.pageActive && this.data.memoryEnabled && this.data.pipelineState === 'idle') this.observeNow('timer');
    }, CAPTURE_INTERVAL_MS);
  },

  stopTimer() {
    if (this.captureTimer) clearInterval(this.captureTimer);
    this.captureTimer = null;
  },

  stopRuntime() {
    this.stopTimer();
    stopRecognition(this.recognition);
    this.recognition = null;
    stopSpeaking();
    this.setData({ listening: false });
  },

  async observeNow(source = 'manual') {
    if (this.data.pipelineState !== 'idle') {
      this.setData({ statusMessage: '上一轮观察仍在进行，本次已跳过' });
      return;
    }
    const startedAt = Date.now();
    this.setData({ pipelineState: 'capturing', statusMessage: '正在观察…', result: null });
    try {
      const photo = await takePhoto();
      if (!this.pageActive) return;
      this.setData({ pipelineState: 'analyzing', statusMessage: '正在理解场景…' });
      const visual = await analyzePhoto(photo);
      if (!this.pageActive) return;
      const observation = {
        id: makeObservationId(), timestamp: Date.now(), scene: visual.scene, placeHint: visual.placeHint,
        summary: visual.summary, location: null, items: visual.items,
      };
      const observations = saveObservation(observation);
      this.refreshMemory(observations);
      this.setData({
        captureCount: this.data.captureCount + 1,
        lastInferenceMs: Date.now() - startedAt,
        statusMessage: visual.items.length ? `记住了 ${visual.items.length} 个物品` : '本次没有发现值得记录的物品',
      });
    } catch (error) {
      console.error('[MagicGlass] observation failed', error);
      this.setData({ statusMessage: errorText(error, source === 'timer' ? '周期观察失败，稍后重试' : '观察失败，请重试') });
    } finally {
      this.setData({ pipelineState: 'idle' });
    }
  },

  onQueryInput(event) {
    this.setData({ query: event.currentTarget.value || '' });
  },

  search() {
    const query = this.data.query;
    if (!String(query || '').trim()) {
      this.setData({ statusMessage: '请说出或输入要找的物品' });
      return;
    }
    const result = buildSearchResult(findLastSeen(this.data.observations, query), query);
    if (result.timestamp) result.timeText = relativeTime(result.timestamp);
    this.setData({ result, statusMessage: result.found ? `找到了${result.name}` : `没有${result.name}的记录` });
    speak(result.speech);
  },

  searchRecent(event) {
    const target = event && event.currentTarget;
    const attributes = (target && target.attributes) || {};
    const dataset = (target && target.dataset) || {};
    const name = attributes['data-name'] || dataset.name || '';
    if (!name) {
      this.setData({ statusMessage: '没有读取到物品名称，请重试' });
      return;
    }
    this.setData({ query: name });
    setTimeout(() => this.search(), 0);
  },

  startVoiceSearch() {
    if (this.data.listening) return;
    try {
      this.recognition = recognizeOnce({
        onStart: () => this.setData({ listening: true, statusMessage: '请说：我的钥匙在哪里？' }),
        onResult: (transcript) => {
          this.setData({ query: transcript || '' });
          setTimeout(() => this.search(), 0);
        },
        onError: (message) => this.setData({ listening: false, statusMessage: String(message || '语音识别失败') }),
        onEnd: () => {
          this.recognition = null;
          this.setData({ listening: false });
        },
      });
    } catch (error) {
      this.setData({ statusMessage: errorText(error, '语音识别暂时不可用') });
    }
  },

  loadDemo() {
    const observations = replaceObservations(makeMockObservations(), true);
    this.refreshMemory(observations);
    this.setData({ mockMode: true, statusMessage: '正在预览隔离演示记忆；真实记忆未改变' });
  },

  requestClear() {
    if (!this.data.clearPending) {
      this.setData({ clearPending: true, statusMessage: '请再次点击确认清空全部视觉记忆' });
      this.clearConfirmTimer = setTimeout(() => this.setData({ clearPending: false }), 5000);
      return;
    }
    clearObservations();
    this.refreshMemory([]);
    this.setData({ clearPending: false, result: null, statusMessage: '视觉记忆已清空' });
  },
};
</script>

<page>
  <view class="shell">
    <view class="hero">
      <text class="brand">魔镜</text>
      <text class="tagline">让你永远找到东西</text>
      <view class="state-row">
        <view class="state-dot {{memoryEnabled ? 'active' : ''}}"></view>
        <text class="state-text">{{statusText}}</text>
      </view>
      <text class="status-message">{{statusMessage}}</text>
    </view>

    <view class="stats">
      <view><text class="stat-number">{{observationCount}}</text><text class="stat-label">次观察</text></view>
      <view class="divider"></view>
      <view><text class="stat-number">{{itemCount}}</text><text class="stat-label">个物品</text></view>
    </view>

    <view class="actions" role="navigation">
      <button class="button primary" tabindex="0" bindtap="toggleMemory">{{memoryEnabled ? '停止记忆' : '开始记忆'}}</button>
      <button class="button secondary" tabindex="1" bindtap="observeNow" disabled="{{pipelineState !== 'idle'}}">{{pipelineState === 'idle' ? '立即观察' : '观察中…'}}</button>
    </view>

    <view class="search-card">
      <text class="section-title">找东西</text>
      <view class="search-row" role="navigation">
        <input class="query" tabindex="2" value="{{query}}" placeholder="钥匙在哪里？" bindinput="onQueryInput" bindconfirm="search" />
        <button class="voice" tabindex="3" bindtap="startVoiceSearch">{{listening ? '聆听中' : '语音'}}</button>
      </view>
      <view role="navigation">
        <button class="search-button" tabindex="4" bindtap="search">查找最近位置</button>
      </view>
    </view>

    <view class="result-card found-{{result && result.found}}" ink:if="{{result}}">
      <text class="result-kicker">{{result.found ? '最后看到' : '没有记录'}}</text>
      <text class="result-name">{{result.name}}</text>
      <text class="result-time" ink:if="{{result.found}}">{{result.timeText}}</text>
      <text class="result-location" ink:if="{{result.found}}">{{result.location}}</text>
      <text class="result-detail" ink:if="{{result.found}}">{{result.detail}}</text>
      <text class="result-tip">{{result.found ? result.tip : result.speech}}</text>
    </view>

    <view class="recent-section" role="navigation">
      <text class="section-title">最近看到</text>
      <text class="empty" ink:if="{{recent.length === 0}}">还没有视觉记忆，试试“立即观察”</text>
      <button class="recent-item" ink:for="{{recent}}" ink:key="name" tabindex="{{10 + index}}" data-name="{{item.name}}" bindtap="searchRecent">
        <view><text class="item-name">{{item.name}}</text><text class="item-place">{{item.scene}} · {{item.placeHint}}</text></view>
        <text class="item-time">{{item.timeText}}</text>
      </button>
    </view>

    <view class="debug-card" ink:if="{{debug}}">
      <text class="debug-title">DEBUG</text>
      <text class="debug-line">{{capabilities}}</text>
      <text class="debug-line">State {{pipelineState}} · Captures {{captureCount}} · Last {{lastInferenceMs}}ms</text>
      <view class="debug-actions" role="navigation">
        <button class="tiny-button" tabindex="20" bindtap="loadDemo">载入隔离演示数据</button>
        <button class="tiny-button danger" tabindex="21" bindtap="requestClear">{{clearPending ? '再次点击确认清空' : '清空真实记忆'}}</button>
      </view>
    </view>
  </view>
</page>

<style>
.shell { min-height: 100%; padding: 24px; box-sizing: border-box; background: radial-gradient(circle at 50% 0%, #153c2c 0%, #07100d 55%); color: #f4fff9; display: flex; flex-direction: column; gap: 18px; }
.hero { display: flex; flex-direction: column; align-items: center; gap: 7px; padding-top: 10px; }
.brand { font-size: 34px; font-weight: 700; letter-spacing: 6px; }
.tagline { font-size: 14px; color: #a9bcb3; }
.state-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.state-dot { width: 9px; height: 9px; border-radius: 50%; background: #66736d; box-shadow: 0 0 0 4px rgba(102,115,109,.15); }
.state-dot.active { background: #56f39a; box-shadow: 0 0 14px rgba(86,243,154,.8); }
.state-text { font-size: 18px; font-weight: 600; }
.status-message { min-height: 18px; font-size: 12px; color: #8fa59a; text-align: center; }
.stats { display: flex; justify-content: center; align-items: center; gap: 28px; padding: 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; background: rgba(255,255,255,.04); }
.stats view { display: flex; align-items: baseline; gap: 5px; }
.stat-number { font-size: 24px; font-weight: 700; color: #68f3a4; }
.stat-label { font-size: 12px; color: #9caf9f; }
.divider { width: 1px; height: 28px; background: rgba(255,255,255,.12); }
.actions, .search-row, .debug-actions { display: flex; gap: 10px; }
.button { flex: 1; height: 44px; border-radius: 22px; font-size: 15px; border: 0; }
button:focus, input:focus { outline: 3px solid #ffffff; outline-offset: 3px; transform: scale(1.025); }
button:active { opacity: .78; }
.primary { background: #5df29f; color: #052015; font-weight: 700; }
.secondary { background: rgba(255,255,255,.1); color: #f4fff9; border: 1px solid rgba(255,255,255,.15); }
.search-card, .result-card, .debug-card { display: flex; flex-direction: column; gap: 11px; padding: 16px; border-radius: 16px; background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.1); }
.section-title { font-size: 16px; font-weight: 650; }
.query { flex: 1; height: 40px; padding: 0 13px; border-radius: 10px; background: rgba(0,0,0,.25); color: #fff; font-size: 14px; }
.voice { width: 76px; height: 40px; border-radius: 10px; background: rgba(93,242,159,.13); color: #72f5aa; border: 1px solid rgba(93,242,159,.3); font-size: 13px; }
.search-button { height: 40px; border-radius: 10px; color: #051b12; background: #eafff2; font-weight: 650; font-size: 14px; }
.result-card { border-color: rgba(93,242,159,.35); }
.result-kicker { color: #6ff2a8; font-size: 12px; }
.result-name { font-size: 25px; font-weight: 700; }
.result-time, .result-detail { color: #a7b9b0; font-size: 13px; }
.result-location { font-size: 18px; font-weight: 600; }
.result-tip { padding-top: 9px; border-top: 1px solid rgba(255,255,255,.1); color: #d7e6de; font-size: 14px; line-height: 20px; }
.recent-section { display: flex; flex-direction: column; gap: 8px; }
.empty { padding: 18px 0; color: #7e9389; font-size: 13px; text-align: center; }
.recent-item { width: 100%; min-height: 54px; display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-radius: 11px; background: rgba(255,255,255,.045); border: 0; color: #fff; text-align: left; }
.recent-item view { display: flex; flex-direction: column; gap: 3px; }
.item-name { font-size: 15px; font-weight: 600; }
.item-place, .item-time { color: #8fa59a; font-size: 11px; }
.debug-card { margin-top: 4px; opacity: .75; }
.debug-title { font-size: 10px; letter-spacing: 2px; color: #6ff2a8; }
.debug-line { font-size: 10px; color: #93a79d; }
.tiny-button { flex: 1; min-height: 32px; border-radius: 8px; font-size: 10px; background: rgba(255,255,255,.09); color: #c9d7d0; border: 0; }
.tiny-button.danger { color: #ffb5b5; }
</style>
