# Flow Finance - activation evidence, technical gate closed; not habit proof

Data: 2026-06-05
Status: technical activation/retention gate closed with real backend-published evidence. This does not prove broad commercial retention or durable habit. The runner stays available for refresh and recheck.

## Purpose

This document records the backend-authenticated evidence that closed the public-launch technical activation/retention gate described in [GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md](./GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md). It does not prove broad commercial retention or durable habit.

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

Atualizacao operacional em 2026-06-11:

- o export runner agora tambem tenta login automatico publicado por `POST /api/auth/login`
- a tentativa automatica depende de:
  - `ACTIVATION_RETENTION_EXPORT_BACKEND_URL`
  - `ACTIVATION_RETENTION_EXPORT_EMAIL`
  - `ACTIVATION_RETENTION_EXPORT_PASSWORD`
- se o login funcionar, o runner tenta descobrir `workspaceId` via `GET /api/workspace`
- isso reduz a dependencia manual de `cookie`, `bearer` e `workspaceId` para novas rodadas de refresh
- sem backend autenticavel e credenciais validas, o export continua `BLOCK`

Run it with:

```bash
node scripts/export-activation-retention-events.mjs --backend-url <backend-url> --workspace-id <workspace-id>
```

Ou, para bootstrap autenticado automatico:

```bash
node scripts/export-activation-retention-events.mjs --backend-url <backend-url> --email <email> --password <password>
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

Preflight operacional antes do export:

```bash
npm run health:activation-retention:ready
```

Esse comando deve acusar `AUTO_LOGIN`, `DIRECT_AUTH` ou `NOT READY` sem tocar na rede.

Refresh publicado consolidado:

```bash
npm run health:activation-retention:refresh
```

Esse runner encadeia:

1. preflight de contexto publicado
2. export autenticado quando possivel
3. checker por janela de coorte quando o export existir

Se o shell nao estiver pronto, ele continua `BLOCK` e salva artefato unico em `test-results/activation-retention-refresh/`.

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

## Refresh status on 2026-06-11

A new refresh was attempted from the current shell with:

```bash
npm run health:activation-retention
```

Result:

- artifact: `test-results/activation-retention-evidence/2026-06-11T03-22-16-244Z-no-input/report.json`
- report: `test-results/activation-retention-evidence/2026-06-11T03-22-16-244Z-no-input/report.md`
- outcome: `BLOCK: SEM EVIDENCIA SUFICIENTE`

Reason:

- no input export path
- no cohort window
- no authenticated published workspace context available in this shell to generate a fresh backend export

Reading:

- this does not reopen the historical gate, which remains closed by the published evidence from 2026-06-05
- it does confirm that broader recurrence proof still depends on a fresh authenticated export, not on local inference

Nova leitura operacional em 2026-06-11:

- `npm run health:activation-retention:ready` confirmou `NOT READY` no shell atual
- `npm run health:activation-retention:export` gerou `test-results/activation-retention-export/2026-06-11T16-46-31-949Z/report.json`
- `npm run health:activation-retention:refresh` gerou `test-results/activation-retention-refresh/2026-06-11T16-53-01-310Z/report.json`
- o bloqueio atual ficou mais estreito e mais claro: faltam backend publicado autenticavel e credenciais validas, nao logica adicional de export

## Refresh status on 2026-06-12

A new refresh was attempted from the current shell with a published Firebase login context and the live backend alias:

```bash
npm run health:activation-retention:refresh
```

Result:

- artifact: `test-results/activation-retention-refresh/2026-06-12T15-31-45-372Z/report.json`
- report: `test-results/activation-retention-refresh/2026-06-12T15-31-45-372Z/report.md`
- outcome: `BLOCK`

Reason:

- `A1 PASS`: prereq preflight is ready via `AUTO_LOGIN`
- `A2 BLOCK`: published export still could not anchor a real cohort
- `A3 BLOCK`: no real workspace/user cohort could be anchored on activation

Reading:

- the shell and backend context are now enough to execute the refresh runner
- the remaining blocker is factual cohort evidence, not bootstrap or route availability

## Dashboard ritual path implemented on 2026-06-12

The product surface now exposes a visible weekly review action in the dashboard:

- `components/Dashboard.tsx` adds `Registrar revisao semanal`
- the action records `weekly_cash_review_completed` through `src/finance/weeklyCashReview.ts`
- the behavior is covered by `tests/unit/dashboard-quick-actions.test.tsx`
- build and type-check passed locally with `npm run build` and `npx tsc -p tsconfig.app.json --noEmit --pretty false`

Reading:

- this removes the missing UI path that made retention feel like a domain helper instead of a product ritual
- it still does not prove a real published cohort by itself

## Published xi runtime revalidation on 2026-06-12

The updated ritual path was published and revalidated on the alternate production alias:

- deployment target: `https://flow-finance-xi.vercel.app`
- deployment ids observed during this round:
  - `dpl_nzutbDCoH5gR8MyiMSLj4QPoR5bX` (ritual surface publish)
  - `dpl_2KrBZywoUx37yd4T989D3cbUNBSx` (runtime mitigation publish)

