# Code Quality Cleanup - 2026-04-30

Scope: careful, low-risk cleanup pass across deduplication, type consolidation, dead code, circular dependencies, type strengthening, error handling, and deprecated/AI artifact cleanup.

## Implemented High-Confidence Fixes

- Removed confirmed unused files:
  - `components/Login_new.tsx`
  - `pages/DashboardPage.tsx`
  - `src/ai/queue/examples.ts`
  - `components/Analytics.tsx`
  - `components/OpenFinance.tsx`
  - `components/SpendingAlerts.tsx`
  - `hooks/useCashFlowState.ts`
  - `src/events/financialEventStream.ts`
  - `src/runtime/index.ts`
- Removed an unused version-mismatch notification helper from `src/runtime/versionGuard.ts`.
- Removed the dead `enableAutoReload` runtime config field from the runtime guard contract and bootstrap.
- Fixed AES-GCM envelope handling in `src/services/security/encryptionService.ts` so encryption and decryption now use a real IV.
- Added regression coverage for runtime guards and encrypted storage round-trips.
- Removed dead cache-version and cache-clearing exports from `src/runtime/serviceWorkerGuard.ts`.
- Removed the legacy `initChunkGuard` alias and unused `resetChunkErrorCount` export from `src/runtime/chunkGuard.ts`.
- Removed the orphaned `scripts/activate-sentry.mjs` deployment helper.
- Removed the dead `public/index.css` asset and two unused `src/security` helpers:
  - `src/security/reconciliationEngine.ts`
  - `src/security/transactionIntegrity.ts`
- Replaced silent goal storage/cloud sync fallbacks in `src/finance/goalService.ts` with warnings.
- Removed the unused goal persistence pair `src/finance/goalService.ts` and `models/FinancialGoal.ts` after confirming there were no live imports.
- Removed the orphaned SaaS HTTP adapter module `src/saas/httpAdapters.ts`.
- Removed the unused prediction UI pair `src/components/PredictionChart.tsx` and `src/hooks/usePredictions.ts`.
- Extracted finance categorization type ownership into `src/engines/finance/categorization/categoryTypes.ts`.
- Extracted navigation tab type ownership into `hooks/navigationTypes.ts`.
- Added `subscriptions` to the Firestore sync entity surface so frontend sync matches the backend/local sync contract.
- Replaced silent local sync push/pull catches with warning logs while preserving local-first recovery behavior.
- Replaced erased `any` mapper payloads in `src/utils/typeMappers.ts` with explicit API payload interfaces.
- Replaced local Web Speech API `any` usage in `components/AIInput.tsx` with minimal browser-boundary interfaces.
- Replaced AI queue payload `any[]` arrays with domain arrays in `src/ai/queue/taskTypes.ts` and `src/ai/queue/AITaskQueue.ts`.
- Tightened low-risk UI/local boundary casts in Assistant, Open Finance, Cash Flow, Spending Alerts, Transaction List, Login, Import Transactions, Receipt Scanner, performance monitoring, and autopilot queue handoff.
- Consolidated `FinanceCategory` so categorization schema and finance engine now share one source of truth.
- Removed weak scenario/parser typing in `pages/AIControlPanel.tsx` and fixed parser-safe reminder alias keys in `components/AIInput.tsx`.
- Replaced loose AI response types in `services/geminiService.ts` with explicit `DailyInsight` and `StrategicReport` contracts.
- Tightened Open Banking integration boundaries in `pages/OpenBanking.tsx` and `services/integrations/openBankingService.ts`, including backend sync payloads, Pluggy callback handling, and imported-transaction normalization.
- Replaced queue and memory `any` storage/result boundaries with `unknown` or typed payload contracts in `src/ai/queue/*` and `src/ai/memory/*`.
- Collapsed duplicated sync hydration in `hooks/useSyncEngine.ts`, removed type-erased sync payload coercion, and stopped auto-disabling sync modes on every transient load failure.
- Switched the event pipeline to the canonical `runAIOrchestrator` export and kept the legacy alias only as compatibility glue.
- Replaced remaining silent Open Banking disconnect/account-sync/classification fallbacks with explicit warnings, and made Pluggy availability loading in `pages/OpenBanking.tsx` fail visibly instead of swallowing errors.
- Added visible warnings for auth workspace hydration and Pluggy connect-token creation failures so the bootstrap path no longer fails silently.
- Hardened `hooks/useAuthAndWorkspace.ts` so logout now clears local state even if `signOut()` fails, and development/Firebase login falls back to a local workspace when backend workspace bootstrap fails.
- Simplified `components/Settings.tsx` so billing overview reloads through a single effect-driven path instead of mixing effect and manual reloads, removing a duplicate workspace billing fetch branch.
- Made import-format detection warn when file header inspection fails instead of swallowing the exception.
- Made single-bank sync emit an explicit warning when the underlying sync call fails instead of only returning an error object.
- Made graph-dependent AI helpers warn when optional graph context is unavailable in CFO, autopilot, and insight generation flows.
- Hardened local AI memory and goal hydration writes so storage quota/write failures now warn instead of failing silently.
- Hardened AI memory and local sync reads too, so storage access denial now warns instead of collapsing to empty state without diagnosis.
- Standardized background learning failures in the AI orchestrator and financial hook so each async branch logs with its own context.
- Added storage-key and record-count context to AI memory and task queue persistence failures for faster diagnosis.
- Standardized AI worker task failure logs with task id, task type, retry state, and user context.
- Rewrote `pages/OpenBanking.tsx` in clean UTF-8, removed stale imports and mixed environment branching, and split the page into smaller local UI helpers with clearer Open Banking state transitions.
- Cleaned `models/BankConnection.ts` encoding and catalog text so the Open Banking surface no longer carries mojibake in the shared bank metadata.
- Cleaned remaining mojibake and editorial noise in `components/Login.tsx` and `components/AIInput.tsx`, including the recovery flow, copyright line, review-panel comments, and warning markers.
- Replaced remaining silent `catch {}` paths in `services/integrations/openBankingService.ts` and `src/finance/bankSyncEngine.ts` with explicit warnings while keeping the same recovery behavior.
- Split `services/integrations/openBankingService.ts` into focused state, transform, and error helpers while preserving the public banking API.
- Removed the temporary normalization script used during the Open Banking cleanup pass.

