# Flow Finance - realistic demo dataset readiness

Data: 2026-06-27
Status: IMPLEMENTED / VALIDATED OFFLINE

## Boundary

This review covers the local demo dataset used by `demoData=1` in development/localhost and by the visual regression runner.

It does not prove real customer data fit, retention, willingness to pay, or that the demo matches every service-business vertical. Those remain `SEM EVIDENCIA SUFICIENTE`.

## Implemented Changes

### S8-001 - Demo dataset was too thin for service-business evaluation

Severity: P2

Evidence before:

- `src/demo/demoBootstrap.ts` generated a short dataset with `7` transactions, `3` receivables, `3` reminders, `2` accounts, and `1` goal.
- `docs/OFFLINE_PRODUCT_READINESS_BACKLOG_2026-06-19.md` required seasonality, receivables, fixed costs, overdue payments, service revenue, goals, and cash pressure moments.

Change:

- Expanded `createDemoWorkspaceEntities` to `14` transactions, `7` receivables, `7` reminders, `2` accounts, and `2` goals.
- Added service-business signals:
  - project revenue and monthly retainer revenue
  - prior-cycle revenue for seasonality/history
  - fixed operational costs, software, taxes/accounting, partner delivery costs, and acquisition costs
  - multiple customer/project labels
  - open, overdue, and realized receivables
  - weekly cash pressure with negative confirmed weekly cash but positive projected cash if receivables arrive
  - reserve and tax-provision goals
- Tightened `tests/unit/demoBootstrap.test.ts` so the fixture now locks not only aggregate dashboard numbers, but also seasonal/campaign wording, fixed-cost wording, cash-review pressure, and a local `buildLocalCFOAnswer` risk reading.

### S8-002 - Demo visual flow was not using receivables consistently

Severity: P2

Evidence before:

- `hooks/useNavigationTabs.tsx` had `receivables` in `NavigationRenderContext`, but the `flow` tab rendered `CashFlow` without passing `receivables`.
- `Dashboard` and `CashFlow` already had pure functions capable of using receivables as source of truth, but the demo path did not force that behavior.

Change:

- `hooks/useNavigationTabs.tsx` now passes `receivables` into `CashFlow`.
- `NavigationRenderContext` now carries `forceReceivablesSourceOfTruth`.
- `src/app/buildNavigationContext.ts` enables that flag only when a demo workspace plan is active.
- `components/Dashboard.tsx` and `components/CashFlow.tsx` respect the optional force flag.

Production behavior remains controlled by `VITE_RECEIVABLES_AS_SOURCE_OF_TRUTH` unless demo mode is active.

## Expected Offline Readings

With reference date `2026-05-26T12:00:00.000Z`, the deterministic demo seed produces:

- transactions: `14`
- receivables: `7`
- reminders: `7`
- goals: `2`
- current balance: `R$ 8.260,00`
- current-month confirmed revenue: `R$ 19.600,00`
- current-month confirmed outflow: `R$ 14.250,00`
- current-month pending revenue from receivables: `R$ 8.000,00`
- overdue receivables: `R$ 5.300,00`
- current-month projected receivables: `R$ 13.300,00`
- weekly confirmed cash: `-R$ 980,00`
- weekly projected receivables: `R$ 8.000,00`
- weekly outcome: `tight`

## Validation Run

- `npx vitest run tests/unit/demoBootstrap.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, 1 file, 4 tests.
- `npx vitest run tests/unit/demoBootstrap.test.ts tests/unit/build-navigation-context.test.ts tests/unit/cashflow-clarity.test.tsx tests/unit/dashboard-quick-actions.test.tsx --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, 4 files, 24 tests.
- `npx vitest run tests/unit/demoBootstrap.test.ts tests/unit/gemini-service-fallback.test.ts tests/unit/advanced-analytics-date-safety.test.tsx tests/unit/weekly-cash-review.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, 4 files, 23 tests.
- `npm run type-check:app`: `PASS`.
- `npm run build`: `PASS`.
- `node scripts/capture-visual-regression.mjs --tabs=dashboard,flow,assistant --viewports=desktop,mobile`: `PASS`, `test-results/visual-regression/2026-06-27T08-28-36-434Z/manifest.json`, 6 screenshots, `consoleIssues=0`, `pageErrors=0`.
- `node scripts/capture-visual-regression.mjs --tabs=dashboard,flow,analytics,cfo --viewports=desktop,mobile`: `PASS`, `test-results/visual-regression/2026-06-27T08-28-57-915Z/manifest.json`, 8 screenshots, `consoleIssues=0`, `pageErrors=0`.

## Residual Findings

### S8-R1 - Real customer data fit remains unproven

Severity: P2

Evidence: this dataset is deterministic demo data, not imported from a real service business.

Risk: sales/demo confidence can still diverge from what real operators recognize as their workflow.

Recommended correction: compare this dataset against at least one real service-business pilot export before using it as market proof.

### S8-R2 - Forecast surface still depends on selected timeframe semantics

Severity: P3

Evidence: `CashFlow` 30-day recut emphasizes overdue receivables within the past-window view; future open receivables appear when the user opens the projected/pending surfaces or uses a wider/forward-looking review.

Risk: a sales demo may need a scripted path to show both current overdue pressure and upcoming receipts.

Recommended correction: document the demo walkthrough path or add a forward-looking preset after the MVP scope is stable.

## Decision

Step 8 can move from `PLANNED` to `IMPLEMENTED / VALIDATED OFFLINE`.

Do not use this as evidence of real customer data fit or commercial demand.
