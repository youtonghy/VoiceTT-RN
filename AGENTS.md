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

- Use HeroUI Native as the default React Native UI layer; Android should still respect Material-friendly spacing, density, and dynamic color goals where applicable.
- Provide a theming bridge that maps Material tokens to iOS equivalents while following HIG.
- Favor component-level style modules over global overrides; expose tokens for typography, spacing, and shape.
- Transcription surface uses swipeable cards: live capture first, history second, grouped by day with search/add controls and no inline preview panes.
- Supply metadata to allow rearranging UI assemblies (atoms → molecules → organisms) and document extension points for third-party skins.

## Frontend Component Usage

- Treat `heroui-native` and `heroui-native-pro` as two separate native libraries. Use `heroui-native` for base UI such as `Button`, `Card`, `Text`, `TextField`, `Input`, `Select`, `Switch`, `Tabs`, `ScrollShadow`, `Separator`, `Spinner`, `Dialog`, and `Toast`. Use `heroui-native-pro` only for Pro-only components such as `Stepper`, `ProgressButton`, `SlideButton`, `NumberField`, `NumberStepper`, `RadioButtonGroup`, and native date/time components.
- Before changing or adding HeroUI components, fetch current docs from the matching MCP server: `heroui-native` for base components and `heroui-native-pro` for Pro components. Always call `list_components` first, then `get_component_docs` for the exact component names. For React Native APIs such as `ScrollView`, `KeyboardAvoidingView`, or `Pressable`, use Context7 before implementation.
- Never use web HeroUI packages or web patterns in this project. Do not import from `@heroui/react`, `@heroui-pro/react`, or web CSS files inside React Native screens. Use React Native primitives (`View`, `ScrollView`, `Pressable`, `TextInput`) and Native event handlers such as `onPress`, not DOM elements or `onClick`.
- Prefer `className` with Uniwind semantic tokens on HeroUI Native components and React Native containers. Use tokens such as `bg-background`, `bg-surface`, `bg-surface-secondary`, `border-border`, `text-foreground`, `text-muted`, `bg-accent`, and `text-accent-foreground`. Avoid raw color styling unless bridging a legacy `StyleSheet` section or platform API that cannot consume Uniwind classes.
- Follow HeroUI compound anatomy instead of flattening component APIs. Examples: use `Card.Header`, `Card.Body`, `Card.Title`, and `Card.Description`; use `Button.Label` when composing button contents; use `Text.Heading`, `Text.Paragraph`, and supported `Text` `type` / `weight` values instead of guessing unsupported variants.
- Keep `Select` presentation consistent. `Select` root and `Select.Content` must use the same `presentation` value (`popover`, `dialog`, or `bottom-sheet`). For platform-specific selects, compute the presentation once and pass the same value to both root and content. Use `Select.Portal`, `Select.Overlay`, `Select.Trigger`, `Select.Value`, `Select.Item`, `Select.ItemLabel`, and `Select.ItemIndicator` according to the documented anatomy.
- For switch controls, use HeroUI Native `Switch` with `isSelected` and `onSelectedChange`. Do not mix the React Native core `Switch` API (`value`, `onValueChange`) into HeroUI Native `Switch`.
- For horizontally switching between providers, engines, tabs, or compact cards, use a horizontal `ScrollView` with `showsHorizontalScrollIndicator={false}` and a padded content container. Keep each option card a stable width and expose `accessibilityRole`, `accessibilityState.selected`, and disabled state where relevant.
- Settings pages should reuse shared settings components before creating one-off layouts. Put reusable settings-specific primitives under `components/settings/` and app-wide native primitives under `components/native/`. Keep provider/model selection pages visually aligned with the Credentials pattern: horizontal provider cards, one active detail card, model `Select` dropdowns, and explicit refresh/loading states for remote model catalogs.
- Keep form screens keyboard-safe with `KeyboardAvoidingView`, platform-aware behavior, `keyboardDismissMode="on-drag"`, and `keyboardShouldPersistTaps="handled"` on scroll containers. Long option lists inside modals or selects must be scrollable and height-limited.
- Maintain Electron parity for every UI control. Touch-only gestures need a keyboard/mouse equivalent; long-press menus should also be reachable by right-click where the surrounding screen supports desktop interaction.
- Do not create nested cards or stack decorative containers inside cards. Use cards for individual repeated items, detail panels, and modals; use simple `View` layout, separators, tabs, or scroll strips for structure around them.
- Keep text and controls localized. Do not add visible user-facing strings directly in source files unless they are already locale keys or non-user-visible debug labels. Run the i18n check after adding UI text.
- After frontend component changes, run at minimum `bun run lint`, `bunx tsc --noEmit --pretty false`, `bun run check:i18n`, and `git diff --check`. Use the in-app browser or platform preview for layout changes that affect visible screens.

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
- Before modifying any code, use context7 to obtain the latest documentation and specifications to ensure compliance with the latest requirements.

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
