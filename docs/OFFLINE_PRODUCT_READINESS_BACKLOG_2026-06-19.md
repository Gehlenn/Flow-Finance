# Flow Finance - offline product readiness backlog

Data: 2026-06-19
Status: active execution backlog for work that can be done before new real-user sessions.

## Purpose

This document turns the current "what can we do outside real use?" discussion into a living checklist.

It does not replace the main audit, the current scorecard, or the habit proof program. It exists to keep the next execution rounds ordered, evidence-based, and scoped to what can be improved without pretending that commercial adoption, paid conversion, churn, CAC, LTV, willingness to pay, or durable habit are already evidenced.

## Operating protocol

- Orchestration, prioritization, review, and final decisions: GPT-5.5 high.
- Execution and bounded code/documentation work: GPT-5.4-mini subagents when tool support is available.
- Product anchor: intelligent cash-flow SaaS for service businesses, connected to real operations.
- MVP anchor: cash flow, useful transactions, projected vs realized revenue, operational-financial linkage, clear dashboard, and consultative AI.
- Non-goal for this backlog: turning Flow Finance into a generic finance super-app, Open Banking-led MVP, OCR-led MVP, or autonomous CFO promise.

## Evidence boundary

Implemented means code, tests, scripts, published runtime, or screenshots exist.

Documented means the product/engineering decision is recorded, but not necessarily verified by runtime or users.

Planned means it is ordered here but not implemented yet.

Inferred means the auditor is making a reasoned judgment from code/docs/screenshots.

SEM EVIDENCIA SUFICIENTE means no evidence in this repo/vault is enough to make the claim.

## What can be done without new real usage

### 1. Full visual audit screen by screen

Status: CAPTURE COVERAGE PASS / VISUAL REVIEW COMPLETE OFFLINE
Priority: P1
Goal: review all current web/mobile routes with screenshots and evidence.

Scope:

- spacing
- alignment
- hierarchy
- density
- responsiveness
- empty states
- loading states
- error states
- modal/drawer states
- financial number readability
- navigation chrome impact on first viewport

Evidence expected:

- visual regression manifest with all relevant tabs/routes
- screenshot review notes for desktop and mobile
- file-level findings
- explicit list of screens that pass, need polish, or need redesign

What this cannot prove:

- user preference
- activation improvement
- conversion improvement
- habit formation

Current route matrix:

- `/`: auth gate and logged-in app shell.
- `/pricing`: pricing surface outside the main tab shell.
- `/?tab=dashboard`: cash summary, first-session state, weekly review ritual, alerts, FAB entry.
- `/?tab=history`: transaction list, filters, bulk selection, edit/delete/report states.
- `/?tab=flow`: projected vs realized revenue, internal chart tabs, export/strategy modals.
- `/?tab=analytics`: advanced revenue history on Pro or upgrade prompt on Free.
- `/?tab=insights`: cash signals and immediate risks.
- `/?tab=settings`: account, plan, workspace operations, integrations, support/legal modals.
- `/?tab=accounts`: account list, create form, read-only role state.
- `/?tab=goals`: goals list, create form, contribution modal, completed goals.
- `/?tab=import`: import lifecycle from idle through preview, importing, done, and error.
- `/?tab=cfo`: consultative AI workspace, prompt list, response, fallback, action creation.
- `/?tab=assistant`: action plan, reminders, smart alerts, goals, limits, modals.
- `/?tab=workspaceadmin`: workspace members, billing usage, audit summary, admin actions.
- `/?tab=workspaceaudit`: audit filters, event list, empty/loading/error/restricted states.
- `/?tab=aicontrol`: dev-only AI lab.
- `/?tab=performance`: dev-only performance monitor.

Current capture evidence:

- `test-results/visual-regression/2026-06-19T15-09-51-976Z/manifest.json`: first wide capture, 13 tabs x desktop/mobile, `BLOCK` with 12 console warnings.
- `test-results/visual-regression/2026-06-19T15-15-38-364Z/manifest.json`: isolated `workspaceaudit` recapture, `PASS` after demo audit events were rendered locally.
- `test-results/visual-regression/2026-06-19T15-15-52-933Z/manifest.json`: second wide capture, 13 tabs x desktop/mobile, `BLOCK` with 10 remaining Recharts dimension warnings.
- `test-results/visual-regression/2026-06-25T17-20-52-876Z/manifest.json`: wide core matrix, 13 tabs x desktop/mobile, 26 screenshots, `PASS`, `consoleIssues=0`, `pageErrors=0`.
- `test-results/visual-regression/2026-06-26T14-10-53-868Z/manifest.json`: current consolidated matrix, 13 tabs plus 11 route/modal/state surfaces across desktop/mobile, 48 screenshots, `PASS`, `consoleIssues=0`, `pageErrors=0`.
- `test-results/visual-regression/2026-06-26T14-11-43-872Z/manifest.json`: focused Analytics recapture after category chart and demo-data remediation, desktop/mobile, `PASS`, `consoleIssues=0`, `pageErrors=0`.
- `test-results/visual-regression/2026-06-26T19-19-19-381Z/manifest.json`: focused CFO mobile safe-area recapture after composer remediation, desktop/mobile, `PASS`, `consoleIssues=0`, `pageErrors=0`.
- `test-results/visual-regression/2026-06-26T19-56-14-039Z/manifest.json`: focused Step 4 empty-state recapture for `history-empty`, `goals-empty`, and `aicfo-base-short` across desktop/mobile, `PASS`, `8` screenshots, `consoleIssues=0`, `pageErrors=0`.
- `test-results/visual-regression/2026-06-27T03-10-56-358Z/manifest.json`: focused Step 4 first-session recapture for `dashboard-empty` and `import-idle` across desktop/mobile, `PASS`, `16` screenshots, `consoleIssues=0`, `pageErrors=0`.
- `test-results/audit-claims/2026-06-26T19-59-24-615Z/report.json`: claims guard after this backlog update, `PASS`, `0` violations.
- `test-results/audit-evidence/2026-06-26T20-00-10-240Z/report.json`: consolidated evidence package, still `BLOCK` only because durable habit and cohort state remain blocked; visual regression, AI quality, and claims guard are `PASS`.
- `test-results/audit-claims/2026-06-27T03-10-02-866Z/report.json`: claims guard after Step 4 dashboard/import closure, `PASS`, `73` docs scanned, `0` violations.
- `test-results/audit-evidence/2026-06-27T03-10-06-687Z/report.json`: consolidated evidence package after Step 4 dashboard/import closure, still `BLOCK` only because durable habit and cohort state remain blocked; visual regression, AI quality, and claims guard are `PASS`.
- `test-results/audit-claims/2026-06-27T03-13-11-271Z/report.json`: claims guard after the E2E empty-seed fix and documentation update, `PASS`, `73` docs scanned, `0` violations.
- `test-results/audit-evidence/2026-06-27T03-13-21-378Z/report.json`: consolidated evidence package after the E2E empty-seed fix, still `BLOCK` only because durable habit and cohort state remain blocked; activation export/checker, visual regression, AI quality, and claims guard are `PASS`.
- `test-results/audit-claims/2026-06-27T03-15-50-745Z/report.json`: final claims guard for this round, `PASS`, `73` docs scanned, `0` violations.
- `test-results/audit-evidence/2026-06-27T03-15-58-504Z/report.json`: final consolidated evidence package for this round, still `BLOCK` only because durable habit and cohort state remain blocked; activation export/checker, visual regression, AI quality, and claims guard are `PASS`.
- `test-results/audit-claims/2026-06-27T03-20-24-358Z/report.json`: claims guard after Step 6 financial readiness closure, `PASS`, `74` docs scanned, `0` violations.
- `test-results/audit-evidence/2026-06-27T03-20-31-656Z/report.json`: consolidated evidence package after Step 6 financial readiness closure, still `BLOCK` only because durable habit and cohort state remain blocked; activation export/checker, visual regression, AI quality, and claims guard are `PASS`.
- `test-results/visual-regression/2026-06-27T08-28-36-434Z/manifest.json`: focused Step 8 demo-data recapture for `dashboard`, `flow`, and `assistant` across desktop/mobile, `PASS`, `6` screenshots, `consoleIssues=0`, `pageErrors=0`.
- `test-results/visual-regression/2026-06-27T08-28-57-915Z/manifest.json`: focused Step 8 demo-data recapture for `dashboard`, `flow`, `analytics`, and `cfo` across desktop/mobile, `PASS`, `8` screenshots, `consoleIssues=0`, `pageErrors=0`.
- `test-results/audit-claims/2026-06-27T08-33-30-674Z/report.json`: claims guard after Step 8 consolidation, `PASS`, `76` docs scanned, `0` violations.
- `test-results/audit-evidence/2026-06-27T08-33-35-924Z/report.json`: consolidated evidence package after Step 8 consolidation, still `BLOCK` only because durable habit and cohort state remain blocked; activation export/checker, AI quality, visual regression, and claims guard are `PASS`.
- `docs/VISUAL_SCREENSHOT_REVIEW_2026-06-26.md`: updated on 2026-06-30 with modal/state screenshot review using GPT-5.5 orchestration and GPT-5.4-mini subagent findings.
- `test-results/audit-claims/2026-06-30T05-06-35-228Z/report.json`: claims guard after Step 1 visual review closure, `PASS`, `76` docs scanned, `0` violations.
- `test-results/audit-evidence/2026-06-30T05-07-21-482Z/report.json`: consolidated evidence package after Step 1 visual review closure, still `BLOCK` only because durable habit proof and cohort state remain blocked; activation export/checker, AI quality, claims guard, and visual regression are `PASS`.
- `test-results/audit-claims/2026-06-30T05-08-56-086Z/report.json`: final claims guard after documentation checks, `PASS`, `76` docs scanned, `0` violations.
- `test-results/audit-evidence/2026-06-30T05-09-07-242Z/report.json`: final consolidated evidence package after Step 1 visual review closure, still `BLOCK` only because durable habit proof and cohort state remain blocked; activation export/checker, AI quality, claims guard, and visual regression are `PASS`.
- `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`: focused modal/copy recapture for `history`, `flow`, `settings`, `transaction-edit-modal`, `cashflow-share-modal`, `cashflow-strategy-modal`, `settings-support`, `insights-empty`, and `/pricing`, desktop/mobile, `18` screenshots, `PASS`, `consoleIssues=0`, `pageErrors=0`.
- `test-results/audit-claims/2026-06-30T14-00-35-269Z/report.json`: claims guard after P1 UI remediation and copy/pricing follow-up, `PASS`, `77` docs scanned before this documentation update, `0` violations.
- `test-results/audit-evidence/2026-06-30T14-01-39-628Z/report.json`: consolidated evidence package after P1 UI remediation and copy/pricing follow-up, still `BLOCK` only because durable habit proof and cohort state remain blocked; activation export/checker, AI quality, claims guard, and visual regression are `PASS`.
- `test-results/audit-claims/2026-06-30T14-04-15-933Z/report.json`: final claims guard after documentation update, `PASS`, `78` docs scanned, `0` violations.
- `test-results/audit-evidence/2026-06-30T14-05-23-628Z/report.json`: final consolidated evidence package after documentation update, still `BLOCK` only because durable habit proof and cohort state remain blocked; activation export/checker, AI quality, claims guard, and visual regression are `PASS`.

Current findings:

- Implemented: the visual runner can capture arbitrary `?tab=` screens through `--tabs`, not only its default six central tabs.
- Implemented: `workspaceaudit` now has a demo-mode visual path, so the screenshot runner no longer treats missing real audit events as a layout blocker.
- Implemented: `AdvancedAnalytics` and `CashFlow` chart containers no longer emit Recharts dimension warnings in the wide visual matrix.
- Implemented: the visual runner can capture non-tab surfaces through `--surfaces`, including `/pricing`, auth gate, `insights-empty`, AIInput modal, transaction edit/delete, CashFlow export/strategy, Assistant smart alerts, and Settings support/legal.
- Implemented: the mobile app shell now keeps the add-transaction FAB reachable, so mobile can open the primary transaction capture path instead of relying on a desktop-only control.
- Implemented: `AdvancedAnalytics` received bounded MVP-safe visual polish, an explicit empty state for missing category data, a corrected horizontal category chart contract, and a more realistic service-business demo expense distribution while preserving calculations and paywall behavior.
- Implemented: `src/demo/demoBootstrap.ts` now seeds enough operational expense categories for visual and product walkthroughs not to look like a zero-data or toy dataset; covered by `tests/unit/demoBootstrap.test.ts`.
- Implemented: `pages/AICFO.tsx` now reserves safe-area/bottom-nav space for the mobile "Pergunta rapida" composer; covered by `tests/unit/aicfo-plan-render.test.tsx` and `test-results/visual-regression/2026-06-26T19-19-19-381Z/manifest.json`.
- Documented: the runner is screenshot evidence, not a pixel-diff baseline. It records manifest, paths, hashes, console issues, and page errors.
- Documented: `docs/VISUAL_SCREENSHOT_REVIEW_2026-06-26.md` records manual/subagent scoring and residual UX risk for Dashboard, Advanced Analytics, CFO mobile, Pricing, modal states, support/legal surfaces, auth, and empty states.
- Implemented: `components/TransactionList.tsx` now lets category chips wrap and use a one-column mobile grid, closing the previous P1 truncation finding in transaction edit modals.
- Implemented: `components/Settings.tsx` now uses a mobile-safe stacked support composer, closing the previous P1 cramped/truncated support input finding.
- Implemented: `components/CashFlow.tsx`, `components/Login.tsx`, and `pages/Insights.tsx` now remove the highest-impact generic/product-misaligned wording from share, strategy, auth, and Insights empty-state surfaces.
- Inferred: the visual baseline is now materially stronger for offline review, but it is still screenshot/manual evidence, not user preference or conversion evidence.
- SEM EVIDENCIA SUFICIENTE: no automated visual diff baseline exists yet; no external user has validated the visual hierarchy.

Residual risks for this step:

- Previous P1 UI debt is closed offline by tests and focused screenshots: transaction category chips no longer depend on truncation, and the mobile support composer is no longer forced into a cramped single row.
- P2/P3 UI/product debt remains: legal modal density, possible generic wording on secondary surfaces, and lack of automated pixel-diff baseline.
- CFO mobile bottom input safe-area was fixed in the focused recapture; broader mobile shell changes should still rerun this screenshot.

### 2. Recurring-use instrumentation

Status: IMPLEMENTED / VALIDATED OFFLINE
Priority: P1
Goal: make the app ready to measure activation and habit when real use resumes.

Events to verify or add:

- `onboarding_started`
- `workspace_created`
- `transaction_imported`
- `forecast_viewed`
- `ai_insight_opened`
- `decision_saved`
- `return_visit`
- `weekly_review_completed`

Evidence expected:

- analytics contract update: `src/app/productAnalytics.ts`, `src/app/productAnalyticsContract.ts`
- emitters: `App.tsx`, `src/services/workspaceSession.ts`, `pages/ImportTransactions.tsx`, `components/CashFlow.tsx`, `pages/Insights.tsx`, `components/Dashboard.tsx`
- unit tests: `tests/unit/product-analytics-contract.test.ts`, `tests/unit/workspace-session.test.ts`, `tests/unit/import-transactions-session.test.tsx`, `tests/unit/insights-plan-render.test.tsx`, `tests/unit/cashflow-clarity.test.tsx`, `tests/unit/dashboard-quick-actions.test.tsx`
- focused validation: `vitest run tests/unit/product-analytics.test.ts tests/unit/product-analytics-contract.test.ts tests/unit/app-shell-navigation.test.tsx tests/unit/workspace-session.test.ts tests/unit/import-transactions-session.test.tsx tests/unit/insights-plan-render.test.tsx tests/unit/dashboard-quick-actions.test.tsx tests/unit/cashflow-clarity.test.tsx tests/unit/activation-retention-export.test.ts tests/unit/habit-proof-evidence.test.ts tests/unit/cohort-state-report.test.ts --exclude .tmp/**` passed with 11 files and 71 tests.

What this cannot prove:

- repeated cohort behavior
- cohort behavior
- churn

Current findings:

- Implemented: all eight backlog event names now exist in the product analytics contract.
- Implemented: `weekly_cash_review_completed` remains as the legacy habit-proof event, while `weekly_review_completed` is emitted from the dashboard weekly review path for the new instrumentation vocabulary.
- Implemented: event properties are bounded to primitive, non-PII fields by `sanitizeAnalyticsPropertiesForEvent`.
- SEM EVIDENCIA SUFICIENTE: no new real cohort export proves these events in production yet.

### 3. Activation funnel without real users

Status: IMPLEMENTED / VALIDATED OFFLINE
Priority: P1
Goal: define and test the minimum "aha moment" path.

Target path:

1. company/workspace created
2. financial data entered or imported
3. projected vs realized revenue visible
4. consultative AI produces a useful, bounded recommendation
5. user saves or acts on a decision

Evidence expected:

- documented funnel contract
- E2E or integration path for the funnel
- technical evidence that every step can be observed

What this cannot prove:

- actual aha moment with real users
- perceived value

Current findings:

- Implemented: `src/services/workspaceSession.ts` emits `workspace_created` on backend bootstrap and personal-workspace creation; covered by `tests/unit/workspace-session.test.ts`.
- Implemented: `pages/ImportTransactions.tsx` emits `transaction_imported` after confirmed import; covered by `tests/unit/import-transactions-session.test.tsx`.
- Implemented: `components/CashFlow.tsx` emits `forecast_viewed` when the `Previsto` section becomes active; covered by `tests/unit/cashflow-clarity.test.tsx`.
- Implemented: `pages/Insights.tsx` emits `ai_insight_opened` and `decision_saved` from insight open and reminder save actions; covered by `tests/unit/insights-plan-render.test.tsx`.
- Implemented: `tests/unit/product-analytics-contract.test.ts` now keeps the five-step activation funnel observable without exposing identifiers.
- SEM EVIDENCIA SUFICIENTE: no end-to-end real-user session proves the funnel is completed by a live customer yet.

### 4. Empty states and first session

Status: IMPLEMENTED / VALIDATED OFFLINE
Priority: P1
Goal: make the first session direct the user to the first useful financial decision.

Scope:

- empty dashboard
- empty transactions
- empty cash-flow chart
- empty accounts/goals/import surfaces
- first AI consultation with insufficient data
- demo-data entry point when appropriate

Evidence expected:

- screenshots before/after
- tests for primary CTAs
- no marketing copy that competes with operational copy

What this cannot prove:

- user activation lift

Current findings:

- Implemented: `pages/Insights.tsx` now renders an operational first-session empty state with CTAs to `import` and `flow`, so the user is directed to the next useful financial action instead of a dead text-only state.
- Implemented: `tests/unit/insights-plan-render.test.tsx` covers the empty-state CTAs and navigation targets.
- Implemented: `test-results/visual-regression/2026-06-26T14-02-52-011Z/manifest.json` captures `insights` and `insights-empty` across desktop/mobile with `PASS`, `4` screenshots, `consoleIssues=0`, and `pageErrors=0`.
- Implemented: `test-results/visual-regression/2026-06-26T14-10-53-868Z/manifest.json` includes `insights-empty` in the full 13-tab, 11-surface visual matrix with `PASS` and `48` screenshots.
- Implemented: `pages/Accounts.tsx` now has an operational zero-account component state with a direct "Adicionar conta principal" CTA; covered by `tests/unit/accounts-form.test.tsx`.
- Inferred: the full app route does not naturally show zero accounts in the current E2E/bootstrap path because `useFinancialState` creates a default workspace account when the workspace is empty, so the account empty state is component-protected rather than route-captured.
- Implemented: `components/CashFlow.tsx` already has explicit empty chart states for no movement, no expenses, no ranking, no forecast, and no receivables gaps; its strategic-report fallback now also deduplicates incomplete AI plans and falls back to distinct cash actions for recut review, receivables, and confirmed outflows.
- Implemented: `components/TransactionList.tsx` now separates a real no-transaction state from a filtered-empty state. If transactions exist but filters/search hide them, the screen shows the active filter summary and a `Limpar filtros` action.
- Implemented: `pages/Goals.tsx` and `src/app/secondaryFlowsCopy.ts` now frame goals as `Metas de caixa`, anchored in reserves, provisions, and operational cash objectives instead of generic personal-finance goals.
- Implemented: `pages/AICFO.tsx` now shows a first-session `Base curta` state when the consultative AI lacks enough financial grounding, with CTAs to import transactions and inspect cash flow when navigation is available.
- Implemented: `scripts/capture-visual-regression.mjs` now supports focused captures for `history-empty`, `goals-empty`, and `aicfo-base-short`; `test-results/visual-regression/2026-06-26T19-56-14-039Z/manifest.json` captured those branches across desktop/mobile with `PASS`.
- Validated offline: `npx vitest run tests/unit/aicfo-plan-render.test.tsx tests/unit/cashflow-clarity.test.tsx tests/unit/transaction-list-states.test.tsx tests/unit/goals-page.test.tsx tests/unit/goals-contribution.test.tsx tests/unit/secondary-flows-copy.test.ts tests/unit/accounts-form.test.tsx tests/unit/insights-plan-render.test.tsx --environment jsdom --exclude .tmp/** --pool=threads` passed on 2026-06-26 with `8` files and `51` tests; `npm run type-check:app` and `node --check scripts/capture-visual-regression.mjs` also passed.
- Implemented: `components/Dashboard.tsx` exposes a first-session activation state through `dashboard-activation-state`, with a cash-base checklist and an entry path for the first useful financial reading instead of a generic empty dashboard.
- Implemented: `pages/ImportTransactions.tsx` exposes an `import-idle-state` that asks the user to upload data for review and keeps "review before save" as the first import contract.
- Implemented: `hooks/useFinancialState.ts` now preserves explicitly empty E2E workspace seeds instead of auto-creating the default account, so the visual runner can capture a genuinely empty dashboard state without changing normal production behavior.
- Implemented: `scripts/capture-visual-regression.mjs` now supports focused captures for `dashboard-empty` and `import-idle`; `test-results/visual-regression/2026-06-27T03-10-56-358Z/manifest.json` captured those branches across desktop/mobile with `PASS`.
- Validated offline: `vitest run tests/unit/useFinancialState.test.tsx tests/unit/dashboard-quick-actions.test.tsx --exclude .tmp/** --pool=forks --maxWorkers=1` passed on 2026-06-27 with `2` files and `14` tests; prior focused coverage for Dashboard/Import remains `PASS` with `2` files and `19` tests.
- Validated offline: `npm run type-check:app`, `npm run build`, `npm run audit:claims`, and `npm run audit:evidence` were rerun after this fix; final artifacts are `test-results/audit-claims/2026-06-27T03-15-50-745Z/report.json` and `test-results/audit-evidence/2026-06-27T03-15-58-504Z/report.json`, with `audit:evidence` still `BLOCK` only by external habit/cohort evidence.
- Documented: GPT-5.4-mini subagent review found no P0/P1 issue in Dashboard or Import first-session states. Residual P2/P3 items are limited to extra E2E coverage, an empty-submit error assertion on Dashboard, and small import microcopy guidance for the best first file.
- SEM EVIDENCIA SUFICIENTE: this still does not prove activation lift, user comprehension, or recurring habit.

### 5. Consultative AI offline evaluation

Status: IMPLEMENTED / VALIDATED OFFLINE
Priority: P1
Goal: test whether the AI layer gives specific, prudent, cash-flow-oriented guidance on canonical cases.

Canonical cases:

- negative cash runway
- delayed receivables
- goal at risk
- recurring expense too high
- forecast that is too optimistic

Evidence expected:

- fixtures
- expected-answer contract
- quality runner
- tests against raw-context leakage
- required next action for high-risk cases

What this cannot prove:

- user trust
- willingness to pay for AI
- production LLM cost behavior

Current evidence:

- Implemented: `tests/health/ai-cfo-evaluation.health.test.ts` now covers the canonical offline CFO cases end to end, including the fallback case, against the local offline answer helper and explainability contract.
- Implemented: `tests/unit/gemini-service-fallback.test.ts` asserts the local demo helper returns specific, bounded consultative answers for negative cash runway, delayed receivables, goal at risk, recurring expense too high, and overly optimistic forecast.
- Implemented: `tests/unit/ai-quality-evidence.test.ts` and `scripts/check-ai-quality-evidence.mjs` now keep the canonical offline quality runner in sync and block raw-context leakage plus missing next-action guidance.
- Validated offline: focused AI vitest suites and `node scripts/check-ai-quality-evidence.mjs` both passed on 2026-06-26; latest AI quality artifact is `test-results/ai-quality-evidence/2026-06-26T19-28-18-754Z/report.json`.
- SEM EVIDENCIA SUFICIENTE: this still does not prove user trust, willingness to pay for AI, or production LLM cost behavior.