## Track Assessments

### 1. Deduplication

High confidence:
- `components/Login_new.tsx` was a stale duplicate of `components/Login.tsx` with no tracked imports.
- `pages/DashboardPage.tsx` was an unused one-line re-export.
- `src/ai/queue/examples.ts` was demo/example code with no runtime imports.

Deferred:
- Prediction types are duplicated between backend and root shared type files, but backend `tsconfig` currently scopes shared files under `backend/shared`, so consolidating into root `shared/` would require a build contract change.
- Similar policy engines should not be merged blindly because backend authorization is authoritative and has different semantics.

### 2. Type Consolidation

High confidence:
- Sync entity unions had drift: backend/local sync included `subscriptions`, while Firestore sync omitted it.
- `FinanceCategory` still existed in both finance categorization and AI schema modules even after cycle cleanup; both definitions were identical and safe to collapse into the engine-owned type.
- `FinanceCategory` now comes from the engine-owned `categoryTypes.ts` module, while `transactionCategorizer.ts` keeps the public re-export for compatibility.

Deferred:
- Category contracts drift between frontend and backend validation. This is real, but it affects API validation/product data and should be handled in a dedicated contract migration.
- SaaS policy/billing types are inconsistent across frontend/shared/backend; consolidate only with explicit authorization and billing tests.

### 3. Dead Code Removal

Removed only files with no tracked runtime references and no framework routing convention in this Vite app.

Deferred:
- Old Open Finance/Open Banking UI files and legacy Firebase services looked unused, but they touch product surfaces or compatibility paths and need a separate removal decision.

### 4. Circular Dependencies

Resolved:
- Finance categorization type-only cycles.
- Navigation hook/page type-only cycles.

Result:
- App and backend Madge scans report no circular dependencies.

### 5. Type Strengthening

Implemented:
- `src/utils/typeMappers.ts` no longer uses `Partial<Record<string, any>>` or `Record<string, any>` for transaction/account/reminder mapping boundaries.
- `components/AIInput.tsx` now types the speech recognition ref and result event locally.
- `src/ai/queue/taskTypes.ts`, `src/ai/queue/AITaskQueue.ts`, and `src/engines/autopilot/financialAutopilot.ts` now use `Transaction[]`, `Account[]`, and `Goal[]` for known task payloads.
- UI components now use narrower local unions for timeframe, category filters, reminder filters, smart alert categories, institution account types, and handled error objects.
- Browser performance and Web Speech APIs are represented by minimal local interfaces instead of erased `any` casts.
- `pages/AIControlPanel.tsx` now narrows simulation scenario transitions explicitly, keeps the month-based scenario typed without `any`, stores parser results as `Transaction[]`, and uses `unknown`-safe parser error handling.
- `services/geminiService.ts` now exposes stable app-level AI contracts instead of leaking `any[]` and `any` through diagnostics, insights, and strategic report flows.
- Open Banking sync now treats backend transaction payloads, imported transactions, and normalized drafts as separate shapes instead of coercing them together.
- AI queue/task result and AI memory persistence now treat dynamic payload/result/value data as `unknown` unless a specific contract is established.
- Backend observability telemetry now normalizes environment/sourceSystem values and treats decorator args and metadata as typed unknowns instead of `any`.
- Clinic automation envelope mapping now uses the exhaustive event type directly in the unsupported-case error path instead of an `as any` escape hatch.
- Clinic idempotency storage now uses a typed record contract and ignores malformed Redis payloads instead of returning unvalidated `any`.
- Clinic audit middleware now reads response/request bodies through unknown-safe guards instead of assuming `any`.
- Prediction route snapshot hydration now normalizes factors and daily predictions explicitly instead of casting Firestore payloads through `unknown as`.
- Clinic controller payload ingestion now validates the webhook schema before touching the service layer.
- Shared JSON parsing and Sentry helpers now use `unknown`-based contracts instead of `any`.
- Express request locals and SaaS state persistence no longer rely on `any` for their shared utility types.
- Client Sentry environment resolution and OCR fallback loading no longer use `unknown as` casts at runtime boundaries.
- Storage provider selection now normalizes unsupported values instead of relying on a cast.
- File existence checks in cloud storage now narrow unknown errors before special-casing missing keys.
- External idempotency store now validates persisted JSON shape before using it.

