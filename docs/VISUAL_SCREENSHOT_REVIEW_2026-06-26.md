# Flow Finance - visual screenshot review

Date: 2026-06-26

Scope: manual review of the current visual capture bundles, ending with the focused CFO mobile safe-area recapture `test-results/visual-regression/2026-06-26T19-19-19-381Z/manifest.json`.

Continuation: on 2026-06-30, GPT-5.5 orchestration with GPT-5.4-mini subagent review inspected the remaining modal/state screenshots from `test-results/visual-regression/2026-06-26T14-10-53-868Z/`.

Remediation follow-up: on 2026-06-30, the P1 modal-level findings and the highest-impact P2 wording/action hierarchy findings were remediated and recaptured in `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`.

This review uses screenshots as technical/design evidence. It does not prove user preference, activation lift, conversion, retention, or willingness to pay.

## Evidence

- Capture bundle: `test-results/visual-regression/2026-06-26T13-36-28-434Z/manifest.json`
- Consolidated route/modal/state bundle: `test-results/visual-regression/2026-06-26T14-10-53-868Z/manifest.json`
- Focused Analytics recapture after remediation: `test-results/visual-regression/2026-06-26T14-11-43-872Z/manifest.json`
- Focused CFO safe-area recapture after remediation: `test-results/visual-regression/2026-06-26T19-19-19-381Z/manifest.json`
- Focused modal/copy recapture after remediation: `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`
- Coverage: 48 screenshots, 13 tabs, 11 route/modal surfaces, desktop/mobile in the consolidated bundle.
- Runner result: `PASS`, `consoleIssues=0`, `pageErrors=0`
- Manually inspected samples:
  - `dashboard-desktop.png`
  - `dashboard-mobile.png`
  - `analytics-desktop.png`
  - `cfo-mobile.png`
  - `pricing-mobile.png`
- Additional inspected modal/state samples:
  - `ai-input-modal-desktop.png`
  - `ai-input-modal-mobile.png`
  - `transaction-edit-modal-desktop.png`
  - `transaction-edit-modal-mobile.png`
  - `transaction-delete-modal-desktop.png`
  - `transaction-delete-modal-mobile.png`
  - `cashflow-share-modal-desktop.png`
  - `cashflow-share-modal-mobile.png`
  - `cashflow-strategy-modal-desktop.png`
  - `cashflow-strategy-modal-mobile.png`
  - `assistant-smart-alerts-desktop.png`
  - `assistant-smart-alerts-mobile.png`
  - `settings-support-desktop.png`
  - `settings-support-mobile.png`
  - `settings-legal-desktop.png`
  - `settings-legal-mobile.png`
  - `insights-empty-desktop.png`
  - `insights-empty-mobile.png`
  - `auth-gate-desktop.png`
  - `auth-gate-mobile.png`

## Verdict

Status: CAPTURE COVERAGE PASS / VISUAL REVIEW COMPLETE FOR OFFLINE READINESS.

The current visual system is good enough to continue offline readiness work, but not good enough to call the MVP visually closed.

The main product surfaces now read as a cash-flow operating tool instead of a generic finance dashboard. The weak spots are secondary/legacy framing, modal density, and generic SaaS visual language on auth, empty, support, and auxiliary modal surfaces.

## Screen Findings

### Dashboard

Score: 8/10
Confidence: high
Evidence: `dashboard-desktop.png`, `dashboard-mobile.png`

Finding: the dashboard is the strongest current product surface. It makes confirmed cash, pending receivables, overdue receivables, weekly review, and next actions visible without leaning on generic AI language.

Risk: if later modules become visually louder than this screen, the product will drift back toward a generic dashboard suite.

Recommended action: preserve this hierarchy as the MVP reference surface.

Priority: P2

### Modal and state coverage

Score: 6/10
Confidence: medium
Evidence: `test-results/visual-regression/2026-06-26T14-10-53-868Z/ai-input-modal-mobile.png`, `transaction-edit-modal-mobile.png`, `transaction-delete-modal-mobile.png`, `cashflow-share-modal-mobile.png`, `cashflow-strategy-modal-mobile.png`, `assistant-smart-alerts-mobile.png`, `settings-support-mobile.png`, `settings-legal-mobile.png`, `insights-empty-mobile.png`, `auth-gate-mobile.png`

Finding: the remaining modal/state screenshots are usable and do not show a P0 blocker. The previous P1 issue was category-chip truncation in `transaction-edit-modal-*`, where labels such as `TRABALHO /...` and `INVESTIMEN...` made the category choice look unfinished, especially on mobile.

Impact: modal-level polish is not blocking offline QA, but it weakens trust in a financial product because important labels can look clipped or ambiguous at the exact moment the user edits financial classification.

Remediation: `components/TransactionList.tsx` now lets category labels wrap, uses a one-column mobile grid, and gives chips stable height so the category choice remains readable. Covered by `tests/unit/transaction-list-edit-category.test.tsx` and focused recapture `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`.

Priority: P1

### Support and legal modals

Score: 6/10
Confidence: medium
Evidence: `settings-support-desktop.png`, `settings-support-mobile.png`, `settings-legal-desktop.png`, `settings-legal-mobile.png`

Finding: support is functional. The previous P1 issue was that the mobile chat composer was cramped and the placeholder truncated before any user input. The legal modal remains legible but dense on mobile.

Impact: the support modal is a trust surface. A cramped input field can make help feel unreliable, while dense legal copy increases friction during account or plan review.

Remediation: `components/Settings.tsx` now stacks the support input and action on mobile, lets the input take full width, and preserves a compact horizontal composer on larger screens. Covered by `tests/unit/settings-workspace-admin.test.tsx` and focused recapture `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`.