### 6. Financial readiness checklist

Status: IMPLEMENTED / VALIDATED OFFLINE
Priority: P1
Goal: reduce the risk that a polished UI hides incorrect financial behavior.

Scope:

- rounding
- currency formatting
- local dates and timezone
- categories
- duplicate transactions
- edit/delete consistency
- projected vs realized calculations
- account/transaction/dashboard consistency

Evidence expected:

- checklist with file/test references
- focused financial invariant tests where gaps exist
- known residual risks

What this cannot prove:

- accounting compliance for every jurisdiction

Current findings:

- Documented: `docs/FINANCIAL_READINESS_CHECKLIST_2026-06-27.md` maps rounding, currency formatting, local dates/timezone, categories, duplicate transactions, edit/delete consistency, projected vs realized calculations, and account/dashboard consistency to concrete files and tests.
- Validated offline: `vitest run tests/unit/money-math-invariants.test.ts tests/unit/dashboard-money-math.test.ts tests/unit/receivable-invariants.test.ts tests/unit/weekly-cash-review.test.ts tests/unit/finance-date-local-parsing.test.ts tests/unit/import-transactions-date-label.test.ts tests/unit/import-transactions-draft-path.test.ts tests/unit/forecast-engine.test.ts tests/unit/cashflowEngine.test.ts tests/unit/cashflow-clarity.test.tsx tests/unit/transactionDraft.test.ts tests/unit/transaction-list-edit-category.test.tsx tests/unit/accounts-form.test.tsx --exclude .tmp/** --pool=forks --maxWorkers=1` passed on 2026-06-27 with `13` files and `58` tests.
- Implemented: money rounding, dashboard aggregates, receivable projected/realized alignment, local date parsing, import date labels, duplicate import filtering, transaction review/edit states, and weekly cash-review math all have focused test evidence.
- P0/P1 finding: no new P0/P1 defect found in this offline slice.
- SEM EVIDENCIA SUFICIENTE: bank reconciliation against statements, real provider idempotency, production edit/delete traces, accounting compliance, and real user trust in the numbers remain unproven.

### 7. Security and data hardening review

Status: P1 COOKIE-CSRF MITIGATED / OFFLINE SECURITY SLICE PASS
Priority: P1
Goal: recheck the fintech-sensitive surfaces before deeper product experiments.

Scope:

- auth boundaries
- workspace isolation
- Firestore rules
- billing boundaries
- public endpoints
- logs
- environment variables
- AI prompt/context leakage

Evidence expected:

- static review
- focused tests or existing test references
- P0/P1 finding list if anything is weak

What this cannot prove:

- full penetration-test coverage

Current evidence:

- Implemented: `backend/package.json` no longer ships unused `multer` or `@types/multer`.
- Implemented: `backend/tests/unit/dependency-surface-security.test.ts` asserts that the backend package no longer includes those dependencies and that backend runtime source/scripts contain no multipart upload parser references.
- Documented: `docs/SECURITY_MULTER_DEPENDENCY_REVIEW_2026-06-26.md` records the decision to remove the unused file-upload parser instead of accepting a stale Dependabot major-version bump.
- Validated offline: `npx vitest run --pool=threads backend/tests/unit/dependency-surface-security.test.ts` passed on 2026-06-26 with 1 file and 1 test.
- Fixed P1: cookie-authenticated unsafe backend requests were previously origin-guarded only on `/api/auth/refresh`. `backend/src/middleware/csrfOrigin.ts` now exports `requireTrustedCookieStateChangingOrigin`, and `backend/src/index.ts` installs it globally before routes.
- Documented: `docs/SECURITY_DATA_HARDENING_REVIEW_2026-06-27.md` records the broader offline review for auth cookies, CORS, workspace isolation, Firestore rules, AI input security, storage configuration, dependency surface, and secret scanning.
- Validated offline: `vitest run backend/tests/unit/csrf-origin.test.ts backend/tests/unit/cors-preflight.test.ts backend/tests/unit/auth-routes-security.test.ts backend/tests/unit/auth-cookie-middleware.test.ts backend/tests/unit/server-config.test.ts backend/tests/unit/index-bootstrap-observability.test.ts backend/tests/unit/dependency-surface-security.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1` passed on 2026-06-27 with `7` files and `21` tests.
- Validated offline: `vitest run tests/unit/firestore-rules.static.test.ts tests/unit/workspace-authz-async.test.ts tests/unit/workspace-scoped-runtime-stores.test.ts backend/tests/integration/workspace-authorization.integration.test.ts backend/tests/integration/workspace-storage-isolation.integration.test.ts backend/tests/unit/ai-security-guard.test.ts backend/tests/unit/ai-security-middleware.test.ts backend/tests/unit/external-integration-auth.test.ts backend/tests/unit/storage-config.test.ts backend/tests/unit/storage-config-observability.test.ts backend/tests/unit/database-config-security.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1` passed on 2026-06-27 with `9` files and `81` tests.
- Validated offline: `npm run security:scan-secrets`, `tsc -p backend/tsconfig.json --noEmit --pretty false`, `npm run type-check:app`, and `npm run build` passed on 2026-06-27.
- SEM EVIDENCIA SUFICIENTE: published runtime security headers, full Firestore emulator behavior, production infrastructure settings, real browser/session abuse against the published deployment, billing provider behavior, and live AI prompt-injection monitoring remain unproven.

### 8. Realistic demo dataset

Status: IMPLEMENTED / VALIDATED OFFLINE
Priority: P2
Goal: create or harden a service-business dataset that makes UX, AI, sales demo, and screenshots realistic.

Dataset should include:

- seasonality
- receivables
- fixed costs
- overdue payments
- service revenue
- goals
- cash pressure moments

Evidence expected:

- deterministic seed
- tests for expected dashboard/AI readings
- screenshots using demo data

What this cannot prove:

- real customer data fit

Current findings:

- Implemented: `src/demo/demoBootstrap.ts` now generates a deterministic service-business dataset with `14` transactions, `7` receivables, `7` reminders, `2` accounts, and `2` goals.
- Implemented: the dataset includes recurring service revenue, prior-cycle revenue, fixed operational costs, overdue receivables, open receivables, realized revenue, reserve/provision goals, and a weekly cash-pressure moment.
- Fixed: `hooks/useNavigationTabs.tsx` now passes `receivables` into `CashFlow`; demo workspaces force receivables as source of truth through `src/app/buildNavigationContext.ts`, `components/Dashboard.tsx`, and `components/CashFlow.tsx`.
- Documented: `docs/DEMO_DATASET_READINESS_2026-06-27.md` records expected readings, validation commands, local AI-readout coverage, and residual risks.
- Validated offline: `npx vitest run tests/unit/demoBootstrap.test.ts tests/unit/build-navigation-context.test.ts tests/unit/cashflow-clarity.test.tsx tests/unit/dashboard-quick-actions.test.tsx --exclude .tmp/** --pool=forks --maxWorkers=1` passed on 2026-06-27 with `4` files and `24` tests.
- Validated offline: `npx vitest run tests/unit/demoBootstrap.test.ts tests/unit/gemini-service-fallback.test.ts tests/unit/advanced-analytics-date-safety.test.tsx tests/unit/weekly-cash-review.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1` passed on 2026-06-27 with `4` files and `23` tests.
- Validated offline: `npm run type-check:app` and `npm run build` passed on 2026-06-27.
- Validated visually: `test-results/visual-regression/2026-06-27T08-28-36-434Z/manifest.json` captured `dashboard`, `flow`, and `assistant` across desktop/mobile with `PASS`, `6` screenshots, `consoleIssues=0`, and `pageErrors=0`.
- Validated visually: `test-results/visual-regression/2026-06-27T08-28-57-915Z/manifest.json` captured `dashboard`, `flow`, `analytics`, and `cfo` across desktop/mobile with `PASS`, `8` screenshots, `consoleIssues=0`, and `pageErrors=0`.
- Validated offline: `npm run audit:claims` produced `test-results/audit-claims/2026-06-27T08-33-30-674Z/report.json` with `PASS`; `npm run audit:evidence` produced `test-results/audit-evidence/2026-06-27T08-33-35-924Z/report.json` and remains `BLOCK` only by habit/cohort evidence.
- SEM EVIDENCIA SUFICIENTE: real customer data fit, vertical-specific seasonality, sales-demo conversion, and whether operators recognize this as their business remain unproven.

### 9. Pricing and packaging without live billing changes

Status: IMPLEMENTED / VALIDATED OFFLINE
Priority: P2
Goal: prepare monetization surfaces without changing production billing unless explicitly approved.

Scope:

- plan boundaries
- soft limits
- upgrade surfaces
- free/pro value logic
- pricing copy aligned to cash-flow decisions

Evidence expected:

- documented packaging contract
- UI tests for upgrade prompts
- no unsupported paid-conversion claim

What this cannot prove:

- willingness to pay
- paid conversion
- LTV

Current findings:

- Implemented: `src/app/monetizationPlan.ts` now centralizes the Free/Pro packaging contract, price labels, feature messages, upgrade prompt bullets, and explicit evidence boundary.
- Implemented: `pages/Pricing.tsx`, `components/UpgradePromptCard.tsx`, `pages/AICFO.tsx`, and `pages/Insights.tsx` now consume the shared packaging contract instead of drifting copy and price snippets per surface.
- Implemented: `src/saas/billingClient.ts` no longer returns `plans: []` in local fallback/demo catalogs; it exposes Free/Pro plans with limits from `src/saas/policyEngine.ts` and packaging messages from `src/app/monetizationPlan.ts`.
- Fixed: `components/Settings.tsx` no longer frames report export as a Pro benefit while the backend still lacks real report generation.
- Documented: `docs/PRICING_PACKAGING_READINESS_2026-06-30.md` records the packaging contract, validation command, evidence boundary, and billing/env risk.
- Validated offline: `npx vitest run tests/unit/monetization-plan.test.ts tests/unit/pricing-upgrade-checkout.test.tsx tests/unit/aicfo-plan-render.test.tsx tests/unit/insights-plan-render.test.tsx tests/unit/settings-workspace-admin.test.tsx tests/unit/workspace-admin-page.test.tsx tests/unit/billing-client.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1` passed on 2026-06-30 with `7` files and `47` tests.
- Validated offline: `npm run type-check:app`, `npm run build`, `node scripts/capture-visual-regression.mjs --surfaces=pricing --viewports=desktop,mobile`, `npm run audit:claims`, and `npm run audit:evidence` were rerun after Step 9. Final artifacts are `test-results/visual-regression/2026-06-30T05-19-34-432Z/manifest.json`, `test-results/audit-claims/2026-06-30T05-20-03-016Z/report.json`, and `test-results/audit-evidence/2026-06-30T05-20-07-092Z/report.json`; `audit:evidence` remains `BLOCK` only by habit/cohort evidence.
- SEM EVIDENCIA SUFICIENTE: willingness to pay, paid conversion, LTV, churn, CAC, price elasticity, and whether the new Free/Pro framing improves activation or retention.
- Residual production risk: before any real checkout, published envs and Stripe must confirm `SAAS_PRO_MONTHLY_PRICE_CENTS=4900`, `STRIPE_PRICE_PRO_MONTHLY`, webhook, portal, and customer state are aligned with the visible `R$ 49,00/mes` packaging.

### 10. Brutal copy and positioning review

Status: IMPLEMENTED / VALIDATED OFFLINE
Priority: P1
Goal: remove generic finance/AI language and reinforce the Flow Finance thesis.

Keep:

- cash flow
- projected vs realized
- receivables
- weekly cash review
- operational-financial linkage
- consultative AI for decision clarity

Cut or demote:

- generic finance assistant language
- autonomous CFO claims
- broad automation claims
- Open Banking/OCR-first framing unless evidence makes it central

Evidence expected:

- copy inventory
- changed strings with file references
- claims guard passing

What this cannot prove:

- market differentiation by itself

Current findings:

- Implemented: `components/Login.tsx` no longer exposes implementation-flavored Firebase/local-login copy in the auth footer; it now frames access as the cash workspace panel.
- Implemented: `pages/Insights.tsx` first-session copy now anchors the user in building the first cash picture before deciding payment, collection, or waiting.
- Implemented: `components/CashFlow.tsx` now uses cash-flow wording in export and strategy surfaces instead of revenue-only or generic financial-step wording.
- Implemented: `src/app/monetizationPlan.ts`, `pages/Pricing.tsx`, and `components/UpgradePromptCard.tsx` now reinforce Free/Pro around cash review, projected vs realized, history, receivables, and workspaces instead of generic finance-assistant claims.
- Implemented: `src/app/mainNavigation.ts` changed the main section label from `IA` to `Decisao`, keeping `Lab IA` dev-only.
- Implemented: `pages/AICFO.tsx`, `components/AIInput.tsx`, `components/TransactionList.tsx`, `pages/ImportTransactions.tsx`, `components/Dashboard.tsx`, `components/CashFlow.tsx`, and `components/Settings.tsx` now use operational language around weekly cash review, draft review, category suggestions, receivables, next outflows, and cash decisions instead of front-stage IA/CFO wording.
- Documented: `docs/COPY_POSITIONING_REVIEW_2026-06-30.md` records the copy inventory, changed surfaces, evidence boundary, validation commands, and residual commercial uncertainty.
- Validated offline: `npx vitest run tests/unit/transaction-list-edit-category.test.tsx tests/unit/transaction-list-states.test.tsx tests/unit/settings-workspace-admin.test.tsx tests/unit/monetization-plan.test.ts tests/unit/pricing-upgrade-checkout.test.tsx tests/unit/insights-plan-render.test.tsx tests/unit/cashflow-clarity.test.tsx --exclude .tmp/** --pool=forks --maxWorkers=1` passed on 2026-06-30 with `7` files and `42` tests.
- Validated offline: `npm run type-check:app`, `npm run build`, `npm run docs:check-links`, `npm run docs:check-mojibake`, `npm run audit:claims`, `npm run audit:evidence`, Graphify regeneration, and the focused visual regression bundle `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`.
- Validated offline: `npx vitest run tests/unit/monetization-plan.test.ts tests/unit/pricing-upgrade-checkout.test.tsx tests/unit/aicfo-plan-render.test.tsx tests/unit/cashflow-clarity.test.tsx tests/unit/dashboard-quick-actions.test.tsx tests/unit/import-transactions-session.test.tsx tests/unit/settings-workspace-admin.test.tsx tests/unit/ai-input.test.tsx tests/unit/transaction-list-edit-category.test.tsx tests/unit/transaction-list-suggestion-diagnostic.test.tsx tests/unit/transaction-list-category-learning-diagnostic.test.tsx tests/unit/main-navigation.test.ts tests/unit/app-shell-navigation.test.tsx tests/unit/app-dev-tools-composition.test.tsx --exclude .tmp/** --pool=forks --maxWorkers=1` passed on 2026-06-30 with `14` files and `78` tests.
- Validated offline: `node --check scripts/capture-visual-regression.mjs`, `npm run type-check:app`, `npm run build`, and `node scripts/capture-visual-regression.mjs --tabs=dashboard,flow,import,cfo,settings --surfaces=pricing --viewports=desktop,mobile` passed; current visual artifact is `test-results/visual-regression/2026-06-30T14-01-50-977Z/manifest.json`.
- SEM EVIDENCIA SUFICIENTE: no user interview, paid conversion, retention, or market comparison proves that this copy is differentiated enough in the market.

## 11. Published infra, headers, and billing boundary

Status: PUBLIC RUNTIME HEADERS PASS / LOCAL SCRIPT+STYLE CSP PASS / FIRESTORE EMULATOR PASS / STRIPE BLOCKED WITHOUT CREDENTIALS

Goal: reduce production-readiness uncertainty that can be checked without real app usage, secrets, or live checkout.

Evidence:

- Implemented: `vercel.json` now configures frontend-wide `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` for the static app shell.
- Implemented: `.vercelignore` now excludes local artifacts from Vercel deploy uploads after the first frontend deploy attempt failed on a locked `.tmp/jdk21/jdk21.zip` artifact.
- Implemented: `vercel.json` now uses `rewrites` instead of legacy `routes`, because the first published redeploy still did not apply top-level headers to the SPA root.
- Verified public runtime: `https://flow-finance-backend.vercel.app/api/health` and `/api/version` returned `200` on 2026-06-30 with `workspacePersistence.mode=firebase`, `domainEventPersistence.mode=firebase`, `durable=true`, `configured=true`, and `required=true`.
- Verified public runtime: backend responses exposed Helmet-style security headers including CSP, HSTS, nosniff, frame, referrer, and opener policy.
- Verified public runtime: `GET /api/saas/plans` returned `401` without auth; Stripe webhook without valid signature returned `401`; checkout/portal POSTs without auth returned `401`; allowed-origin CORS preflight returned `204`; disallowed-origin preflight did not return a permissive response.
- Validated: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json OK')"`, `npm run build`, and `npm run type-check:app` passed after the frontend edge header change.
- Verified published deployment: official frontend `dpl_3YmbPgVcFhxv8HnmsMx6cFEPRDSi` is `READY` and aliased to `https://flow-finance-frontend-nine.vercel.app`.
- Verified published deployment: alternate frontend `dpl_5qgv5j99TUAGBMbUncPavkvnAwU8` is `READY` and aliased to `https://flow-finance-xi.vercel.app`.
- Verified public runtime: `npm run health:published-headers` passed in strict mode for the official frontend, artifact `test-results/published-headers/2026-06-30T22-39-12-012Z.json`.
- Verified public runtime: `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers` passed in strict mode for the alternate frontend, artifact `test-results/published-headers/2026-06-30T22-39-12-189Z.json`.
- Implemented: inline importmap/bootstrap were removed from `index.html`; service-worker bootstrap now lives in `public/flow-bootstrap.js`.
- Implemented: frontend CSP now publishes `script-src 'self'`; the published headers runner blocks regressions that reintroduce `'unsafe-inline'` or `https://esm.sh` under `script-src`.
- Implemented: runtime guard reload actions no longer use inline `onclick`/hover handlers; event listeners are registered from code.
- Implemented: `scripts/check-csp-readiness.mjs` and `npm run health:csp-readiness` now inventory script/style CSP readiness and preserve the remaining style debt as explicit evidence.
- Implemented: frontend runtime guards, product surfaces, progress bars, logo animation, dev AI panels, and Vercel frontend CSP were migrated away from inline style/script surfaces so the local CSP readiness gate can enforce `style-src` without `'unsafe-inline'`.
- Verified published deployment: official frontend `dpl_YZc7iFsJtcBp3AX9Vky3N2eitwfV` is `READY` and aliased to `https://flow-finance-frontend-nine.vercel.app`.
- Verified published deployment: alternate frontend `dpl_6r3DVKQsgVUVgQFBsFykko8W3oXu` is `READY` and aliased to `https://flow-finance-xi.vercel.app`.
- Verified public runtime: `npm run health:published-headers` passed for script CSP on the official frontend, artifact `test-results/published-headers/2026-07-01T12-47-26-231Z.json`.
- Verified public runtime: `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers` passed for script CSP on the alternate frontend, artifact `test-results/published-headers/2026-07-01T12-48-04-023Z.json`.
- Verified published deployment: official frontend `dpl_GVoQNYWMFMAMtWHTJMBtjda9defc` is `READY` and aliased to `https://flow-finance-frontend-nine.vercel.app`.
- Verified published deployment: alternate frontend `dpl_Bv1wu9QbSyqez2qm4hSqCfjuCAtL` is `READY` and aliased to `https://flow-finance-xi.vercel.app`.
- Verified public runtime: `npm run health:published-headers` passed after runtime handler removal, artifact `test-results/published-headers/2026-07-01T12-57-27-553Z.json`.
- Verified public runtime: `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers` passed after runtime handler removal, artifact `test-results/published-headers/2026-07-01T12-57-27-739Z.json`.
- Verified local inventory: `npm run health:csp-readiness` produced `test-results/csp-readiness/2026-07-01T18-03-23-764Z.json` with `PASS`, `scriptBlockers: []`, `styleBlockers: []`, `scriptCspReady: true`, and `styleCspReady: true`.
- Verified published deployment: official frontend `dpl_3aMx98ErwTseg6TDbhRJgYnsMdFs` is `READY` and aliased to `https://flow-finance-frontend-nine.vercel.app`.
- Verified published deployment: alternate frontend `dpl_FjwvsZVfZDKESRS38rt7g2Hr5ZQo` is `READY` and aliased to `https://flow-finance-xi.vercel.app`.
- Verified public runtime: `npm run health:published-headers` passed after style CSP hardening, artifact `test-results/published-headers/2026-07-01T18-04-27-142Z.json`; frontend oficial has no `script-src` or `style-src` violation.
- Verified public runtime: `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers` passed after style CSP hardening, artifact `test-results/published-headers/2026-07-01T18-04-27-062Z.json`; frontend alternativo has no `script-src` or `style-src` violation.
- Verified public runtime: `npm run health:vercel` passed against the official backend; `/health`, `/api/health`, and `/api/version` matched expected contracts and `/` returned the expected API-only `404`.
- Implemented: `scripts/check-published-headers.mjs` now writes JSON/Markdown evidence under `test-results/published-headers/`; current artifact is `test-results/published-headers/2026-06-30T22-15-24-810Z.json`.
- Implemented: backend billing fallback and env examples now use `SAAS_PRO_MONTHLY_PRICE_CENTS=4900`, aligned with the visible Pro packaging.
- Validated offline: `npx vitest run tests/unit/billing-service.test.ts tests/unit/monetization-plan.test.ts tests/unit/firestore-rules.static.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1` passed with `3` files and `26` tests.
- Validated offline: `npm --prefix backend run type-check`, `npm run type-check:app`, and `npm run security:scan-secrets` passed.
- Blocked external gate: `npm run health:stripe-live-smoke` produced `test-results/stripe-live-smoke/2026-06-30T22-15-34-658Z.json` with `BLOCK` because target URL, return URL, auth bearer/cookie, and workspace id were not present in this environment.
- Implemented: `scripts/run-firestore-rules.mjs` now detects the portable JDK 21 under `.tmp/jdk21/` when no global Java 21+ is configured.
- Verified offline: `npm run test:firestore:rules` passed with Firestore emulator, `3` files, and `16` tests using the portable JDK 21.
- Documented: `docs/EXTERNAL_PRODUCTION_GATES_2026-06-30.md` records billing, headers, Stripe, and Firestore gate evidence.
- Documented: `docs/PUBLISHED_INFRA_BILLING_CHECK_2026-06-30.md` records commands, evidence, limits, and residual risks.
- SEM EVIDENCIA SUFICIENTE: authenticated real app behavior under the strict frontend CSP; the published headers and static/runtime inventory are evidenced, but real-use flows still need browser validation.
- SEM EVIDENCIA SUFICIENTE: published Stripe price/env alignment, real checkout, real portal session, webhook secret alignment, paid conversion, and workspace billing reconciliation remain unproven by this unauthenticated slice.
- SEM EVIDENCIA SUFICIENTE: real Firestore behavior in the published Firebase project remains unproven by the emulator run.

## Current execution order

1. Provide Stripe smoke env/auth context and rerun `npm run health:stripe-live-smoke`.
2. Before any paid billing claim, run authenticated Stripe smoke against the published backend with controlled workspace credentials.
3. Optional P2/P3 polish for remaining legacy/dev-only language and automated visual diff baseline after the MVP surface set stabilizes.
4. Resume real-use evidence collection for habit/cohort state when app testing becomes available.

## Current active subagent split

- GPT-5.4-mini visual subagents on 2026-06-30 completed read-only modal/state review for transaction, cash-flow, assistant, support/legal, auth, and empty-state screenshots.
- GPT-5.4-mini infra explorer on 2026-06-30 mapped published URLs, endpoint boundaries, and config evidence for the public infra/billing check.
- GPT-5.4-mini billing, headers, and Firestore subagents on 2026-06-30 split the external-gate work into billing/env, published headers, and emulator/security-rule readiness.

## Current honest verdict

The product can still improve materially without new user sessions.

The highest-leverage offline work is not adding features. It is making the product easier to inspect, easier to measure, harder to misclaim, and more clearly centered on the weekly cash decision for service businesses.

Until real usage resumes, all durable-habit, paid-conversion, willingness-to-pay, CAC, LTV, churn, and market-demand claims remain `SEM EVIDENCIA SUFICIENTE`.
