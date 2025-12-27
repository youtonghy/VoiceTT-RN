# VoiceTT

[中文](README.md) | [English](README.en.md)

## 中文

### 软件介绍

VoiceTT 是一个「转写优先」的跨平台语音助手应用（Expo / React Native）。它支持实时录音与转写，并可按需对内容进行翻译、摘要与问答提取，同时提供可检索的历史会话，方便回放与整理要点。

适用场景包括会议/访谈/课堂记录等。使用前请确保已获得相关人员的录音与处理许可，并遵守当地法律法规与第三方服务条款。

### 功能介绍

- 实时录音与分段转写，支持多种转写引擎（可在设置中切换）
- 可选翻译（按目标语言配置），支持多种翻译引擎
- 会话级标题/摘要生成，辅助快速回顾要点
- QA（问答/要点提取）能力：对已完成的转写片段进行自动或手动分析
- 历史会话：按日期分组、搜索、切换会话与继续记录
- 凭证管理：API Key/Base URL/模型名等以加密存储（Web 端会降级为非加密存储）
- 国际化（i18n）：基于 `i18next`，本地化资源位于 `src/locales`

### 软件架构

- **UI / 路由层**：`app/` 使用 Expo Router（文件路由）；页面主要集中在 `app/(tabs)`（转写、QA、设置）
- **状态与交互层**：`contexts/` 通过 React Context 管理应用设置、会话与转写状态；`hooks/` 提供设备与主题相关能力
- **领域与服务层**：`services/` 封装转写、翻译、摘要、QA、速率限制、错误处理与输入校验等业务逻辑
- **数据与存储层**
  - 设置与历史会话：主要使用 `AsyncStorage`（例如 `@agents/history-conversations`；默认不加密）
  - 凭证：`services/secure-storage.ts`（移动端 `expo-secure-store`，Web 端回退到 `AsyncStorage`，不加密）
- **典型数据流**
  1. `expo-audio` 采集音频 → 生成音频片段
  2. `services/transcription.ts` 负责调用所选引擎完成转写
  3.（可选）翻译 →（可选）摘要/QA → 写入会话历史并在 UI 展示

### 快速开始

```bash
npm install
npx expo start
```

在应用内进入 Settings → Credentials 配置各类引擎所需的 API Key / Base URL / 模型名。

### 桌面版（Windows/macOS + Electron）

本仓库使用 Expo Web 构建产物作为 Electron 的渲染层。

开发模式（启动 Expo Web + Electron）：

```bash
npm install
npm run desktop:dev
```

静态构建与预览：

```bash
npm run desktop:build
npm run desktop:start
```

如需自定义端口，可设置 `EXPO_WEB_PORT`（默认 19006）。

### 免责声明

- 本项目按“现状”提供，不对适用性、稳定性、准确性或特定用途作任何保证；使用风险由使用者自行承担。
- 转写/翻译/摘要/问答可能存在错误或遗漏；请勿将输出用于医疗、法律、金融等高风险决策场景的唯一依据。
- 录音与内容处理可能会调用第三方服务（取决于你选择的引擎与配置），并产生费用、配额消耗或数据出境等风险；请在使用前阅读并遵守相关服务条款与隐私政策。
- 设置与历史会话默认存储在本地设备（`AsyncStorage`），可能不加密；请妥善保护设备与系统备份，避免敏感信息泄露。
- 你必须在合法合规且取得授权的前提下录音与处理内容；因违规使用导致的任何后果由使用者自行承担。
