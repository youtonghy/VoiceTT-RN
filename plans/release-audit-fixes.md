# v0.3.4 发布前审计修复方案

> 来源：2026-07-03 发布前代码审计（8 维度静态审计 + 逐项复核，基线 master @ 4a9c1c6 含工作树未提交改动）。
> 原则：按批次串行推进，P0/P1 修完并回归后才具备发布条件；每批一个 PR，改动最小化，不顺手重构。
> 每批完成后统一执行：`bunx tsc --noEmit --pretty false`、`bun run lint`、`bun run check:i18n`、`bun test`、`git diff --check`。涉及 HeroUI 组件的 UI 改动，先经 MCP 拉取对应组件文档（AGENTS.md 要求）。

---

## P0 — 发布阻断（必须最先修，两项互相独立可并行）

### P0-1 iOS 工程编译失败
- **位置**：`ios/VoiceTT/RealtimeAudioModule.swift:131`
- **问题**：`Float(Int16.max + 1)` 中加法在 `Int16` 上常量折叠，编译期溢出报错，iOS target 无法构建。
- **修复**：负半轴缩放因子不经 `Int16` 运算：
  ```swift
  let scaled = clamped < 0 ? clamped * 32768.0 : clamped * Float(Int16.max)
  ```
  （或 `-Float(Int16.min)`，语义等价，二选一。）
- **验证**：`xcodebuild -workspace ios/VoiceTT.xcworkspace -scheme VoiceTT -configuration Release build`（或 EAS iOS 构建）通过；真机跑一次实时转写确认 PCM 波形正常（负半轴不削波）。

### P0-2 朗读页以 v2 schema 覆写 v3 历史树（全部历史丢失）
- **位置**：`app/(tabs)/text-to-speech.tsx:32-33, 330-390`
- **问题**：与转写页共用 key `@agents/history-conversations`，但按 v2 扁平结构读写；读 v3 数据得到空列表后，持久化 effect 立即用 `{version:2, conversations:[]}` 覆写整棵 v3 树。
- **修复**（分三步，均在本批内完成）：
  1. **止血**：所有历史读写点（转写页 + 朗读页）加"版本防降级"守卫——读到 `payload.version` 大于本页支持的版本时，只读不写（禁用该页的持久化 effect 并提示），任何情况下不得写入低版本载荷。
  2. **迁移**：v3 的 `HistoryConversation` 已含 `ttsMessages` 字段（见转写页 `createConversation`），将朗读页改为读写 v3 树：抽取共享存储模块 `services/history-storage.ts`（load/persist/迁移入口统一收口，内部复用 `sanitizeHistoryTree`/`normalizeHistoryTree`），两个页面都改走该模块，删除朗读页自己的 v2 类型与读写代码。
  3. **一次性数据修复**：`history-storage.ts` 的 load 内识别 v2 载荷（含被本 bug 清空的 `{version:2, conversations:[]}`），按既有 v2→v3 迁移逻辑升级后回写。
- **验证**：新增单测——v3 载荷经朗读页 load/persist 往返后节点无损；v2 载荷 load 后升级为 v3；手工回归：转写页建历史 → 切朗读 Tab → 回转写页历史完好。

---

## P1 — 数据丢失与主流程高危（发布前必须完成）

### P1-1 正常停止录音销毁在途转写
- **位置**：`contexts/transcription-context.tsx:1751, 1780`（默认 `cancelPendingTasks=true` + `markMessagesFailed=true`）、`:1603-1611`（`processSegment` finally 无条件删音频）
- **修复**：
  1. `toggleSession` 的正常停止改为 `stopSession({ cancelPendingTasks: false })`——在途分段任务自然跑完；会话状态进入 `stopping` 后由现有任务注册表清零判定真正结束。
  2. `processSegment` 的 `finally` 改为仅在任务**成功或终态失败**时删除音频；任务被 abort 时保留文件并在消息上记录 `fileUri`，供后续重试。
  3. 消息失败态补"重试"入口（长按/右键菜单加 retry action，复用现有 `processSegment` 路径）。文案键新增并同步 6 语言。
