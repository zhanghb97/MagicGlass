# 魔镜 MagicGlass v0.3.3

> 在无感知负担下，让用户永远找到东西。

MagicGlass 是运行于 **Rokid Glasses / Rokid AIUI** 的视觉记忆助手。它会在用户明确开启记忆后周期观察当前视野，将“看到了什么、在哪里看到”保存为本地结构化记忆。之后用户可以直接询问：

> 魔镜，我的钥匙在哪里？

MagicGlass 会返回最近一次可靠观察到钥匙的位置，并给出简短的语义寻找提示。

## Demo 能力

当前版本：**v0.3.3**

- 手动立即观察
- 开始记忆后立即观察一次，随后前台每 30 秒周期观察
- Camera → LanguageModel 多模态场景理解
- 场景、语义地点和物品相对位置提取
- Observation 本地持久化，最多保留 200 条
- 基于 `name + aliases` 的物品搜索
- 严格按时间倒序选择最近一次可靠记录（Last Seen）
- 文字、语音和最近物品点击查询
- 查询结果 TTS 播报
- Camera、LLM、ASR、TTS 独立故障降级
- Mock 数据与真实视觉记忆隔离
- Rokid Glasses 焦点导航和确认键交互
- 图片仅用于当次推理，不长期保存

## 核心闭环

```text
用户开启记忆
    ↓
Camera.takePhoto
    ↓
LanguageModel 理解照片
    ↓
生成结构化 Observation
    ↓
Storage 本地保存
    ↓
用户询问物品
    ↓
Last Seen 查询
    ↓
UI + TTS 返回最近位置
```

MagicGlass 不会让 LLM 猜测物品位置。LLM 只负责从照片提取结构化观察；查询和 Last Seen 由本地确定性代码完成。没有可靠记录时，应用会明确回答：

```text
我还没有可靠的雨伞位置记录。
```

## 界面交互

眼镜端采用焦点式导航：

1. 按确认键进入导航模式。
2. 使用上/下方向操作移动焦点。
3. 当前控件出现白色轮廓后，再按确认键执行操作。
4. 返回键退出导航层级或关闭页面。

首页只保留必要操作：

- 开始记忆 / 停止记忆
- 立即观察
- 文字或语音找东西
- 最近看到的物品

## 工程结构

```text
MagicGlass/
├── AGENTS.md                 # 智能体身份、能力与系统约束
├── app.js                    # 应用生命周期
├── app.json                  # 页面与窗口配置
├── app.wxss                  # 全局样式
├── config/
│   └── config.js             # 周期、容量、置信度和调试配置
├── pages/
│   └── index/
│       └── index.ink         # 单页沉浸式 UI 与交互编排
├── services/
│   ├── camera-service.js     # 相机创建与拍照
│   ├── vision-service.js     # 多模态视觉理解与 Prompt
│   ├── memory-service.js     # Observation 本地存储
│   ├── search-service.js     # 别名匹配与 Last Seen
│   ├── speech-service.js     # ASR 与 TTS
│   └── mock-service.js       # 隔离演示数据
├── utils/
│   ├── json.js               # 视觉 JSON 健壮解析与校验
│   └── time.js               # 时间显示和 Observation ID
├── tests/
│   └── core.test.js          # 核心逻辑测试
└── USER_GUIDE.md             # 部署、使用和真机验收指南
```

工程文件直接位于仓库根目录。在 Craft 导入 GitHub 仓库时，不需要选择额外的 `magic-glass/` 子目录。

## 使用的 Rokid AIUI API

本项目只使用 Rokid 官方文档或 capabilities sample 中已经出现的接口：

```text
wx.media.createCameraContext
CameraContext.takePhoto
wx.arrayBufferToBase64
LanguageModel.availability
LanguageModel.create
LanguageModelSession.prompt
LanguageModelSession.destroy
SpeechRecognition
speechSynthesis.speak
wx.setStorageSync
wx.getStorageSync
wx.removeStorageSync
setInterval / clearInterval
```

