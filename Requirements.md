# Rokid Glasses「魔镜 MagicGlass」Demo v0.1 开发说明

你现在需要帮助我开发一个运行于 **Rokid Glasses / Rokid AIUI** 上的智能体 Demo。

这是一个真实的 Rokid Glasses AIUI 项目，不是普通 Web、小程序或 Android App。

请首先阅读 Rokid 官方 AIUI 文档和 GitHub Sample，确认当前 AIUI Runtime 实际支持的 API，再开始编写代码。

开发原则优先级为：

**真机可运行 > 核心闭环完整 > 稳定性 > 代码结构 > 功能数量。**

不要为了看起来功能丰富而使用未经验证的 API，也不要虚构 Rokid AIUI 不具备的能力。

---

# 一、项目名称

中文产品名：

**魔镜**

英文产品名：

**MagicGlass**

工程目录名：

```text
magic-glass
```

代码、目录、内部标识等统一使用：

```text
MagicGlass
magic-glass
```

不要再使用：

```text
MagicMirror
magic-mirror
```

---

# 二、一句话产品定位

**在无感知下，让用户永远找到东西。**

产品希望形成这样的自然交互：

```text
“魔镜，我的钥匙在哪里？”
```

然后眼镜告诉用户：

```text
我最后一次在 5 分钟前看到钥匙。

它在书房靠窗的桌子上，
显示器右侧。

建议先去书房查看桌面。
```

---

# 三、产品目标

MagicGlass 是一个运行在 Rokid Glasses 上的：

**Visual Memory Assistant / 视觉记忆助手**

它不是普通聊天机器人。

核心思想是：

```text
用户戴着眼镜
      ↓
MagicGlass 周期性观察环境
      ↓
识别用户看到的物品
      ↓
记录“什么东西在哪里出现过”
      ↓
持续形成视觉记忆
      ↓
用户之后询问某个东西
      ↓
找到它最后出现的位置
      ↓
告诉用户去哪里找
```

用户不需要主动记录：

```text
钥匙放哪里了
耳机放哪里了
充电器放哪里了
钱包放哪里了
```

MagicGlass 替用户记住。

---

# 四、Rokid 官方资料

开发前必须优先阅读以下资料。

## Rokid AIUI 快速入门

```text
https://js.rokid.com/AIUI/guide/quickstart/quickstart?version=latest&lang=zh-CN
```

## Rokid AIUI GitHub

```text
https://github.com/jsar-project/AIUI
```

重点研究：

```text
samples/capabilities
```

这套 Sample 已经由我在 Rokid Glasses 真机上成功跑通。

因此：

**当前 GitHub Sample 是本项目最重要的代码事实源之一。**

优先复用 Sample 已经验证过的 API 和实现模式，不要重新猜测 Rokid API。

重点研究：

```text
samples/capabilities/pages/chat
samples/capabilities/pages/speech
samples/capabilities/pages/storage
samples/capabilities/pages/geolocation
samples/capabilities/pages/map
```

同时调查其中与以下能力相关的实现：

```text
Camera
LanguageModel
SpeechRecognition
TTS
Storage
Geolocation
Timer / Lifecycle
```

## AIUI 主站

```text
https://js.rokid.com/AIUI
```

## AIUI 技术文档

```text
https://rokid.yuque.com/ub8h5n/hsmrp5/cl87q6uy59ifbh8w
```

## 乐奇学院课程

```text
https://t.rokid.com/n2w8u2o
```

## Rokid Glasses 推荐设计规范

```text
https://custom.rokid.com/prod/rokid_web/57e35cd3ae294d16b1b8fc8dcbb1b7c7/pc/cn/5a71b66dbc1e4689886c7aa437299f2b.html
```

---

# 五、v0.1 的范围

第一版不要试图解决所有问题。

v0.1 只需要打通：

```text
周期拍照
   ↓
视觉模型理解场景
   ↓
提取物品和位置
   ↓
保存视觉记忆
   ↓
用户询问物品
   ↓
找到最后一次出现记录
   ↓
告诉用户在哪里
   ↓
给出简单寻找提示
```

这个闭环必须能够在 Rokid Glasses 真机运行。