Deferred:
- Several `any` clusters remain legitimate targets, especially prediction routes and AI worker result plumbing, but they touch financial/API payload interpretation or open-ended async results and deserve focused tests before replacement.
- `unknown` at JSON/request/provider boundaries is mostly correct and should not be weakened into speculative rigid types.
- `src/finance/importService.ts` was rechecked in UTF-8 and the visible mojibake was terminal rendering only; no source cleanup was needed in this pass.

### 6. Error Handling Cleanup

Implemented:
- Local sync failures are no longer silent; they log context while keeping local-first retry behavior.
- SaaS billing hook persistence and hydration now warn explicitly instead of swallowing JSON/localStorage failures.
- Cloud goal hydration now warns when cached local state cannot be parsed during merge.
- AI memory, backend session parsing, and generic storage helpers now warn on persistence/parse failures instead of failing silently.
- Adaptive learning stats, runtime platform detection, and receipt text extraction now warn on boundary failures instead of disappearing silently.
- API request parsing and workspace recovery now warn when the backend response or recovery path fails to parse cleanly.
- Receipt date parsing no longer uses a silent try/catch around deterministic date construction.
- Transaction list storage parsing and AI queue listener enqueue failures now warn explicitly instead of failing silently.
- Settings AI support fallback and AICFO response fallback now log explicit errors before showing user-safe text.
- Backend AI insights now return a visible diagnostic daily fallback when the provider response is malformed or unavailable, instead of surfacing an empty insight list.
- Import parsing now uses safe date construction in both the service and PDF fallback path, so malformed statement dates do not abort the import pipeline with a `RangeError`.
- CashFlow now converts an unexpected strategic-report generation failure into a visible diagnostic fallback instead of only logging the error.
- Assistant reminder scheduling now falls back safely when the composed date/time is invalid instead of throwing on `toISOString()`.
- AI support modal flow now has regression coverage for the fallback path in Settings.
- API guard now warns on malformed backend URLs, and receipt base64 validation no longer hides exceptions behind a dead catch.
- Version guard, AI debug storage, OCR fallback loading, and shared storage helpers now warn explicitly instead of swallowing parse and persistence failures.
- Backend CORS parsing, AI token estimation fallback, Stripe webhook parsing, finance event flushing, idempotent event storage, and SaaS store loading now emit warnings instead of silent catches.
- Default dev bootstrap now falls back to in-memory SaaS usage tracking when Firestore bootstrap fails, and backend-only sync no longer touches Firestore adapters.
- Billing and usage stores now reject incomplete workspace context early instead of surfacing opaque Firebase errors later in the flow.
- Settings no longer loads workspace billing from Firestore when cloud sync is disabled, so the local/backend path stays free of unnecessary cloud calls.
- Settings now has regression coverage proving the cloud billing path is skipped entirely when `cloudSyncEnabled` is false.
- Settings now reloads billing data when cloud sync is re-enabled, so the panel can recover without remounting.
- Settings now reloads billing data when the active workspace changes, so billing does not get stuck on a previous workspace.
- Workspace change handling now skips cloud workspace refreshes while cloud sync is disabled, preventing backend-only login from re-entering Firestore.
- `useAuthAndWorkspace` now has regression coverage proving workspace-change events stay local when cloud sync is disabled.
- Workspace Admin and Workspace Audit now short-circuit to cloud-disabled notices instead of loading Firestore when sync is off.
- Workspace Admin and Settings now avoid duplicate reloads when workspace switches are already being handled manually.
- Workspace Session now exposes a single workspace-context loader, and Settings uses it to avoid double-reading workspace lists before billing overview loading.
- Workspace Admin and Workspace Audit now use the same workspace-context loader instead of re-reading the workspace session through separate call paths.
- Settings, Workspace Admin, and Workspace Audit now let the workspace-context loader resolve identity internally instead of calling the identity resolver first.
- The workspace session now has a single source of truth: `loadWorkspaceContext()` resolves identity, workspace summaries, and fallback workspace creation in one place.
- The workspace-session compatibility helpers `ensureActiveWorkspace()` and `listUserWorkspaces()` were removed after all runtime consumers moved to `loadWorkspaceContext()`.
- Settings now clears stale billing state before a workspace reload finishes, so the panel does not momentarily keep the previous workspace's plan visible.
- Workspace Admin now clears stale members, audit events, billing hooks, and billing catalog data before reloading a new workspace.
- The internal workspace-store helper `ensureActiveWorkspaceForUser()` was removed after `loadWorkspaceContext()` started creating the fallback workspace directly.
- Encryption service now preserves a readable development fallback under the encrypted key prefix when encryption fails, instead of writing to an orphan key that the reader never sees.
- Local sync goal hydration now treats blocked localStorage reads and writes as recoverable failures, and the empty-cloud path now records the pull marker through the same safe storage wrapper.
- Local sync goal hydration now also skips malformed cached goal records instead of crashing on bad localStorage array items during cloud merge.
- Receipt Scanner date editing now falls back safely when OCR or manual input produces an invalid date instead of throwing on `toISOString()`.
- Local sync goal hydration now validates cached record shapes before merging, so malformed array items in `flow_financial_goals` are skipped instead of crashing the merge.
- CashFlow now validates stored strategic-report payloads before rendering, so legacy JSON with the wrong shape is ignored instead of being trusted through a cast.
- TransactionList now validates the stored category filter and falls back to `Todas` when the saved value is not a known category.
- Receipt Scanner now normalizes OCR dates before the review form opens, so invalid scan dates do not leak into the editable date field.
- AI memory storage now validates persisted record shapes before returning them, so malformed localStorage items are skipped instead of polluting the profile or crashing consumers.
- TransactionList now validates stored sort configuration values and falls back to the default ordering when the saved key or direction is not recognized.
- Billing hook persistence now validates stored payloads before reading or appending them, so invalid legacy localStorage entries are skipped instead of poisoning the hook log.
- Shared `getFromStorage()` now rejects JSON values whose basic type does not match the provided default, instead of trusting any parsed payload shape.
- Open Banking disconnect and full-sync account-step failures now warn with operation, connection id, status code, request id, and message while preserving the existing tolerant local flow.
- Open Banking now shows visible Pluggy loading diagnostics when health, connector listing, or connect-token creation fails.
- The Pluggy loading error block now exposes an explicit retry action so the user can reopen the flow without refreshing the whole page.
- Open Banking connection-list reload failures now warn and surface a visible UI diagnostic instead of failing behind an unhandled async refresh.
- The connection-list reload error block now exposes a retry action so the user can re-run the refresh from the same screen.
- The reload error block now reuses the provider recovery hint, so mock/configuration issues are explained instead of leaving a generic retry dead end.
- Opening the add-bank flow now clears stale reload errors, so a list refresh failure does not leak into the add flow.
- Open Banking user actions now surface unexpected individual sync/disconnect rejections visibly, and the disconnect icon button has an accessible action label.
- Open Banking bulk sync now reports when every listed connection is in error instead of returning silently without attempting a sync.

