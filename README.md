# VoiceTT (Expo)

VoiceTT is a multimodal transcription-first client built with Expo Router. It captures voice, runs translation and summarization pipelines, and keeps a searchable history so users can review, ask questions, and sync insights later.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

The output includes options for a development build, Android emulator, iOS simulator, or Expo Go. You can start developing by editing files inside the `app` directory (file-based routing is enabled).

## Page structure

- **Tab layout** (`app/(tabs)`): bottom navigation with Transcription, QA, and Settings.
- **Transcription** (`app/(tabs)/index.tsx`):
  - Live capture card: recording toggle plus streaming transcript bubbles, with translations when available.
  - History card: day-grouped conversation list with search, add-new, and active conversation switching.
  - Assistant card: shows the active conversation summary and a chat composer with voice insert, send, cancel, and retry actions.
- **QA** (`app/(tabs)/qa.tsx`): runs automatic or manual QA extraction for completed transcript segments; shows per-segment Q&A, analysis status, and errors.
- **Settings** (`app/(tabs)/explore`):
  - Landing: Pro promo card, about links, and entry points for recording, voice input, transcription, translation, summary, QA, and credentials.
  - Recording: acoustic thresholds/durations plus custom preset save, apply, and delete.
  - Voice Input: choose the voice input engine.
  - Transcription: choose transcription engine and source language.
  - Translation: toggle translation and choose translation engine.
  - Summary: configure title and conversation summary engines, models, and prompts.
  - QA: configure QA engine, models, and prompts.
  - Credentials: manage API keys, base URLs, and model names for OpenAI, Gemini, Qwen, Doubao, and GLM.