---

# 六、v0.1 明确不做什么

第一版暂时不要实现：

```text
SLAM
VIO
3D Spatial Mapping
AR 世界锚点
室内厘米级定位
室内地图重建
实时目标跟踪
完整导航引擎
人脸识别
人物身份识别
云端账号系统
云数据库同步
照片云存储
独立手机 App
多用户协同
```

如果 Rokid 当前已经提供某项极其简单的官方能力，可以记录为后续扩展，但不要因此扩大 v0.1 范围。

---

# 七、MagicGlass 的核心数据模型

MagicGlass 的核心不是“聊天历史”，而是：

**Observation / 视觉观察记录。**

一次观察：

```text
Observation
│
├── 拍摄时间
├── 当前场景
├── 语义地点
├── GPS（如果可用）
│
└── 本次看到的物品
      │
      ├── 名称
      ├── 别名
      ├── 外观
      ├── 相对位置
      └── 置信度
```

例如：

```json
{
  "id": "obs-001",
  "timestamp": 1786757220000,
  "scene": "书房",
  "placeHint": "靠窗的书桌",
  "summary": "书桌上有电脑、耳机和充电器",
  "location": {
    "latitude": null,
    "longitude": null,
    "accuracy": null
  },
  "items": [
    {
      "name": "耳机",
      "aliases": [
        "无线耳机",
        "黑色耳机"
      ],
      "description": "黑色头戴式耳机",
      "relativeLocation": "显示器右侧",
      "confidence": 0.92
    }
  ]
}
```

---

# 八、物品位置的定义

不要把“位置”等同于 GPS。

MagicGlass v0.1 的位置分三层。

## 第一层：场景位置

例如：

```text
书房
客厅
厨房
玄关
卧室
办公室
会议室
```

字段：

```text
scene
```

---

## 第二层：语义位置

例如：

```text
靠窗的书桌
玄关鞋柜
客厅茶几
沙发旁边
床头柜
书架第二层
```

字段：

```text
placeHint
```

这是 MagicGlass 最重要的位置表示。

---

## 第三层：物品相对位置

例如：

```text
显示器右侧
键盘后方
鞋柜顶部
茶几左侧
沙发扶手旁
书架第二层右侧
```

字段：

```text
relativeLocation
```

例如：

```json
{
  "name": "钥匙",
  "relativeLocation": "鞋柜顶部靠近门的一侧"
}
```

---

# 九、GPS 的定位

如果 Rokid 当前 Geolocation 能力可用，可以附加：

```json
{
  "latitude": 0,
  "longitude": 0,
  "accuracy": 0
}
```

但必须明确：

**GPS 是辅助信息，不解决室内物品定位。**

不要因为 GPS 存在就删除：

```text
scene
placeHint
relativeLocation
```

---

# 十、Last Seen 原则

MagicGlass 查询物品时，核心规则是：

**优先返回最近一次可靠看到该物品的位置。**

例如视觉历史：

```text
10:21
书房 · 书桌
钥匙

10:24
客厅 · 茶几
钥匙

10:27
玄关 · 鞋柜
钥匙
```

用户问：

```text
“我的钥匙在哪里？”
```

必须返回：

```text
10:27
玄关 · 鞋柜
```

不能返回 10:21 或 10:24。

这一原则称为：

```text
Last Seen
```

它是 MagicGlass v0.1 最重要的查询规则。

---

# 十一、功能 1：记忆模式

首页提供：

```text
开始记忆
```

和：

```text
停止记忆
```

记忆开启后显示明显状态：

```text
● 记忆中
```

停止后显示：

```text
○ 已暂停
```

建议首页状态：

```text
魔镜

● 记忆中

已记录 18 个场景
已识别 43 个物品

最近观察
2 分钟前

下一次观察
约 30 秒后
```

---

# 十二、功能 2：手动观察

在实现自动周期拍摄之前，必须首先实现：

```text
立即观察
```

用于开发调试。

流程：

```text
点击“立即观察”
       ↓
Camera.takePhoto
       ↓
LanguageModel
       ↓
视觉理解
       ↓
JSON
       ↓
Observation
       ↓
Storage
       ↓
UI 显示结果
```

