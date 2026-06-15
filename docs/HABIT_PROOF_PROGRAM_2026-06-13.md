# Flow Finance - habit proof program

Data: 2026-06-13
Status: active residual program after the technical closure of `R1` and `R2`.

## Purpose

This document exists to keep the residual audit honest.

`R1` is closed as a technical/published gate. That does not prove durable habit.

From this point forward, the product can still fail because real service businesses do not come back every week, even if the runtime, billing, auth, and event persistence paths are healthy.

## Evidence boundary

Implemented:

- visible weekly ritual in `components/Dashboard.tsx` with `Registrar revisao semanal`
- qualified activation event `activation_financial_base_completed` when the workspace has initial balance, inflow, outflow, and receivable signals
- product event `weekly_cash_review_completed`
- durable published event path backed by the hardened finance event store
- published export/checker/refresh evidence closed on `2026-06-12`
- new longitudinal runner: `npm run health:habit-proof`

## Declared thresholds

Current business threshold for a minimal habit claim:

- minimum distinct review weeks: `2`
- minimum observation days after activation: `7`
- minimum cohorts: `1`

Why this threshold:

- `2` review weeks is the smallest honest signal that the ritual repeated beyond the activation week
- `7` days keeps the observation window aligned with a weekly habit, not a same-day replay
- `1` cohort is enough for a first product read, but not for scale claims

Documented:

- technical closure of `R1` in `docs/POST_AUDIT_EXECUTION_PLAN_2026-06-11.md`
- published closure and health contract in `docs/DEPLOYMENT_STATUS.md`
- operational run path in `docs/OPERATIONS_README.md` and `docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md`

Planned:

- repeated canonical exports across multiple weeks
- explicit business thresholds for what counts as habit proof
- periodic review of the same real workspace/user cohorts over time

SEM EVIDENCIA SUFICIENTE:

- no multi-week recurring usage proof is closed yet in this repository state
- no retention rate, recurring cohort count, or habit threshold should be claimed until the operator declares them explicitly and the runner proves them

## New runner

Use:

```bash
npm run health:habit-proof
```

Optional explicit thresholds:

```bash
npm run health:habit-proof -- --min-distinct-review-weeks 2 --min-observation-days 7 --min-cohorts 1
```

What it does:

- scans `test-results/activation-retention-export/`
- ignores pre-hardening exports before `2026-06-12T20:44:49.665Z`
- only considers canonical `PASS` export bundles
- groups real rows by `workspace_id + user_id`
- requires qualified activation through `activation_first_dashboard_useful` or `activation_financial_base_completed`
- counts distinct review weeks after qualified activation
- reports observation span in days
- stays `BLOCK` until explicit thresholds are supplied and satisfied

What it does not do:

- invent a retention rate
- invent a target number of cohorts
- treat pre-hardening local-file event histories as canonical
- convert a one-day PASS into habit proof

## Initial residual reading on 2026-06-13

The initial longitudinal runner is expected to stay `BLOCK` unless the operator supplies explicit thresholds and enough weekly snapshots exist.

That is the correct behavior.

The current repository has a fresh durable cohort proof for `2026-06-12`, but one canonical published snapshot is still not the same thing as repeated habit over time.

Latest explicit-threshold run:

- `test-results/habit-proof-evidence/2026-06-15T12-59-02-724Z/report.json`
- `test-results/habit-proof-evidence/2026-06-15T12-59-02-724Z/report.md`

Reading:

- `BLOCK`
- only `0` cohort(s) satisfied the declared thresholds
- one cohort has qualified activation via `activation_first_dashboard_useful`
- no cohort reached `2` distinct review weeks after qualified activation
- no cohort reached `7` observation days after qualified activation
- that is the correct state until another real weekly export arrives

## Weekly operating checklist

1. Keep published auth context valid for the export path.
2. Run `npm run health:activation-retention:refresh` after a real published weekly review cycle.
3. Preserve the generated export bundle in `test-results/activation-retention-export/`.
4. Run `npm run health:habit-proof` with explicit thresholds only when business criteria have been declared.
5. If the result stays `BLOCK`, keep the exact blocker text and do not convert it into a product success claim.
6. Update `docs/POST_AUDIT_EXECUTION_PLAN_2026-06-11.md`, `docs/DEPLOYMENT_STATUS.md`, and the vault only when new real weekly evidence exists.

## Current recommendation

Do not reopen `R1` as a technical blocker.

Treat habit proof as a product evidence program with dated exports, explicit thresholds, and repeated weekly observations.