Deferred:
- Provider-specific Open Finance recovery flows still need a dedicated product pass after the now-visible generic failure states.

### 7. Deprecated Code And AI Artifacts

Removed:
- Unused demo/example queue file.
- Stale duplicate login component.

Deferred:
- TODOs in AI/clinic integration code reflect unfinished product work, not confirmed obsolete code.

## Validation

- `npm run type-check:app`
- `npm run lint`
- `npx madge --circular --extensions ts,tsx,js,jsx --ts-config tsconfig.app.json App.tsx index.tsx components hooks pages services src utils models`
- `npm test`
- `npm run build`

- Workspace Admin monthly usage summary now uses ASCII separators to avoid mojibake in the billing panel.
- AI narrative files `financialAutopilot` and `insightGenerator` were normalized back to readable UTF-8 text, keeping the graph fallback warnings visible instead of silent.
- `generateStrategicReport` now returns a diagnostic fallback for malformed payloads instead of leaking `null` into the strategic AI panel.
- CashFlow now ignores malformed stored strategic reports instead of failing during localStorage hydration.
- Autopilot now uses a real restore-label for dismissed actions and no longer carries dead refresh state that did not recompute anything.
- Goals now skip invalid deadlines instead of rendering `Invalid Date` in the goal card.
- AdvancedAnalytics now ignores invalid transaction dates before sorting and chart projection, so corrupted history cannot poison chart labels or the 30-day forecast.
- Autopilot now labels its restore button honestly and no longer keeps dead refresh state that implied a recomputation.
- Goals contribution modal now clears the amount draft on open and close, so a stale contribution value does not leak into the next session.
- Goals contribution and creation inputs now parse pt-BR decimal commas correctly instead of relying on browser number fields.
- Goals deadline rendering now skips invalid dates instead of showing `Invalid Date`.
- Goals contribution input now uses a text decimal field, so comma-based BRL amounts are accepted consistently.
- Accounts new-account form now resets its draft on open and close, so stale balance/name values do not leak into the next creation session.
- Accounts now parses pt-BR money input for the initial balance instead of truncating comma decimals.
- AICFO user-message timestamps now render with a safe fallback when legacy or malformed values show up in the chat bubble.
- WorkspaceAudit now renders a safe fallback when an audit event has a malformed timestamp, instead of surfacing `Invalid Date`.
- AICFO conversation timestamps now use a safe fallback formatter for malformed legacy message timestamps.
- Dashboard calculations now ignore invalid transaction and reminder dates instead of letting malformed data contaminate month and overdue totals.
- CSV import normalization now preserves signed negative amounts while exposing a positive amount field for downstream categorization and UI.
- Assistant smart alerts now warn when the API returns an incompatible payload and fall back to local suggestions visibly.
- Assistant smart alerts test now restores console spies between runs to keep the fallback coverage isolated.
- Assistant smart alerts now stay local-only after contract simplification, with category narrowing protecting the fallback path from runtime crashes.
- Assistant reminder editor now resets invalid reminder dates to the current local date/time and uses accessible labels so stale values do not leak into the edit modal.
- Assistant reminder creation now resets the date/time defaults after closing the editor, so a new reminder does not inherit stale values from the previous edit.
- Assistant goal and alert modals now reset their draft state on open and close, and their fields are labeled so stale values do not leak between modal sessions.
- Assistant goal saving now normalizes `targetAmount` before persistence so a cleared field does not produce an invalid payload.
- AIInput now resets the manual intake form when switching back into manual mode, and the manual fields have explicit labels so stale values do not leak between mode sessions.
- AIInput now also re-synchronizes its selected account when the accounts list changes, so an open modal cannot keep pointing at a stale account from a previous context.
- AI Control Panel simulation scenarios now reset to canonical defaults when the selected scenario type changes, instead of carrying stale fields across types.
- AI Control Panel Parser Lab now resets its draft state when switching formats, so old parse results and errors do not leak between OFX and CSV sessions.
- TransactionList share modal now resets its report filters and destination state between openings, so prior selections do not leak into a new report session.
- TransactionList CSV export now revokes the generated blob URL after download, so export sessions do not leak object URLs.
- ImportTransactions now clears the duplicate-filter toggle when a new file is loaded or the session is reset, so the next import preview starts from the canonical default.
- ReceiptScanner now revokes the previous object URL when a new image is loaded or the scan is reset, so image previews do not leak resources across sessions.
- ReceiptScanner no longer keeps a dead `confirmed` flag in state; the done phase already drives the post-save UI.
- ImportTransactions now invalidates in-flight imports when the screen resets or unmounts, so late async responses cannot overwrite the active session.
- CashFlow now invalidates the stored strategic report when the cashflow recorte changes, so the AI diagnostic does not stay pinned to an older timeframe or transaction set.
- AICFO now clears the conversation when the underlying financial context changes, so a prior assistant thread does not leak across a new workspace or transaction set.
- WorkspaceAudit now clears stale events and cursor state when the workspace changes, so the audit view does not momentarily reuse the previous workspace's data.
- TransactionList CSV export now revokes the generated blob URL after the download click, so export sessions do not leak object URLs.
- TransactionList now renders invalid transaction dates as an explicit placeholder instead of leaking `Invalid Date` into the row or CSV export.
- TransactionList now treats invalid transaction dates as non-sortable/non-filterable timestamps instead of propagating `NaN` into ordering logic.
- TransactionList CSV export now quotes cells that contain commas or quotes, so the exported table stays structurally valid.
- ImportTransactions now commits only selected non-duplicate items, matching the preview instead of importing duplicate rows by mistake.
- ImportTransactions now ignores late progress updates and late completion after reset/unmount, so a stale async import cannot overwrite the active session.
- ReceiptScanner now ignores late OCR results after reset/unmount, so a stale scan cannot reopen the review flow or save after the user moved on.
- Backend AI insights now normalize malformed daily/strategic responses before they reach the UI, and daily insight fallback now emits a visible diagnostic item instead of an empty list.
- Gemini service daily insights now normalize malformed payloads and return a visible diagnostic fallback instead of silently returning an empty array.
- Legacy import compatibility wrapper and redundant PDF/OCR import engines were removed after confirming they had no runtime consumers outside their own tests.
- ImportTransactions now delegates draft conversion to the canonical import service instead of keeping a second mapping path in the page.
- TransactionList now survives blocked localStorage writes and malformed stored filter state without breaking the list UI.
- ImportTransactions now keeps the import flow alive when merchant-learning persistence fails, and it renders invalid imported dates as an explicit placeholder instead of a broken date string.
- AI Control Panel simulation now recalculates when transactions or accounts change, so the preview does not stay pinned to stale input after a context update.
- ImportTransactions now clears the file input after selection, so the same file can be chosen again without relying on a manual reset.
- ImportTransactions now keeps row expansion state attached to the original transaction order when duplicate rows are filtered in or out, so the preview does not jump state between rows.
- ImportTransactions now formats preview dates in UTC so timezone drift does not shift imported transactions to the previous day in the UI.
- AI Control Panel now renders the Parser Lab tab explicitly instead of leaving the tab selector pointing to a dead panel, and the parser preview clears stale output when the input changes.
- AI Control Panel now renders safe fallbacks for malformed timestamps in memory, insights, events, logs, audit, and graph views instead of leaking `Invalid Date` or `Invalid time` into the dev panel.
- AI Control Panel timestamp formatting now exposes safe fallback helpers, so malformed memory/log/audit timestamps can be tested directly and do not leak raw date errors into the panel.
- AI Control Panel memory tab now sorts a copy of the service result instead of mutating the returned array in place.
- AI memory store, task queue store, and debug log service now treat blocked or malformed localStorage as a recoverable condition instead of breaking module initialization.
- Encryption service now falls back to plain JSON in development only when encryption fails, and the getter can recover that dev payload through the same encrypted key path.
- Local sync hydration now logs and survives localStorage read/write failures for both cached goals and the last-pull marker.
- PDF import parsing now preserves an explicit negative amount signal so the import pipeline can classify expenses correctly before AI enrichment.
- AI interpreter now normalizes invalid model intents to `unknown` and drops structured data instead of letting malformed responses masquerade as a transaction/reminder result.
- Assistant message and reminder timestamps now use a safe formatter with an explicit invalid fallback, so malformed chat history cannot leak raw date errors into the consultative UI.
- AICFO chat bubbles now use a safe timestamp formatter, so malformed message history cannot leak raw time errors into the CFO view.
- WorkspaceAdmin now uses a safe timestamp formatter for billing hooks and audit items, so malformed cloud records do not leak `Invalid Date` into the admin panel.
- TransactionList transaction details now reuse the safe date label path in the modal, so a row with a bad date does not render a broken detail timestamp.
- TransactionList date-range filters now normalize malformed stored values before filtering, so corrupt saved dates do not hide the list or propagate invalid range comparisons.
- TransactionList now parses date-only transaction strings as local calendar dates, so date-only entries do not drift by timezone in sorting, filtering, or the details modal.
- AdvancedAnalytics now formats chart labels through a safe date helper, so invalid transaction dates do not leak broken labels into the chart summary.
- AdvancedAnalytics now parses date-only transaction strings as local calendar dates, so chart labels and trends do not drift by timezone on date-only entries.
- Dashboard now parses date-only transactions and reminders as local calendar dates, so month metrics and due-today checks do not drift by timezone on date-only entries.
- Analytics engine now parses date-only transactions as local calendar dates for timeframe filtering and cashflow timeline grouping, so shared financial timelines do not drift by timezone on date-only entries.
- Forecast engine now parses date-only transactions as local calendar dates for monthly buckets, so projections do not drift by timezone on date-only entries.
- Recurring service and cashflow predictor now parse date-only recurring transactions as local calendar dates and ignore malformed recurring dates, so future cashflow simulation does not drift or crash on bad history.
- Bank sync status now parses date-only `last_sync` values as local calendar dates, so freshness checks do not misclassify a valid date-only sync marker as stale.
- AdvancedAnalytics empty-state copy now uses clean UTF-8, so the no-data table message does not leak mojibake.
- AdvancedAnalytics section headings and monthly report labels now use clean UTF-8, so the finance dashboard no longer shows mojibake in the visible chart shell.
- MetricsViewer snapshot timestamps now use a safe formatter with an explicit invalid fallback, so malformed AI metrics snapshots do not leak raw time errors into the observability panel.
- TransactionList now normalizes the saved date-range filter values before filtering, so a corrupt stored range does not hide the list or poison the cache key.
- TransactionList header labels and share report copy were rewritten in clean UTF-8, removing mojibake from the visible list shell and exported summary.
- Open Finance remains explicitly disabled by policy; the feature flag no longer auto-enables on enterprise context, so the expensive Pluggy path only comes back through an explicit env decision.
- `goalService` now treats date-only deadlines as local calendar dates and marks a goal overdue only after the end of that day, not at midnight local time.
- `smartGoalsEngine` now returns an explicit `recommendedMonthlySavings` field in feasibility results, including `null` for malformed or missing deadlines.
- `csvParser`, `ofxParser`, `importNormalizer`, `moneyMap`, and `reportEngine` now parse date-only strings as local calendar dates instead of drifting by timezone through the import/report pipeline.
- `financialEngine` now treats date-only analysis windows as local dates, so monthly summaries do not shift by timezone on date-only entries.
- `subscriptionDetectionCore` and the AI subscription detector now infer recurring cycles and next charges from local date-only values instead of UTC-shifting the cadence window.
- Main navigation and app loading copy were rewritten in clean UTF-8 so the core shell no longer shows mojibake in the most visible labels.
- Error boundary and login surface copy were also rewritten in clean UTF-8, removing mojibake from the most visible recovery and entry screens.
- Goals preset titles and placeholder copy were normalized to clean UTF-8, and the contribution input still parses pt-BR amounts safely.
- AdvancedAnalytics title and hidden-value placeholders were normalized to clean UTF-8, so the dashboard shell no longer shows broken text in the chart header or masked values.
- TransactionList share/report, edit, delete, and selection copy were normalized to clean UTF-8, including the visible report subject and action labels.
- Insights quick-projection, section headings, upgrade copy, and footer note were normalized to clean UTF-8, so the insights shell no longer shows broken visible text.
- AIInput manual monetary entry now parses pt-BR decimal commas with a text decimal field, so the manual flow no longer rejects valid BRL-style amounts.
- AIInput review amount now also parses pt-BR decimal commas, so AI-confirmed drafts can be corrected with the same BRL input style.
- ReceiptScanner review amount now parses pt-BR decimal commas with a labeled text decimal field, so OCR review no longer rejects valid BRL-style edits.
- AIControlPanel simulation inputs now parse pt-BR decimal commas with explicit labels, so the panel does not reject BRL-style scenario amounts or hide the scenario preview from tests.
- AIControlPanel simulation inputs now parse pt-BR decimal commas with explicit labels, so the panel does not reject BRL-style scenario amounts or leave the preview inaccessible to tests.
- AIControlPanel date/time fallbacks and parser-lab output now use real UTF-8 labels, so malformed timestamps and parsed-transaction counters do not leak literal escape sequences into the panel or its tests.
- Assistant goal and alert drafts now parse pt-BR decimal commas, so financial targets and thresholds no longer depend on browser-number input behavior.
- ReceiptScanner review amount now keeps a separate pt-BR draft string, so clearing the field no longer snaps back to 0 and the saved amount keeps the expected decimal comma formatting.
- Goals deadline labels now treat YYYY-MM-DD as local dates, so goal deadlines do not shift by timezone when the stored value is date-only.
- AIControlPanel month-based simulations now clamp cleared or invalid month input back to 1, so the preview cannot drift into NaN state when the field is emptied.
- Accounts form now rejects malformed balance text instead of silently saving it as zero, so invalid input cannot create a misleading account balance.
- Goals creation and contribution now surface validation errors instead of failing silently, and contribution submit is only disabled when the field is empty rather than when the value is merely invalid.
- Goals validation messages now clear as soon as the user edits the field again, so the form does not stay stuck in an error state after correction.
- Fixed expense detection now parses date-only transaction strings as local calendar dates, ignores malformed recurring dates in monthly grouping, and keeps the next expected charge on a local date-only string.
- Salary detection now parses date-only income strings as local calendar dates, and the payday formatter handles date-only values without timezone drift.
- Financial graph aggregation now parses date-only values for merchant trend windows and same-day co-occurrence, so the graph does not drift by timezone on date-only history.
- Financial autopilot, CFO context, and prediction rendering now parse date-only data locally, so recent-spend windows, monthly summaries, and chart labels do not drift by timezone.
- Cashflow predictor, recurring service, and prediction hook now parse date-only dates locally before monthly averages, recurrence expansion, and chart conversion.
- AI memory, memory analyzer, leak detection, receipt OCR, advanced context building, and CFO advisor now parse date-only transaction dates locally, so behavioral analysis, leak detection, receipt parsing, and advisory normalization do not drift by timezone on date-only history.
- Insight generation now parses date-only dates locally for monthly windows and recent-small-purchase checks, so monthly trend insights do not drift by timezone on date-only history.
- Financial analytics, timeline, forecast, and shared month helpers now parse date-only transaction dates locally, so timeline grouping, monthly aggregates, and cashflow forecasts do not drift by timezone.
- Import duplicate detection now compares date-only values as local calendar dates, so imported files do not misclassify duplicates because of UTC shifting.
- Type mappers, PDF statement parsing, and the remaining financial engine month filter now normalize date-only and invalid API values locally, so shared contracts do not leak malformed dates into domain objects or month summaries.
- Analytics engine custom timeframe and timeline keys now use local date formatting, so date-only transactions do not drift by timezone in the cashflow graph or custom filters.
- Cashflow predictor and recurring detector now serialize projected date-only values as local calendar days, so recurrence and projection previews do not drift by timezone.
- Memory analyzer recurring-transaction predictions now serialize nextExpectedDate as a local calendar day, so memory-based recurrence previews do not drift by timezone.
- Financial timeline day buckets now use local calendar keys, so timeline grouping does not drift by timezone on date-only transactions.
- OCR receipt parser now returns local calendar date keys for BR and ISO date-only inputs, so receipt dates do not shift by timezone in downstream subscription parsing.
- CSV and OFX parsers now keep date-only inputs as local calendar keys, so imported statement dates do not shift by timezone before they reach the transaction model.
- Legacy OCR and PDF import engines now stamp extracted receipts with local calendar dates, so the fallback import path does not drift to the previous UTC day near midnight.
- PDF extraction now also has regression coverage for empty-text and parser-rejection failures, so the fallback path stays visible instead of silently collapsing.
- PredictionChart tick and tooltip formatting now use local calendar date parsing, so the forecast chart does not drift by timezone on date-only labels.
- Intake normalizer now preserves date-only file and integration inputs as local calendar keys in occurredAt, so imported drafts do not reintroduce UTC drift before save.
- Legacy import normalizer and the main import service now preserve date-only rows and OFX/CSV dates as local calendar keys, and recurring transaction expansion now emits local calendar dates, so the import pipeline does not reintroduce UTC drift through the legacy path or future recurrence generation.
- PDF statement parsing now preserves BR and ISO date-only strings as local calendar keys, and the receipt OCR/CFO advisor paths now keep date-only values local before serializing them back to the UI or advisor summary.
- Open Banking sync freshness now parses `last_sync` date-only values as local calendar dates in both the service formatter and the bank sync summary, so a fresh same-day connection is not flagged stale by timezone drift.
- Billing overview and usage now fail soft on missing workspace context, while plan updates and billing hooks reject empty workspace/tenant ids before building Firestore paths.
- Cloud sync now returns an empty pull result when workspace context is missing and rejects push attempts without a workspace id before touching the Firestore workspace store.
- Workspace store reads now fail soft for empty workspace ids, while workspace-scoped writes and audit/event queries reject empty workspace or tenant context before building Firestore queries and paths.