必须先把这个流程跑通，再做 Timer。

---

# 十三、功能 3：周期观察

手动观察稳定之后，实现：

```text
Timer
 ↓
Camera
 ↓
Vision
 ↓
Observation
 ↓
Storage
```

默认间隔：

```text
30 秒
```

配置统一定义：

```javascript
CAPTURE_INTERVAL_MS
```

调试模式允许：

```text
10 秒
30 秒
60 秒
```

不要在多个文件中写死时间。

---

# 十四、禁止并发采集

这是硬性要求。

需要维护状态：

```text
idle
capturing
analyzing
```

如果上一张图仍在：

```text
拍摄
```

或者：

```text
AI 分析
```

下一次 Timer 必须跳过。

例如：

```javascript
if (captureInProgress) {
  return;
}
```

禁止发生：

```text
Camera 并发
Vision 并发
Observation 乱序
重复写入
```

---

# 十五、视觉理解

优先参考官方 Sample：

```text
samples/capabilities/pages/chat
```

实际采用 Sample 中已经验证过的：

```text
Camera
+
takePhoto
+
image_url
+
LanguageModel
```

实现方式。

不要自行假设不存在的：

```text
Vision API
Camera API
Multimodal API
```

如果 Sample 的实际方式与本说明不同：

**以当前官方 Sample 为准。**

---

# 十六、Vision Prompt

请单独实现：

```text
visionPrompt
```

不要把视觉 Prompt 散落在页面代码里。

模型只负责输出结构化场景信息。

Prompt 要求：

1. 识别用户之后可能寻找的明显物品；
2. 忽略墙、地板、天花板等无价值目标；
3. 输出简洁中文物品名称；
4. 给物品生成常见 aliases；
5. 判断场景；
6. 判断语义地点；
7. 描述物品相对位置；
8. 输出 confidence；
9. 不确定就降低 confidence；
10. 不允许虚构不存在的物品；
11. 只输出严格 JSON。

可以优先关注：

```text
钥匙
钱包
手机
耳机
眼镜
充电器
遥控器
电脑
平板
包
书
证件
银行卡
水杯
手表
工具
文件
```

但不能把识别范围限制死。

---

# 十七、Vision 返回格式

建议要求模型返回：

```json
{
  "scene": "书房",
  "placeHint": "靠窗的书桌",
  "summary": "桌面放有电脑、耳机和充电器",
  "items": [
    {
      "name": "耳机",
      "aliases": [
        "无线耳机",
        "头戴耳机"
      ],
      "description": "黑色头戴式耳机",
      "relativeLocation": "显示器右侧",
      "confidence": 0.92
    }
  ]
}
```

---

# 十八、JSON 解析必须健壮

实现统一函数，例如：

```javascript
parseVisionResult()
```

至少兼容：

```text
纯 JSON
```

和：

````text
```json
{
}
```
````

等常见 LLM 输出。

如果解析失败：

```text
不要崩溃
不要写错误 Observation
记录日志
丢弃本次结果
等待下一次观察
```

---

# 十九、本地视觉记忆

v0.1 优先使用 AIUI 官方 Sample 已验证的 Storage API。

重点参考：

```text
samples/capabilities/pages/storage
```

建议存储键：

```text
magic-glass.observations
magic-glass.settings
```

---

# 二十、第一版不长期保存照片

默认流程：

```text
Camera Image
    ↓
Vision Model
    ↓
Structured Observation
    ↓
删除/释放当前图片
```

长期保存：

```text
时间
场景
语义地点
物品
相对位置
置信度
GPS
```

不要默认长期保存用户拍摄的所有照片。

这样可以：

```text
降低存储量
提高查询速度
减少隐私压力
简化 Demo
```

---

# 二十一、Storage 容量限制

Observation 不允许无限增长。

统一定义：

```javascript
MAX_OBSERVATIONS
```

例如：

```text
200
```

超过后：

```text
删除最旧 Observation
保留最近 Observation
```

后续可以改为时间窗口。

v0.1 先使用简单固定容量即可。

---

# 二十二、物品搜索

用户可能使用不同表达：

```text
钥匙
我的钥匙
钥匙串
车钥匙
key
```

