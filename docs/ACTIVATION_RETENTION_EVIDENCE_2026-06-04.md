# Flow Finance - activation and retention evidence, published gate closed

Data: 2026-06-05
Status: closed with real backend-published evidence. The runner stays available for refresh and recheck.

## Purpose

This document records the backend-authenticated evidence that closed the public-launch activation/retention gate described in [GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md](./GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md).

The closure evidence is:

- export artifact: `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`
- export rows: `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/events.jsonl`
- checker PASS: `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json`
- checker report: `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.md`
- verified handoff: `test-results/activation-retention-export/published-export-verified.json`

The gate was closed from a backend-published, authenticated workspace cohort export. The separate frontend published shell loading issue stays separate and does not reopen this gate.

The runner itself does not close the gate. If the supplied data is not enough, future refresh runs must still emit `BLOCK` with the exact text `SEM EVIDENCIA SUFICIENTE`.

## Export flow

The backend export script reads real product events from `GET /api/finance/events` using the existing authenticated context:

- bearer token or cookie header
- `x-workspace-id`
- backend URL for the published target or live backend

Run it with:

```bash
node scripts/export-activation-retention-events.mjs --backend-url <backend-url> --workspace-id <workspace-id>
```

The script writes a timestamped export folder under `test-results/activation-retention-export/` and emits a normalized `events.jsonl` file with only these fields:

- `event_name`
- `occurred_at`
- `workspace_id`
- `user_id`

The export stays `BLOCK` until it proves both activation and retention rows for the same real workspace/user pair. That keeps the export non-destructive and makes the pass/fail state obvious before the file is reused as evidence.

## Source events in the app

The current client analytics surface already emits the following product events in `src/app/productAnalytics.ts`:

- `activation_first_transaction`
- `activation_first_dashboard_useful`
- `weekly_cash_review_completed`
- `billing_checkout_started`
- `billing_checkout_redirected`
- `billing_checkout_failed`
- `billing_portal_started`
- `billing_portal_redirected`
- `billing_portal_failed`

Only the activation and retention events are allowed to prove this gate. Billing events may be reported as context, but they do not satisfy activation or retention evidence.

## Minimum input contract

The runner expects a real export in JSON, JSONL, or CSV form.

Required fields after normalization:

- `event_name`
- `occurred_at`
- `workspace_id`
- `user_id`
- an explicit cohort window in days

Accepted aliases are handled by the runner, but the normalized contract above is the minimum that must be present in the data.

If any of those pieces are missing, the report stays open and explains exactly what was absent.

## Required event coverage

The export must contain at least:

- one activation event row, using `activation_first_transaction` or `activation_first_dashboard_useful`
- one retention event row, using `weekly_cash_review_completed`
- the same real workspace/user pair across the activation and retention rows
- a retention observation that fits inside the supplied cohort window

This runner does not invent a cohort, date window, or conversion rate. It only checks what the supplied export can prove.

## What the runner computes

The runner only calculates items that are directly justified by the data:

- parsed record count
- valid versus invalid rows
- event counts for rows that match the evidence contract
- earliest and latest observed timestamps
- activation cohorts anchored by real workspace/user pairs
- retained cohorts inside the supplied window
- billing event counts as supporting context only

It does not synthesize a funnel, a retention rate, or a historical metric that is not backed by the input export.

## How to run

```bash
npm run health:activation-retention -- --input <path-to-export> --cohort-window-days <days>
```

Supported formats:

- `.json`
- `.jsonl`
- `.csv`

Environment variables:

- `ACTIVATION_RETENTION_EVIDENCE_INPUT`
- `ACTIVATION_RETENTION_EVIDENCE_OUTPUT_DIR`
- `ACTIVATION_RETENTION_COHORT_WINDOW_DAYS`

The runner writes an audit bundle into `test-results/activation-retention-evidence/` by default.

The promoted verified artifact is `test-results/activation-retention-export/published-export-verified.json` with `verified: true`.

## Output

Each run creates a timestamped folder containing:

- `report.json`
- `report.md`

The artifact records:

- what was found
- what was missing
- why the gate stayed open or closed
- the exact source path and hash of the export that was evaluated

## Gate logic

The gate is only considered clear when the export proves real activation and retention evidence for a real workspace/user cohort within the declared window.

If the export does not prove that, future refresh runs remain `BLOCK` and the output must say `SEM EVIDENCIA SUFICIENTE`. That runner behavior does not change the fact that the operational gate is already closed by the published evidence above.

This aligns with the launch gate in [GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md](./GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md) and the operational runbook in [OPERATIONS_SLO_RUNBOOK_2026-06-04.md](./OPERATIONS_SLO_RUNBOOK_2026-06-04.md).