Priority: P1 for support composer, P2 for legal density

### Flow export and strategy modals

Score: 7/10
Confidence: medium
Evidence: `cashflow-share-modal-desktop.png`, `cashflow-share-modal-mobile.png`, `cashflow-strategy-modal-desktop.png`, `cashflow-strategy-modal-mobile.png`, `assistant-smart-alerts-desktop.png`, `assistant-smart-alerts-mobile.png`

Finding: the content is aligned with cash-flow decisions and no text overflow is obvious. The previous P2 issues were that `cashflow-share-modal-*` titled the action as `Exportar receitas` while the summary included entradas/saidas, and that the strategy modal made `Sair` visually stronger than the useful sharing action.

Impact: inconsistent financial labels create avoidable doubt in a cash-flow product. Inverted action hierarchy can reduce completion of useful next steps.

Remediation: `components/CashFlow.tsx` now titles the share modal as `Exportar fluxo de caixa`, frames the strategy area as `Proxima decisao de caixa`, and makes `Enviar plano` the primary footer action while `Sair` becomes secondary. Covered by `tests/unit/cashflow-clarity.test.tsx` and focused recapture `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`.

Priority: P2

### Auth and empty states

Score: 6/10
Confidence: medium
Evidence: `auth-gate-desktop.png`, `auth-gate-mobile.png`, `insights-empty-desktop.png`, `insights-empty-mobile.png`

Finding: these screens are clean and functional. The auth gate previously included implementation-flavored wording such as Firebase/local login/recovery instead of user-facing cash-flow value.

Impact: this does not block use, but it weakens differentiation and can make the product feel like a template rather than a focused financial operating tool.

Remediation: `components/Login.tsx` replaces the implementation-flavored footer with workspace cash-panel language, and `pages/Insights.tsx` now points first-session users to build the first cash reading before payment, collection, or wait decisions. Covered by `tests/unit/insights-plan-render.test.tsx` and focused recapture `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`.

Priority: P2

### Advanced Analytics

Score: 6/10
Confidence: high
Evidence: `test-results/visual-regression/2026-06-26T14-11-43-872Z/analytics-desktop.png`, `components/AdvancedAnalytics.tsx`, `src/demo/demoBootstrap.ts`, `tests/unit/demoBootstrap.test.ts`, `tests/unit/advanced-analytics-date-safety.test.tsx`

Finding: the previous blocker was real: category expenses rendered as an empty/near-useless chart even when the demo had expenses. The screen now has visible category bars, realistic service-business demo expenses, responsive chart frames, and an explicit empty state for missing category data.

Impact: the screen no longer damages trust through obviously broken chart output. It still feels broader than the MVP because it is a stack of generic report charts rather than a focused weekly cash decision surface.

Recommended action: keep the technical remediation, but still demote or reframe the route unless it becomes explicitly about cash history, projected vs realized, and recurring risk. Do not expand it as a generic analytics suite.

Priority: P2

### Consultor de caixa

Score: 8/10
Confidence: high
Evidence: `test-results/visual-regression/2026-06-26T19-19-19-381Z/cfo-mobile.png`, `pages/AICFO.tsx`, `tests/unit/aicfo-plan-render.test.tsx`

Finding: the page language is aligned with consultative AI: base used, confidence, posture, and short cash questions. The previous mobile issue where the bottom "Pergunta rapida" composer was partially cut is fixed with mobile safe-area spacing and covered by a unit test.

Impact: the main AI surface is now clearer for mobile reading and input. This remains technical/visual evidence, not proof that users trust or pay for the AI.

Recommended action: preserve the bounded cash guidance wording and avoid expanding the surface into autonomous CFO claims.

Priority: P1

### Pricing

Score: 7/10
Confidence: medium
Evidence: `pricing-mobile.png`

Finding: pricing copy is aligned with the MVP. It frames Free around operational cash flow and Pro around review/history without claiming paid conversion or autonomous CFO value.

Risk: pricing still lacks market validation. The UI can be technically ready while willingness to pay remains `SEM EVIDENCIA SUFICIENTE`.

Recommended action: keep the copy conservative and test packaging later with real prospects.

Priority: P2

## Decisions

- Dashboard is the visual reference for MVP hierarchy.
- Advanced Analytics is technically usable after the category chart fix, but should not be treated as core MVP until reframed.
- The CFO mobile bottom input safe-area issue was remediated and captured.
- Pricing can remain as a conservative offline-ready surface, but it is not proof of monetization.
- Modal/state screenshot review is complete enough for offline readiness tracking.
- The 2026-06-30 remediation closed the specific P1 debts for readable category chips and support composer width, plus the highest-impact P2 debts in cash-flow export wording, strategy action hierarchy, and generic auth/Insights empty-state language.

## Remaining Work

- Keep the 2026-06-30 modal/copy recapture as the current offline evidence for the remediated P1/P2 items.
- Treat legal modal density and any remaining generic wording outside the remediated surfaces as P2/P3 product-polish debt.
- Add a pixel-diff or baseline comparison only after the MVP surface set is stable.
- Re-run the consolidated visual capture after any broader navigation, CFO, or Advanced Analytics change.

## Evidence Boundary

- Implemented: visual capture and manual/subagent inspection covered the current core route, modal, and state screenshots available in the repo.
- Documented: this file records the current screenshot-based visual assessment and residual risks.
- Inferred: the generic-SaaS risk comes from repeated card/pill/modal patterns and implementation-flavored copy.
- SEM EVIDENCIA SUFICIENTE: no evidence proves user preference, conversion lift, activation lift, focus management, keyboard order, screen-reader behavior, scroll lock, or real touch-target comfort.