- **验证**：手工——长录音（多分段、慢引擎如 Soniox）进行中点停止，确认所有分段最终 completed 而非 failed；单测覆盖 `stopSession` 默认参数不再取消任务。

### P1-2 历史恢复失败后被空树覆写
- **位置**：`app/(tabs)/transcription.tsx:267-326`（load）、`:799-818`（persist effect）
- **修复**（并入 P0-2 的 `history-storage.ts`）：
  1. load 失败（JSON 损坏 / getItem 抛错）时置 `loadFailed` 状态，persist 路径检测到该状态直接拒写。
  2. 每次会话首次成功 load 后，将原始 raw 备份到 `@agents/history-conversations.bak`（单份滚动备份）；load 主 key 失败时尝试从 .bak 恢复。
  3. UI 层在 `loadFailed` 时展示只读提示条（文案入 6 语言包）。
- **验证**：单测——向 mock storage 写入损坏 JSON，load 后触发任意 state 变更，断言主 key 未被覆写且能从 .bak 恢复。

### P1-3 OpenAI `/v1/responses` 携带非法参数致 400
- **位置**：`services/transcription.ts:1322-1326` 及同文件所有 `buildOpenAI*Payload`（翻译/标题/摘要/助手，grep `modalities` 与 `response_format` 全部命中点）
- **修复**：删除 `modalities` 与 `response_format` 两个顶层字段（Responses API 文本输出本就是默认行为，不需要替代参数；如确需结构化输出用 `text.format`）。改前经 Context7 核对 Responses API 当前参数表。
- **验证**：配真实 OpenAI key 手工跑一次翻译 + 标题/摘要 + 助手，确认 200；同时验证一个自定义 baseUrl 网关不回归。

### P1-4 Electron 端 Alert 全体失效
- **位置**：全项目 `Alert.alert` 调用点（`app/(tabs)/transcription.tsx:1258` 等）
- **修复**：新建 `components/app-alert.ts(x)` 统一入口：native 平台透传 RN `Alert`；web/Electron 用 HeroUI Native `Dialog` 实现同签名的确认/提示（含 destructive 样式按钮）。全局替换 `Alert.alert` 为该封装（ESLint `no-restricted-imports` 禁止直接引 RN Alert，防回归）。实现前经 MCP 拉取 `Dialog` 组件文档。
- **验证**：Electron 下删除文件夹弹确认框、错误提示可见；移动端行为不变。

### P1-5 删除会话无确认
- **位置**：`app/(tabs)/transcription.tsx:1235-1250`
- **修复**：`handleDeleteConversation` 接入确认弹窗（走 P1-4 的封装，天然覆盖桌面端），使用已存在但未接线的 i18n 确认文案键；与文件夹删除的交互对齐。
- **验证**：手工三端（iOS/Android/Electron）确认弹窗出现且取消不删。

### P1-6 转写页三个 Pane 定义在渲染函数体内（逐字符失焦 + 全树重建）
- **位置**：`app/(tabs)/transcription.tsx:1909, 1966, 2113`，使用点 `:2284-2306`
- **修复**：将 `LivePane`/`HistoryPane`/`AssistantPane` 提升为模块级 `memo` 组件，所需状态与回调显式作为 props 传入（回调保持 `useCallback` 稳定引用）。本批只做"提升 + 传参"，不做进一步拆分重构。
- **验证**：手工——搜索框、助手输入框连续输入不失焦、键盘不收起；React DevTools 确认输入时 Pane 不再卸载重建。

