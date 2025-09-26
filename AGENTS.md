# AGENTS Development Guidelines

## Purpose
- Define cross-team expectations for building the multimodal language transcription application with translation, summarization, and history playback capabilities.
- Align Android and iOS efforts on UX, architecture, and operational standards.

## Product Pillars
- **Transcription First**: Real-time speech-to-text capture with accurate diarization where possible.
- **Translation Ready**: Seamless translation pipeline for supported locales, triggered manually or automatically per user settings.
- **Summarization Insight**: Multi-granularity summaries (session, highlight, action items) generated on demand.
- **History Access**: Persistent, queryable call history with secure storage and fast retrieval.

## Platform Targets
- Android (minimum API level TBD) and iOS (minimum iOS version TBD) ship in lockstep feature parity.
- Background execution must comply with each platform's policies (Android foreground service + notification, iOS Background Modes entitlement and energy impact monitoring).
- Shared business logic should live in a platform-agnostic core (e.g., Kotlin Multiplatform or Flutter/Dart) when feasible; platform-specific UI layers adapt native patterns.

## Design System
- Adopt Material Design 3 components and interaction patterns across platforms; ensure Android supports Monet dynamic color extraction from system palettes.
- Provide a theming abstraction that maps Material tokens to iOS equivalents while respecting Human Interface Guidelines.
- Use component-level style modules; avoid global overrides. Each component exposes tokens for typography, spacing, and shape to allow rearranging and future customization.

## Architecture
- Layered approach: data -> domain -> presentation. Keep clear separation between business rules and UI controllers.
- Favor reactive data flows (e.g., coroutines/Flow, Combine) to coordinate transcription streams, translation outputs, and summaries.
- Background workers encapsulate long-running tasks; expose APIs to pause/resume without losing context.
- Persist transcripts, translations, and summaries in encrypted storage; synchronize to cloud services only with explicit consent.

## Internationalization
- All source code, identifiers, and comments use English only.
- Deliver localization via resource bundles/language files; default to UTF-8 encoding throughout the project to avoid mojibake.
- Provide tooling to validate missing translations and fallback logic.

## Styling & Layout Modules
- Build UI assemblies from atomic components (atoms, molecules, organisms) that can be reordered through configuration.
- Encapsulate layout rules per module; do not hard-wire positions in shared code. Supply metadata that enables user-driven rearrangement.
- Document extension points so third-party skins or corporate themes can plug into the style system safely.

## Data & Privacy
- Obtain explicit user permissions for microphone access, background processing, and cloud sync.
- Encrypt sensitive records in transit and at rest. Provide clear retention policies and user-controlled deletion.
- Log only non-PII analytics by default; gate additional telemetry behind opt-in.

## Quality Expectations
- Automated regression tests for transcription accuracy, translation correctness (golden datasets), summarization quality, and history queries.
- Cross-platform UI tests to ensure Material Design 3 compliance and Monet palette mapping.
- Background execution scenarios covered in integration suites (e.g., incoming call, low battery, network loss).

## Delivery & Ops
- Continuous integration verifies linting, formatting, tests, and localization completeness on every merge.
- Release artifacts must document feature readiness, known issues, and localization coverage.
- Monitor runtime performance (CPU, memory, battery) and transcription latency; set SLAs per platform.

## Collaboration
- Maintain a single roadmap with shared milestones for Android and iOS.
- Capture architectural decisions in ADRs linked from this document.
- Review product, design, and engineering updates weekly; surface risks early.