Published runtime evidence from this round:

- a fresh tab on `flow-finance-xi.vercel.app` no longer entered the previous `sync/pull` 429 storm
- the published dashboard exposed `Registrar revisao semanal`
- the live session kept `active_workspace_id = Dybo9Ov2DuXiYy3JQbRR`
- the ritual stored local history again and rendered the success state in the published UI
- a direct browser fetch to `GET /api/finance/events` with `x-workspace-id` returned `200` instead of the earlier runaway `429` pattern

Residual blocker from the same published session:

- `GET /api/finance/events` returned `{ "events": [] }` before a fresh retransmit, so no backend retention row was yet provable from that session
- after clearing the local dedupe key and clicking `Registrar revisao semanal` again, the browser console recorded `POST https://flow-finance-backend.vercel.app/api/finance/events => 429`
- because that retransmit happened inside the same IP bucket already stressed by the earlier published round, the backend persistence proof remains `BLOCK` for this window

Reading:

- the runtime/product gap is now narrower: the ritual is published and the sync storm was materially reduced
- the remaining blocker is not missing UI anymore
- the remaining blocker is a fresh backend-persisted `weekly_cash_review_completed` row under a clean published rate-limit window

## Published xi rerun on 2026-06-12 after activation patch

The next published xi round fixed the first-transaction failure and reopened the real remaining blocker with narrower evidence:

- deployment id: `dpl_12mx8gQjJGYqZimSBhMrbHP2e3o8`
- alias: `https://flow-finance-xi.vercel.app`
- code fix: `src/services/firestoreWorkspaceEntityWriteStore.ts` now strips `undefined` fields before `setDoc` / `batch.set`
- regression coverage: `tests/unit/firestore-workspace-store.test.ts`

Published runtime evidence from the repaired xi session on workspace `RbL6hMO4Smd9N0dg5ReA`:

- a manual transaction in the published UI stopped throwing `Unsupported field value: undefined (payment_method ...)`
- the dashboard state updated to show the new expense in the weekly cash surface
- a direct browser-authenticated fetch to `GET /api/finance/events?limit=20` returned `activation_first_transaction` at `2026-06-12T20:12:42.183Z`
- after clearing only the local dedupe key for `weekly_cash_review_completed` and clicking the weekly review again, a direct browser-authenticated fetch returned a fresh `weekly_cash_review_completed` at `2026-06-12T20:14:38.286Z`

New blocker discovered in the same published round:

- the official export runner using published auto-login did not see the same event history as the live browser session for the same `workspaceId`
- one browser-authenticated fetch returned both activation and the fresh weekly review, while later runner/browser-auth export attempts for the same workspace returned only a partial subset
- the backend code path explains why this is plausible: `backend/src/services/finance/eventStore.ts` falls back to a local file store unless the Postgres state store is enabled
- on a serverless published runtime, that fallback is not durable across instances, so `/api/finance/events` can present inconsistent history between requests

Reading:

- the activation surface bug is fixed and published
- the remaining `R1` blocker is no longer frontend or rate-limit noise
- the remaining `R1` blocker is production event-store durability / consistency for `/api/finance/events`
- honest state: `SEM EVIDENCIA SUFICIENTE` to close `R1` through the official runner until the published backend reads from a durable shared store

## Published backend hardening and refresh PASS on 2026-06-12

The production backend path for finance events was hardened and the official recurrence runner closed again on a fresh published cohort.

Code and runtime changes:

- `backend/src/services/finance/eventStore.ts` now mirrors the repository durability pattern: Postgres first, Firestore as the shared fallback, and explicit rejection when production would fall back to a non-durable store
- `backend/src/services/finance/eventStoreFirestore.ts` introduced the shared Firestore-backed domain-event path
- `backend/src/routes/finance.ts` now fails closed with `503` when durable domain-event persistence is required but unavailable
- `backend/src/index.ts` and `backend/src/bootstrap/runtimeInitialization.ts` now expose and initialize `domainEventPersistence`
- focused regression coverage was added in:
  - `backend/tests/unit/domain-event-store-persistence.test.ts`
  - `backend/tests/unit/domain-event-persistence-health.test.ts`
  - `backend/tests/unit/finance-route-durable-persistence.test.ts`
  - `backend/tests/unit/finance-route-domain-event-hardening.test.ts`

Published backend evidence:

- backend deploys:
  - `dpl_3ifZRqnikVUXPP9Caatp5SfdkXaE` first moved `domainEventPersistence` to `firebase / durable / required / healthy`
  - `dpl_46ZmG79ppY9Vk3pDcBWKNUR3KN3g` removed the Firestore index dependency from `GET /api/finance/events`
- published health on `https://flow-finance-backend.vercel.app` now returns:
  - `/api/health -> domainEventPersistence = firebase / durable / required / healthy`
  - `/health -> checks.domainEventPersistence = healthy`

Fresh published cohort evidence:

- frontend alias used: `https://flow-finance-xi.vercel.app`
- a fresh published account completed:
  - signup/login
  - first activation entry through the dashboard activation form
  - weekly review through `Registrar revisao semanal`
- published workspace used for the durable cohort: `ZcNI85emhBPTU02EeFPA`

Runner artifacts:

- export PASS:
  - `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json`
  - `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/events.jsonl`
- checker PASS:
  - `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.json`
  - `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.md`
- consolidated refresh PASS:
  - `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
  - `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.md`
- verified handoff promoted:
  - `test-results/activation-retention-export/published-export-verified.json`

Reading:

- the published inconsistency bug in `/api/finance/events` is closed for the official runner path
- `R1` is closed for the current audit gate because export, checker, and refresh all passed again on a fresh durable cohort
- the honest residual note is historical, not blocking: event rows written before the backend hardening were not backfilled from the old serverless local-file fallback and should not be reused as authoritative proof

## Handoff to habit proof on 2026-06-13

The technical activation/retention gate stays closed; it does not prove broad commercial retention or durable habit.

The residual question moved to repeated usage over time, not route health.

New path:

- doc: `docs/HABIT_PROOF_PROGRAM_2026-06-13.md`
- runner: `npm run health:habit-proof`
- first artifact: `test-results/habit-proof-evidence/2026-06-13T14-57-20-595Z/report.json`

Reading:

- the first longitudinal artifact stays `BLOCK`
- that `BLOCK` is honest and expected because only one canonical weekly snapshot exists and no explicit business threshold was declared yet
- do not reopen the activation/retention gate because of this; the new runner is for product habit proof, not for reclassifying the technical closure