### P1-7 QA 失败吞错并伪造英文结果入库
- **位置**：`services/qa.ts:748-773`
- **修复**：删除 catch 中的正则伪造回退，直接向上抛出；调用方（transcription-context 的 QA 触发路径）将消息 QA 置为 failed 态并显示本地化错误（错误分类沿用 `error-handler`，同步修复 401/403 被归类为 NETWORK 的问题，`qa.ts:283`）。
- **验证**：配无效 key 手动触发 QA，确认 UI 显示失败态与正确错误文案，历史中无伪造条目。

### P1-8 原生采集错误只 console.warn，不上报会话层
- **位置**：`services/realtime-audio.native.ts:38-43`
- **修复**：`PcmCapture` 接口增加 `onError` 回调；native/web 两个实现统一接线；会话层（realtime 路径）收到错误时调用 `stopSession({ failureMessage })` 让 UI 退出"录音中"。
- **验证**：Android 上模拟启动失败（占用麦克风）确认 UI 出错并复位；配合 P2-1 的中断场景一并回归。

### P1-9 Android 后台实时录音被系统静音（缺 microphone 前台服务）
- **位置**：`android/.../realtimeaudio/RealtimeAudioModule.kt`、`app.json:31`
- **修复**：在 `RealtimeAudioModule.start()` 中启动 `foregroundServiceType="microphone"` 的前台服务（含通知渠道与常驻通知，文案入 6 语言），`stop()` 时停止；Manifest 注册 service。upload 模式（expo-audio 路径）确认其自身后台行为，不在本项范围。
- **验证**：真机实时录音 → 锁屏/切后台 2 分钟 → 回前台，确认期间音频未静音、通知正确显示与消失。

### P1-10 Pro 授权在 web/Electron 可伪造（存储态不复验签名）
- **位置**：`services/pro.ts:517-525`
- **修复**：`getProStatus` 在 `validatePayload` 前先对 `stored` 的原始签名做 ed25519 复验（激活时保存原始 payload 字节与签名，避免重序列化不一致）；验签失败按 `invalid` 处理并清除。
- **验证**：单测——篡改存储 payload 后 `getProStatus` 返回 invalid；正常授权不受影响。

### P1-11 四语言缺失 18 个键 + check:i18n 不做键对齐
- **位置**：`src/locales/{zh-Hant,ja,ko,es}/common.json`（缺 `settings.keyboard.*`）、`scripts/check-i18n.js`
- **修复**：补齐 4×18 个键的翻译；`check-i18n.js` 增加键对齐校验（以 en 为基准，任一 locale 缺键/多键即非零退出，输出差集），并校验插值变量一致性。
- **验证**：`bun run check:i18n` 通过；人为删一个键确认脚本能红。

---

## P2 — 中危（发布前尽量完成；至少完成 2-1/2-2/2-3/2-4，其余可随 0.3.5）

### 原生音频稳定性
1. **P2-1 iOS 线程安全与会话清理**（`RealtimeAudioModule.swift:72, 135`）：`pendingSamples`/`isCapturing` 全部经串行 `DispatchQueue` 访问；`stopCapture` 调 `setActive(false, options: .notifyOthersOnDeactivation)`；监听中断 `.ended` 且带 `.shouldResume` 时重启 engine，否则经 P1-8 通道上报错误。
2. **P2-2 Android 采集循环健壮性**（`RealtimeAudioModule.kt:38, 104`）：`read()` 返回负值时退出循环并 emit `realtimeAudioError`；`startRecording` 失败路径复位 `isCapturing` 并释放 `AudioRecord`；start 前若无 `RECORD_AUDIO` 权限，由 JS 侧先走 `PermissionsAndroid.request`（实时路径当前不请求，首次必失败）。

### 实时会话生命周期
3. **P2-3 WS 断线与停止等待**（`contexts/transcription-context.tsx:1650, 1789`）：`onClose` 非主动关闭时按失败停止会话（复用 P1-8 的失败路径，消息标 failed 而非永久 transcribing）；停止时的固定 2s grace 改为"等待最终 `completed` 事件，超时 5s 兜底"，超时后将未回执消息标 failed。
4. **P2-4 切换语言静默停止录音**（`:1967`）：清理 effect 依赖数组去掉 `t`（failureMessage 经 ref 取当前翻译），确保仅卸载时清理。