查询不能只采用：

```text
name === query
```

至少需要考虑：

```text
name
aliases
```

必要时可以使用 LanguageModel 做简单语义判断。

但：

**LLM 只负责帮助匹配，不负责创造不存在的记忆。**

---

# 二十三、寻找物品流程

用户：

```text
“我的耳机在哪里？”
```

流程：

```text
SpeechRecognition
        ↓
得到查询文本
        ↓
解析用户寻找的物品
        ↓
查询 Visual Memory
        ↓
name / aliases 匹配
        ↓
按 timestamp 倒序
        ↓
选择最新可靠 Observation
        ↓
生成寻找提示
        ↓
UI
        ↓
TTS
```

---

# 二十四、禁止幻觉

这一条必须严格实现。

用户问：

```text
“雨伞在哪里？”
```

如果历史 Observation 中没有雨伞：

必须回答：

```text
我最近没有看到雨伞。
```

或者：

```text
我还没有可靠的雨伞位置记录。
```

绝对禁止回答：

```text
可能在玄关。
```

除非视觉历史真实存在该信息。

---

# 二十五、寻找结果

如果找到物品，至少显示：

```text
物品名称

最后看到时间

场景

具体位置

寻找提示
```

例如：

```text
钥匙

最后看到
2 分钟前

位置
玄关 · 鞋柜

具体位置
鞋柜顶部靠近门的一侧

寻找提示
去玄关，检查鞋柜顶部。
```

---

# 二十六、Semantic Navigation

v0.1 不做真正室内导航。

第一版导航定义为：

**Semantic Navigation / 语义导航**

例如：

```text
去书房
 ↓
找到靠窗书桌
 ↓
查看显示器右侧
```

再例如：

```text
前往玄关
 ↓
找到鞋柜
 ↓
检查鞋柜顶部
```

这是第一版真正需要解决的“导航”。

---

# 二十七、GPS 辅助导航

如果：

```text
当前 GPS
```

以及：

```text
Observation GPS
```

都有效，可以增加：

```text
距离
方向
```

例如：

```text
最后记录位置约在 25 米东北方向。
```

可以用：

```text
Haversine
Bearing
```

计算。

但这属于：

```text
P1
```

不能阻塞核心 MVP。

不要把 GPS 描述成室内精确导航。

---

# 二十八、语音找东西

至少实现一个入口：

```text
🎙 找东西
```

用户点击：

```text
SpeechRecognition
 ↓
“我的钱包在哪里？”
 ↓
Memory Search
 ↓
Last Seen
 ↓
Result UI
 ↓
TTS
```

语音实现优先复用：

```text
samples/capabilities/pages/chat
samples/capabilities/pages/speech
```

已有工作代码。

---

# 二十九、首页设计

MagicGlass 应采用简单、沉浸式、低操作负担的 AIUI。

建议结构：

```text
┌────────────────────────────┐

            魔镜

       让你永远找到东西

        ● 记忆中

      已记录 18 个场景
      识别到 43 个物品

       [ 停止记忆 ]


          最近看到

   钥匙     2 分钟前
   玄关 · 鞋柜

   耳机     8 分钟前
   书房 · 书桌


        [ 🎙 找东西 ]

└────────────────────────────┘
```

---

# 三十、UI 原则

严格参考 Rokid Glasses 推荐设计规范。

视觉关键词：

```text
Minimal
Ambient
Quiet
Glanceable
High Contrast
```

中文理解：

```text
极简
安静
低打扰
一眼能看懂
高对比
```

不要设计成手机 App。

避免：

```text
复杂导航栏
大量按钮
大量列表
密集文字
多级菜单
复杂设置页
```

首页只需要回答三个问题：

```text
现在是否正在记忆？
最近记住了什么？
我怎样找东西？
```

---

# 三十一、最近物品

首页最多显示：

```text
3～5 个
```

最近识别物品。

每项只显示：

```text
物品名
时间
scene + placeHint
```

例如：

```text
钥匙
2 分钟前
玄关 · 鞋柜
```

点击最近物品可以直接进入寻找结果。

---

# 三十二、生命周期问题

这里必须先调查官方 AIUI 能力。