## Dead code removido

- `pages/DashboardPage.tsx` era apenas um re-export morto para `components/Dashboard` e foi removido.
- O type-check da app e do backend continua verde depois da remoção.

- Adaptive AI salary timing now scans the real calendar for the next salary day instead of assuming 30-day months, so February and 31-day months no longer distort salary-based insights or cashflow boosts.

## Queue examples removidos

- `src/ai/queue/examples.ts` foi removido como exemplo/demo sem importação em runtime.
- `npm run lint`, `npm run docs:check-mojibake` e `npm run test:critical` seguiram verdes depois da remoção.

- Usage tracking now keeps month keys on the local calendar and passes Date objects through the adapter path, so month-boundary usage accounting no longer drifts into the wrong month.
- Adaptive AI salary timing now scans the real calendar for the next salary day instead of assuming 30-day months, so February and 31-day months no longer distort salary-based insights or cashflow boosts.

## Módulos órfãos removidos

- `hooks/useCashFlowState.ts`, `components/SpendingAlerts.tsx`, `src/events/financialEventStream.ts` e `src/runtime/index.ts` não tinham importação viva e foram removidos.
- `npm run lint`, `npm run docs:check-mojibake` e `npm run test:critical` seguiram verdes depois da remoção.

- Workspace member add/remove now reject empty workspace or tenant context before building Firestore membership document ids, closing another invalid path on the workspace store write surface.