### 服务层
5. **Soniox 轮询上限**（`services/transcription.ts:964`）：加最大轮询时长（如 10 分钟）与指数退避，超时标失败。
6. **RN 流式翻译双倍调用**（`:1523`）：`response.body` 不可用的平台直接走非流式路径，不先发流式请求。
7. **baseUrl 拼接统一**（`services/qa.ts:39`）：抽 `resolveOpenAICompatibleUrl(base, path)` 工具（容忍尾部 `/` 与 `/v1` 后缀），transcription/qa/tts/model-catalog 四处统一调用。
8. **Gemini 密钥改 header**（`qa.ts:527` 及同类）：`?key=` 改为 `x-goog-api-key` 请求头。
9. **TTS 超时与文件清理**（`services/tts.ts:313`、`app/(tabs)/text-to-speech.tsx:268`）：`synthesizeSpeech` 默认 60s AbortSignal；删除 TTS 消息/会话时删除对应 `documentDirectory/tts/` 文件；启动时清理无引用的孤儿文件。
10. **qa.ts 死代码**（`:309` 附近约 330 行）：确认交互式问答不在本版本范围后整体删除（含 `answerQuestionWith*`/`extractQuestionsWith*`）；`contextTranscript` 参数要么接入 prompt 要么从签名移除。
11. **secure-storage 对称性**（`services/secure-storage.ts`）：SecureStore 写成功后删除同 key 的 AsyncStorage 回退副本；`secureRemoveItem` 无条件同时删两处；读路径在 SecureStore 返回 null 时不再读回退（避免旧明文复活），配一次性清理。

### Pro 授权闭环
12. **可信时间自愈**（`services/pro.ts:369, 454, 530`）：pro.tsx 接入已备好文案键的"联网校时"按钮；`needs_time_sync`/`TIME_ROLLBACK` 状态下自动触发一次后台校时；公钥加载失败不做永久错误缓存（失败后允许重试）。
13. **first_use 绑定模式**（`scripts/gen-pro-licenses.sh:116`）：二选一并保持两端一致——客户端实现 first_use（首次激活时绑定 deviceUid 并回写存储），或脚本默认改为 device 绑定模式并在 README 注明。

### UI 性能与体验
14. **长列表虚拟化**（`app/(tabs)/transcription.tsx:1957` 等）：历史列表与消息列表由 ScrollView+map 改为 `FlatList`（配 `keyExtractor`、`getItemLayout` 可行处），实时窗格自动滚动改为"仅当用户位于底部时 scrollToEnd"（`:1939`）。
15. **键盘避让**（`:2226`）：助手输入区与重命名弹窗包 `KeyboardAvoidingView`（平台分支行为），滚动容器补 `keyboardShouldPersistTaps="handled"`。
16. **历史写放大**（`:803, 813`）：persist effect 加 500ms debounce + 卸载时 flush（在 P0-2 的 `history-storage.ts` 内实现）；按 key 拆分存储（树结构与会话内容分 key）作为 0.3.5 事项记录，不在本批强推。

### 依赖与产物
17. **移除未使用依赖**（`package.json:67, 75, 115`）：`@shopify/react-native-skia`、`victory-native`、`@lobehub/icons-rn` 源码零引用，直接移除并重装锁文件。
18. **桌面更新通道**（`latest.json`）：0.3.4 决策——要么接入 electron-updater + 签名产物并让 `latest.json` 真实生效，要么本版本删除该空文件并在发布说明中注明桌面端需手动升级。不允许保留"看似有更新机制实则为空"的状态。

---

## P3 — 低危（随下一迭代，逐项一句话方案）