MagicGlass 的产品理想状态是：

```text
用户无感知
眼镜持续观察
```

但不要直接假设 AIUI Agent 在：

```text
onHide
后台
页面退出
系统休眠
```

之后仍然支持：

```text
Timer
Camera
LanguageModel
```

持续运行。

开发前必须调查 Rokid 官方当前版本是否明确支持后台持续周期任务。

如果没有可靠依据：

v0.1 明确降级为：

**仅保证 MagicGlass Agent 处于有效运行状态时进行周期视觉采集。**

当页面隐藏或退出时：

```text
停止 Timer
停止周期 Camera
释放 Listener
停止 ASR
避免资源泄漏
```

不要伪造后台全天运行能力。

---

# 三十三、隐私要求

“在无感知下”指：

**用户无需主动记忆物品位置。**

不代表应用应该偷偷拍照。

当周期视觉记忆开启时，必须明确显示：

```text
● 记忆中
```

用户必须可以随时：

```text
开始记忆
停止记忆
清空记忆
```

清空记忆需要二次确认。

---

# 三十四、推荐项目结构

不要把所有业务写进一个巨大的 `index.ink`。

建议：

```text
magic-glass/
│
├── AGENTS.md
├── app.js
├── app.json
├── app.wxss
│
├── config/
│   └── config.js
│
├── services/
│   ├── camera-service.js
│   ├── vision-service.js
│   ├── memory-service.js
│   ├── search-service.js
│   ├── speech-service.js
│   ├── location-service.js
│   └── navigation-service.js
│
├── utils/
│   ├── json.js
│   ├── geo.js
│   └── time.js
│
└── pages/
    ├── index/
    │   └── index.ink
    │
    └── result/
        └── index.ink
```

但是：

如果当前 AIUI Runtime 的模块机制与此结构冲突，以官方 Sample 的真实结构为准。

不要为了“架构漂亮”破坏真机兼容性。

---

# 三十五、模块职责

`camera-service`：

```text
创建 CameraContext
takePhoto
Camera 状态
错误恢复
```

`vision-service`：

```text
LanguageModel
Vision Prompt
图像输入
JSON 输出
JSON 解析
```

`memory-service`：

```text
Observation CRUD
Storage
容量限制
最近记录
```

`search-service`：

```text
query 解析
name 匹配
aliases 匹配
Last Seen 排序
```

`speech-service`：

```text
SpeechRecognition
TTS
生命周期
错误处理
```

`location-service`：

```text
Geolocation
最近有效位置缓存
定位精度
```

`navigation-service`：

```text
Semantic Navigation
距离
Bearing
寻找提示
```

---

# 三十六、AGENTS.md

必须认真编写。

Agent 名称：

```text
魔镜
```

英文名：

```text
MagicGlass
```

核心定位：

```text
运行于 Rokid Glasses 上的视觉记忆助手。
```

System Prompt 必须体现：

1. 主要任务是帮助用户根据历史视觉记忆寻找物品；
2. 不是百科问答助手；
3. 优先使用最近视觉观察；
4. 只能使用已经存在的视觉记忆；
5. 不允许猜测物品位置；
6. 找不到时明确告诉用户没有记录；
7. 回答必须简洁；
8. 输出适合眼镜阅读；
9. TTS 内容自然简短；
10. 位置描述优先使用用户容易理解的自然语言。

---

# 三十七、异常处理

Camera 不可用：

```text
相机暂时不可用
```

应用不得崩溃。

LanguageModel 不可用：

```text
视觉模型暂时不可用
```

停止视觉识别，但 UI 仍然正常。

SpeechRecognition 不可用：

已有物品仍可通过点击查询。

TTS 不可用：

文字正常显示。

Geolocation 不可用：

继续依靠：

```text
scene
placeHint
relativeLocation
```

Storage 异常：

记录错误并保护 App 状态。

任何单一 Capability 故障都不能导致整个 MagicGlass 崩溃。

---

# 三十八、Debug Mode

提供统一：

```javascript
DEBUG = true
```

开发模式可以显示：