## Chunk guard simplificado

- `src/runtime/chunkGuard.ts` perdeu o alias legado `initChunkGuard` e o export morto `resetChunkErrorCount`.
- `npm run lint`, `npm run docs:check-mojibake` e `npm run test:critical` continuaram verdes após a limpeza.

### 2026-05-08 - Billing hook context fields are now stable even when payload carries conflicting workspace data.
- `recordWorkspaceBillingHook()` now spreads `input.payload` first and overrides `id`, `tenantId`, `workspaceId`, and `createdAt` last, so payload data cannot replace the enclosing billing context.
- Added a regression in `tests/unit/firestore-billing-store.test.ts` that feeds a conflicting `workspaceId` inside the payload and asserts the stored document keeps the outer workspace id.
## Version guard simplificado

- `src/runtime/versionGuard.ts` perdeu o helper morto de notificação de mismatch de versão.
- `npm run lint`, `npm run docs:check-mojibake` e `npm run test:critical` continuaram verdes depois da limpeza.

### 2026-05-08 - HTTP SaaS adapters now surface usage write failures and preserve the active workspace id in billing hooks.
- `createHttpUsageStoreAdapter().write()` now throws when the API returns a non-OK response instead of silently accepting a failed sync.
- Added `tests/unit/http-adapters.test.ts` to cover the usage write failure path and the active-workspace fallback in `createHttpBillingTransport()`.
### 2026-05-08 - Removed dead skipped coverage for the deleted API storage provider test module.
- `tests/unit/api-storage-provider.test.ts` was a `describe.skip` placeholder for a module that no longer exists, so it was removed to reduce irrelevant test noise.
### 2026-05-08 - HTTP usage reads now normalize malformed payloads instead of trusting raw API shape.
- `createHttpUsageStoreAdapter().read()` now normalizes the `usage` payload and drops non-object month entries, so a malformed API response cannot poison the local usage cache.
- Added a regression in `tests/unit/http-adapters.test.ts` that returns `null` and string garbage in the payload and asserts only the valid month entry survives.
## Limite desta passada

- Os itens remanescentes agora caem em contrato compartilhado, migração de validação ou dependência de outra sessão.
- O restante do cleanup deve ficar em passadas dedicadas, não em remoção cega.
