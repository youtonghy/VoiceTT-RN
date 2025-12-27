# VoiceTT

[中文](README.md) | [English](README.en.md)

## English

### Introduction

VoiceTT is a transcription-first, cross-platform voice companion app built with Expo / React Native. It records audio, produces live transcripts, and can optionally run translation, summarization, and Q&A extraction. It also keeps a searchable conversation history for review and playback.

Before using it, make sure you have consent to record/process audio and comply with local laws and any third-party service terms.

### Features

- Live recording and segmented transcription with switchable engines (configured in Settings)
- Optional translation with configurable target language and engines
- Conversation-level title/summary generation for fast review
- QA extraction: automatic or manual analysis for completed transcript segments
- History browsing: day grouping, search, conversation switching, and continuing sessions
- Credentials management: API keys/base URLs/model names stored securely (falls back to unencrypted storage on web)
- Internationalization (i18n) via `i18next`, locale resources in `src/locales`

### Architecture

- **UI / Routing**: `app/` uses Expo Router (file-based routing); primary screens live under `app/(tabs)` (Transcription, QA, Settings)
- **State & Interaction**: `contexts/` manages settings, conversations, and transcription state via React Context; `hooks/` provides device/theme helpers
- **Domain & Services**: `services/` encapsulates transcription/translation/summary/QA logic plus rate limiting, error handling, and input validation
- **Data & Storage**
  - Settings & conversation history: primarily stored in `AsyncStorage` (for example `@agents/history-conversations`; unencrypted by default)
  - Credentials: `services/secure-storage.ts` (`expo-secure-store` on mobile, `AsyncStorage` fallback on web, unencrypted)
- **Typical flow**
  1. Capture audio via `expo-audio` -> create audio segments
  2. Run transcription through the selected engine (`services/transcription.ts`)
  3. (Optional) translation -> (optional) summary/QA -> persist into history and render in UI

### Getting Started

```bash
npm install
npx expo start
```

Configure engine API keys / base URLs / model names in Settings -> Credentials.

### Desktop (Windows/macOS + Electron)

This repo uses the Expo web build as the Electron renderer.

Dev mode (Expo Web + Electron):

```bash
npm install
npm run desktop:dev
```

Static build + preview:

```bash
npm run desktop:build
npm run desktop:start
```

Set `EXPO_WEB_PORT` to override the dev server port (default 19006).

### Disclaimer

- This project is provided "as is" without warranties of any kind. You assume all risks when using it.
- Transcription/translation/summaries/Q&A may be inaccurate or incomplete. Do not rely on outputs as the sole basis for medical, legal, financial, or other high-stakes decisions.
- Depending on selected engines and configuration, audio/text processing may call third-party services and may incur costs, quota usage, or data transfer risks. Review and comply with the applicable terms and privacy policies.
- Settings and conversation history may be stored locally on the device (via `AsyncStorage`) and may not be encrypted. Protect your device and backups accordingly.
- You are responsible for obtaining consent and using the app in compliance with laws and regulations. The maintainers are not liable for misuse.