```text
Camera: Ready
LLM: Ready
ASR: Ready
TTS: Ready
Location: Ready

Captures: 12
Observations: 11
Items: 37
Last inference: 980ms
```

正式主 UI 不显示这些调试内容。

---

# 三十九、Mock Mode

为了 Craft / Web 预览方便，提供：

```text
Demo / Mock Mode
```

但必须和真实实现隔离。

Mock Observation 建议至少包含：

```text
书房
- 耳机
- 充电器

玄关
- 钥匙
- 钱包

客厅
- 遥控器
- 手机
```

通过 Mock 可以验证：

```text
首页
最近物品
Last Seen
寻找结果
Semantic Navigation
```

Mock 数据绝不能混入真实用户 Observation。

---

# 四十、开发顺序

必须严格采用渐进方式。

## P0-1：源码调查

先调查 AIUI 当前实际 Capability。

不要写业务代码。

输出准备使用的：

```text
Camera API
LanguageModel API
SpeechRecognition API
TTS API
Storage API
Geolocation API
Lifecycle API
```

每项必须指出来源：

```text
官方文档
或
官方 Sample
```

---

## P0-2：创建独立工程

创建：

```text
magic-glass
```

不要修改：

```text
AIUI/samples/capabilities
```

官方 Sample 只作为只读参考。

---

## P0-3：首页

首先完成：

```text
首页
开始记忆
停止记忆
Mock 最近物品
```

保证 Craft Preview 正常。

---

## P0-4：手动视觉观察

实现：

```text
立即观察
 ↓
Camera
 ↓
LanguageModel
 ↓
JSON
 ↓
UI
```

这一步必须真机通过。

---

## P0-5：Observation Storage

实现：

```text
视觉结果
 ↓
Observation
 ↓
Storage
 ↓
关闭 Agent
 ↓
重新打开
 ↓
历史仍存在
```

---

## P0-6：物品查询

首先不做语音。

实现：

```text
选择/输入“钥匙”
 ↓
Memory Search
 ↓
Last Seen
 ↓
寻找结果
```

---

## P0-7：语音查询

加入：

```text
SpeechRecognition
+
TTS
```

打通：

```text
“魔镜，我的钥匙在哪里？”
```

---

## P0-8：周期观察

最后再增加：

```text
Timer
 ↓
Camera
 ↓
Vision
 ↓
Storage
```

不要一开始就加入 Timer。

这样可以降低调试复杂度。

---

# 四十一、P1 功能

P0 全部稳定之后再实现：

```text
GPS
距离
方位
最近物品优化
拍摄周期设置
Map
视觉历史
更智能的语义搜索
```

P1 不允许影响已经稳定的 P0。

---

# 四十二、代码质量要求

必须避免：

```text
Timer 重复创建
Listener 泄漏
CameraContext 无限创建
LanguageModel Session 无限创建
页面退出后 Timer 继续运行
并发 Camera
并发 LLM
Storage 无限增长
重复 Observation
异步 Race Condition
```

尽量复用：

```text
CameraContext
LanguageModel Session
```

但必须正确处理生命周期。

---

# 四十三、API Key

禁止把任何：

```text
API Key
Token
Secret
Password
```

硬编码到前端源码。

如果 v0.1 使用 Rokid 内置 LanguageModel，则优先使用内置能力。

如果未来需要访问第三方模型，应通过安全后端代理。

---

# 四十四、验收场景

必须至少完成以下测试。

### Case 1：启动

打开 MagicGlass。

首页正常。

PASS。

### Case 2：开始记忆

点击：

```text
开始记忆
```

显示：

```text
● 记忆中
```

PASS。

### Case 3：手动视觉识别

眼镜看向桌面。

桌面有：

```text
钥匙
手机
水杯
```

执行立即观察。

生成 Observation。

PASS。

### Case 4：第二场景

用户移动至玄关。

看到：

```text
钥匙
钱包
```

产生新的 Observation。

PASS。

### Case 5：Last Seen

询问：

```text
钥匙在哪里？
```

必须返回：

```text
玄关的新位置
```

不能返回桌面的旧位置。

PASS。

### Case 6：找不到

询问：

```text
雨伞在哪里？
```

没有对应 Observation。

回答：

```text
我最近没有看到雨伞。
```

