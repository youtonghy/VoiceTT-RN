# AGENTS Development Guidelines

## Purpose & Scope
- Align Android and iOS teams on UX, architecture, and operational standards for the multimodal transcription, translation, summarization, and history playback app.
- Apply to client apps and any shared core modules; keep feature parity across platforms.

## Product Pillars
- **Transcription First**: Real-time capture with diarization when available.
- **Translation Ready**: Manual or auto-triggered translation per locale settings.
- **Summarization Insight**: On-demand summaries at session, highlight, and action-item levels.
- **History Access**: Persistent, searchable call history with fast retrieval.

## Platform & Execution
- Ship Android (API level TBD) and iOS (minimum version TBD) in lockstep.
- Respect background policies: Android foreground service with notification; iOS Background Modes with energy impact monitoring.
- Keep business logic in a platform-agnostic core (e.g., KMP or Flutter/Dart) where feasible; adapt UI per platform conventions.
- Maintain Electron parity with React Native: every new feature must work on both desktop and mobile targets.
- Ensure input parity across touch and keyboard/mouse; translate gestures appropriately (e.g., long-press on touch = right-click on desktop).

## Design System & Layout
- Use Material Design 3 components; Android must support Monet dynamic color extraction.
- Provide a theming bridge that maps Material tokens to iOS equivalents while following HIG.
- Favor component-level style modules over global overrides; expose tokens for typography, spacing, and shape.
- Transcription surface uses swipeable cards: live capture first, history second, grouped by day with search/add controls and no inline preview panes.
- Supply metadata to allow rearranging UI assemblies (atoms → molecules → organisms) and document extension points for third-party skins.

## Architecture & Data Flow
- Layered structure: data → domain → presentation; keep business rules out of UI controllers.
- Prefer reactive pipelines (coroutines/Flow, Combine) to coordinate transcription, translation, and summaries.
- Encapsulate long-running work in background workers with pause/resume APIs.
- Persist transcripts, translations, and summaries in encrypted storage; sync to cloud only with explicit consent.
- Keep per-conversation transcript stores to prevent cross-session leakage when switching history entries.

## Internationalization
- All source code, identifiers, and comments remain in English.
- Localize via resource bundles/language files; default to UTF-8 everywhere.
- Maintain tooling for missing-translation detection and fallback verification.

## Data, Privacy, & Security
- Require explicit user permissions for microphone, background processing, and cloud sync.
- Encrypt sensitive data in transit and at rest; publish retention and deletion controls.
- Default to non-PII analytics; gate additional telemetry behind opt-in.

## Quality Bar
- Automated regression suites for transcription accuracy, translation correctness (golden datasets), summarization quality, and history queries.
- Cross-platform UI tests validate Material Design 3 usage and Monet palette mapping.
- Integration coverage for background scenarios (e.g., incoming call, low battery, network loss).

## Delivery & Ops
- CI must enforce linting, formatting, tests, and localization completeness on every merge.
- Release artifacts document feature readiness, known issues, and localization coverage.
- Track runtime performance (CPU, memory, battery) and transcription latency with platform SLAs.

## Collaboration & Governance
- Maintain a single roadmap with shared Android/iOS milestones.
- Record architectural decisions in ADRs linked from this document.
- Review product, design, and engineering updates weekly; flag risks early.