视觉输入方式参考官方 `samples/capabilities/pages/chat`，存储和语音分别参考 `storage`、`speech` sample。

## Craft 导入与真机运行

1. 在 Rokid Craft Web 工作台选择从 GitHub 导入。
2. 选择本仓库根目录。
3. Preview 首页，检查页面结构和焦点样式。
4. 绑定对应的 AIUI Agent。
5. 在 Craft 中执行 AIX 打包并上传。
6. 在 Rokid AI App 开启开发者模式。
7. 将智能体同步到 Rokid Glasses 并启动“魔镜”。

更完整的部署、使用、隐私说明和真机验收步骤见 [USER_GUIDE.md](./USER_GUIDE.md)。

## 本地测试

本地测试只验证与硬件无关的核心逻辑，需要 Node.js 18 或更高版本：

```bash
npm test
```

覆盖内容：

- 纯 JSON 和 Markdown fenced JSON 解析
- 无效视觉输出拒绝
- Last Seen 返回最新可靠记录
- 低置信度物品过滤
- 无记录时禁止创造位置
- 查询归一化和最近物品生成

相机、LanguageModel、中文 ASR、TTS 和 Storage 持久化仍需在 Rokid Glasses 真机验证。

## 本地 AIX 打包

官方 `aix-cli` 当前要求 Node.js 20 或更高版本：

```bash
npx --yes --package=node@20 --package=@yodaos-pkg/aix-cli \
  aix pack . -o MagicGlass-v0.3.3.aix
```

查看包内容：

```bash
npx --yes --package=node@20 --package=@yodaos-pkg/aix-cli \
  aix list MagicGlass-v0.3.3.aix
```

`.aixignore` 会排除需求文档、测试、npm 开发配置和旧 AIX 文件，避免无关内容进入眼镜安装包。

## 关键配置

配置集中在 `config/config.js`：

```javascript
CAPTURE_INTERVAL_MS = 30000
MAX_OBSERVATIONS = 200
MIN_RELIABLE_CONFIDENCE = 0.55
DEBUG = true
MOCK_MODE = false
```

准备发布正式版本时，可将 `DEBUG` 改为 `false`，隐藏能力状态和演示数据入口。

## 隐私原则

- 只有用户明确点击“开始记忆”后才进行周期观察。
- 首页持续显示“记忆中”或“已暂停”。
- 用户可以随时停止或清空记忆。
- 清空真实记忆需要二次确认。
- 照片只参与当次视觉推理，不作为历史长期保存。
- Mock Observation 使用独立存储键，不混入真实数据。

## 当前边界

- 只保证 Agent 页面有效运行时进行周期观察。
- 页面隐藏或退出后会停止 Timer、ASR 和周期 Camera。
- 不承诺后台全天运行。
- 不包含 SLAM、VIO、空间锚点、室内地图或实时目标跟踪。
- 位置是 `scene + placeHint + relativeLocation` 构成的语义位置，不是厘米级坐标。
- GPS、地图、距离和方位属于后续版本，不阻塞当前寻物闭环。

## 真机验收重点

建议至少完成以下场景：

1. 在书桌观察钥匙、手机和水杯。
2. 到玄关再次观察同一把钥匙。
3. 查询钥匙，结果必须指向玄关的新位置。
4. 查询从未观察过的雨伞，应用必须明确回答没有记录。
5. 重启 Agent，确认历史 Observation 恢复。
6. 停止记忆并等待超过 30 秒，确认不再调用相机。
7. 分别验证 Camera、LLM、ASR 或 TTS 不可用时应用不会崩溃。

## 产品原则

MagicGlass 不是一个功能庞杂的聊天机器人，而是一件安静的视觉记忆工具：

> 它一直安静地替我记着，我需要的时候它就知道。