PASS。

不得猜测。

### Case 7：语音

用户说：

```text
我的钱包在哪里？
```

ASR 成功。

查询成功。

UI 显示结果。

TTS 播放。

PASS。

### Case 8：重启

关闭 Agent。

重新启动。

Visual Memory 恢复。

PASS。

### Case 9：停止记忆

点击：

```text
停止记忆
```

Timer 停止。

不再触发 Camera。

PASS。

### Case 10：Capability 故障

分别模拟：

```text
Camera 不可用
LLM 不可用
ASR 不可用
GPS 不可用
```

App 不崩溃。

PASS。

---

# 四十五、真机运行目标

最终工程必须可以：

```text
magic-glass
   ↓
Craft 导入
   ↓
Preview
   ↓
AIX 打包
   ↓
上传 MagicGlass 智能体
   ↓
Rokid AI App 开发者模式
   ↓
智能体调试
   ↓
Rokid Glasses
   ↓
运行 MagicGlass
```

我已经成功跑通过 Rokid 官方 `samples/capabilities` 的完整打包和真机部署流程。

因此不要花时间重新设计部署体系。

---

# 四十六、第一轮工作不要直接大规模编码

请首先完成源码调查。

第一轮回复必须给我：

## Source Audit

说明查看了哪些：

```text
AIUI Sample
AIUI 文档
```

以及分别找到了什么。

## Capability Matrix

至少给出：

```text
Capability       实际 API           来源          是否适合 MagicGlass

Camera
LanguageModel
ASR
TTS
Storage
Geolocation
Lifecycle
Timer
```

## Platform Limitations

重点回答：

```text
AIUI 是否支持后台长期运行？
Agent onHide 后 Timer 是否运行？
Camera 是否允许周期调用？
LanguageModel 是否适合周期视觉调用？
Storage 容量/限制是什么？
```

没有官方依据的地方明确写：

```text
UNKNOWN
```

禁止猜测。

## Architecture Proposal

给出最终项目目录结构和模块关系。

## P0 Implementation Plan

说明：

```text
P0-1
P0-2
P0-3
...
```

准备如何实施。

---

# 四十七、完成开发后的最终交付格式

最终请输出：

## 1. Source Audit

实际参考的 Rokid 官方 Sample 和文档。

## 2. Architecture

完整工程目录树。

## 3. Implemented Features

P0/P1 功能完成情况。

## 4. AIUI APIs Used

实际调用的 API。

不得列出未使用 API。

## 5. Known Limitations

例如：

```text
后台运行
周期拍摄限制
室内导航限制
GPS 精度
LLM 延迟
```

## 6. Test Results

所有 Case：

```text
PASS / FAIL
```

## 7. True-device Checklist

给出 Rokid Glasses 真机测试步骤。

## 8. Packaging Readiness

确认：

```text
AGENTS.md
app.js
app.json
pages
assets
services
```

等工程结构合法。

确认可以执行：

```text
Craft Preview
→ AIX 打包
→ 上传 MagicGlass
→ Rokid Glasses 开发者调试
```

---

# 四十八、最终产品原则

MagicGlass 的体验核心不是：

```text
用户不停操作眼镜
```

而是：

```text
眼镜安静地替用户记住看到过什么
```

只有用户需要时：

```text
“魔镜，我的钥匙在哪里？”
```

MagicGlass 才快速回答。

产品应该给人的感觉是：

**它一直安静地替我记着，我需要的时候它就知道。**

这就是 MagicGlass v0.1 最核心的产品体验。

---

# 现在开始执行

请不要立即大规模修改代码。

第一步先完成：

```text
AIUI 官方资料调查
+
samples/capabilities 源码审计
+
Capability Matrix
+
MagicGlass 实施方案
```

先把调查结果和方案提交给我。

等方案确认后，再创建 `magic-glass` 工程并开始 P0 开发。

如果产品要求和当前 Rokid AIUI Runtime 能力发生冲突：

**以当前 Rokid 官方文档和已经能够真机运行的 AIUI Sample 为事实源。**

明确说明应该如何降级实现。

禁止通过虚构 API 或假实现让功能表面上“完成”。