- `transcription.ts:1684`：摘要输入 `'\n'` 字面转义改真实换行。
- `transcription.ts:638`：构造脱敏 RegExp 前对 key 做 escape（或改用 `split(key).join(mask)`）。
- `contexts/transcription-context.tsx:1953`：静音触发 commit 后 `return`，避免同 tick 二次 commit。
- `contexts/transcription-context.tsx:911`：`replaceMessages` 的取消带 `markMessagesFailed: true`，避免 translation 永久 pending。
- `services/rate-limiter.ts` / `error-handler.ts`：删除无人使用的配置与导出，或接入转写主链路（二选一，建议先删）。
- `services/input-validation.ts:126`：放宽 API key 字符白名单（允许 `.` 等，覆盖 JWT/GLM 风格）。
- `services/tts.ts:325, 430`：OpenAI TTS 错误脱敏对齐 Gemini 路径；PCM 回退解析 mimeType 采样率。
- `services/realtime-audio.web.ts:144`：AudioWorklet 加载纳入 `ready`，避免丢起始音频。
- `ios RealtimeAudioModule.swift:124`：降采样加低通（或用 AVAudioConverter）。
- `electron/main.js:167, 251, 267`：`app://` 路径校验用 `path.relative` 判定；生产版禁 DevTools 快捷键；`will-navigate` 白名单改按 origin 比较。
- `app/(tabs)/transcription.tsx:2898`：导出时间戳分号改冒号；`:2629` 菜单按钮 accessibilityLabel 修正。
- `components/context-menu.tsx:349`：菜单项 key 改用稳定 id 而非 label。
- i18n 杂项：`{{count}} models` 加复数形式；pro.tsx 到期时间用 `Intl.DateTimeFormat(i18n.language)`；"Copy device UID" 标签本地化；iOS 麦克风权限文案 6 语言（app.json `infoPlist` 各语言 `NSMicrophoneUsageDescription`）。
- 仓库卫生：删除/忽略 `soniox.js`、`KeyboardStickyInput.*`、`canvas/`、`output/`、`plans/promo` 类无关文件；`explore/` 重定向别名评估是否保留；macOS 桌面包补图标。
- `services/history-tree.ts:164, 267`：sanitize 校验消息必备字段；normalize 校验 parentId 必须指向 folder。
- `contexts/settings-context.tsx:357`：持久化失败在生产环境也上报（toast），写入串行化。
- `components/settings/settings-form.tsx:183`：表单重置仅在非编辑态触发。

---

## 回归防护（与 P0/P1 同批落地）

1. **新增测试**（`bun test`）：
   - `history-storage`：v2→v3 迁移、v3 往返无损、损坏 JSON 不覆写、备份恢复（覆盖 P0-2/P1-2）。
   - `history-tree`：补 `deleteHistoryNode` 级联删除与损坏数据 sanitize/normalize 用例。
   - `pro`：存储篡改 → invalid（P1-10）。
2. **check-i18n 强化**：键对齐 + 插值一致性（P1-11），接入现有验证命令序列。
3. **ESLint**：禁止直接 `import { Alert } from 'react-native'`（P1-4）；禁止组件体内定义组件（`react/no-unstable-nested-components`，防 P1-6 回归）。

## 发布判定标准

- P0 全部完成 + P1 全部完成 + 回归防护落地 + 以下手工回归通过，方可发布 0.3.4：
  - iOS/Android/Electron 三端：录音 → 分段转写 → 翻译 → 摘要 → QA → 历史切换 → 朗读页往返 → 删除（带确认）全流程。
  - Android 锁屏实时录音 2 分钟不静音；iOS 来电中断后正确报错/恢复。
  - Electron：右键菜单、删除确认弹窗、错误弹窗全部可见。
- P2 未完成项与全部 P3 记入 0.3.5 里程碑，不阻塞发布，但 P2-18（更新通道）必须在发布前做出明确决策。
