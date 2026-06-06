# Flow Finance - go-live checklist for external gates

Data: 2026-06-04  
Status: activation/retention closed with real backend-published evidence on 2026-06-05. The Stripe gate and the performance gate are already closed with real target-environment evidence. The published frontend still has a separate post-signup shell loading issue; that bug does not reopen the activation/retention gate.

## What this document is for

Use this checklist to decide whether Flow Finance can move from internal readiness to public launch.

The activation/retention gate is closed with direct evidence from a real backend-authenticated usage cohort. The Stripe gate and the performance gate below are already evidenced and no longer block launch. The remaining published frontend shell-loading issue is separate from gate closure.

As of 2026-06-05, the Stripe gate is closed with real published evidence. The path to closure was: Firebase signup + backend session exchange published, CORS/tracing fix, fail-closed workspace persistence hardening, Firestore-backed durable workspace persistence published, then a second billing fix in Stripe metadata/persistence so the real checkout flow could reconcile the workspace back from Stripe events. The published backend now proves `/health`, `/api/health`, and `/api/version` with `workspacePersistence.mode=firebase`, and the real Stripe flow proved checkout, webhook-driven plan sync, and portal-open behavior for a real published workspace.

## External gates

| Gate | What must exist | Minimum evidence | Status |
| --- | --- | --- | --- |
| Stripe real smoke | Real checkout, webhook, plan change, and portal flow with live or target launch credentials | checkout session URL, successful payment or equivalent live smoke step, webhook receipt, workspace plan change, portal open, and rollback or revert proof if applicable | CLOSED / EVIDENCED |
| Activation and retention cohorts | Real cohort evidence for activation and retention, not demo or seeded data | defined activation event, cohort window, real workspace/user data, retention measurement, and dated output artifact or report | CLOSED / EVIDENCED |
| Performance in target environment | Baseline repeated in the target environment, not only locally | Playwright baseline JSON or equivalent artifact from target env, timestamp, target URL, and comparison against local baseline | CLOSED / EVIDENCED |

## Performance evidence

- runner: `npm run health:target-performance -- --target-url https://flow-finance-frontend-nine.vercel.app`
- result: `PASS`
- timestamp: `2026-06-04T22:01:40.962Z`
- target artifact: `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.json`
- human report: `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.md`
- comparison against local baseline: `test-results/performance-baseline/chromium-dashboard.json`
- captured metrics: `navigationDurationMs 1656ms`, `domContentLoadedMs 1656ms`, `loadEventMs 1656ms`, `resourceCount 61`

## Activation and retention evidence

- runner: `npm run health:activation-retention -- --input <path-to-export> --cohort-window-days <days>`
- result: `PASS`
- timestamp: `2026-06-05T20:20:36.828Z`
- export artifact: `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`
- export rows: `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/events.jsonl`
- checker report: `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json`
- human report: `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.md`
- verified handoff: `test-results/activation-retention-export/published-export-verified.json`
- cohort window: `7` days
- activation cohorts: `1`
- retained cohorts within window: `1`
- gate reading: `CLOSED / EVIDENCED`

## Stripe gate status on 2026-06-05

- published frontend signup reached the authenticated shell
- browser bootstrap to backend initially failed in production preflight because `sentry-trace` was not allowed by backend CORS
- direct server-side `POST /api/auth/firebase` with the captured Firebase session succeeded with `200` and auth cookies
- direct `GET /api/workspace` initially succeeded with `200` and empty list for the fresh user
- direct `POST /api/workspace` initially failed with `500`, blocking `x-workspace-id` resolution for checkout
- local fixes were added and deployed in:
  - `backend/src/config/cors.ts`
  - `backend/src/services/admin/workspaceStore.ts`
  - `backend/src/services/admin/workspaceStoreHelpers.ts`
  - `backend/tests/unit/cors-preflight.test.ts`
  - `backend/tests/unit/workspace-store-observability.test.ts`
- post-deploy validation on the official backend:
  - `/health` => `200`
  - `/api/health` => `200`
  - `/api/version` => `200`
  - `POST /api/workspace` => `201`
  - `POST /api/saas/stripe/checkout-session` => `200` with Stripe-hosted checkout URL
  - runner artifact: `test-results/stripe-live-smoke/2026-06-05T02-27-29-531Z.json`
- Stripe account/runtime findings after the next production rerun:
  - real Stripe checkout completed with `payment_status=paid` and `subscription.status=active`
  - old Stripe webhook endpoint was misconfigured to `/api/stripe/webhook`
  - new Stripe webhook endpoint `we_1Teo25RpdpJteINQp5DWbO81` was created for `https://flow-finance-backend.vercel.app/api/saas/stripe/webhook`
  - backend production webhook secret was rotated to match the new endpoint
  - replay of the real Stripe events `checkout.session.completed` and `customer.subscription.created` against the official backend returned `200`
  - despite that, the published runtime still lost the workspace on later reads: `GET /api/workspace` returned `[]` after deploy and `GET /api/saas/plans` for a newly created workspace later returned `404 Workspace nao encontrado`
- local hardening added after that finding:
  - `backend/src/services/admin/workspaceStore.ts`
  - `backend/src/routes/workspace.ts`
  - `backend/src/tenant/tenantService.ts`
  - `backend/src/tenant/tenantController.ts`
  - `backend/src/index.ts`
  - `backend/src/admin/adminController.ts`
  - `backend/tests/unit/workspace-store-observability.test.ts`
  - `backend/tests/unit/workspace-route-fail-closed.test.ts`
  - `backend/tests/integration/health.integration.test.ts`
  - `backend/tests/integration/workspace-storage-isolation.integration.test.ts`
  - `backend/tests/integration/admin.integration.test.ts`
- second production fix that closed the remaining billing gap:
  - `backend/src/services/saas/stripeService.ts`
  - `backend/src/routes/saas.ts`
  - `tests/unit/stripe-service.test.ts`
  - `backend/tests/integration/saas.integration.test.ts`
- root cause isolated in production:
  - `checkout.session.completed` carried workspace metadata, but `billingCustomerId` was being persisted through the synchronous workspace path, which does not survive Firebase-backed runtime writes
  - `customer.subscription.created` then arrived without `workspaceId` on the subscription object because the checkout creation path did not send `subscription_data[metadata][workspaceId]`
- final published evidence after redeploy:
  - `npm run health:vercel` => `/health` `200`, `/api/health` `200`, `/api/version` `200`, all with `workspacePersistence.mode=firebase`, `durable=true`
  - real Stripe checkout completed in the hosted page and returned to `https://flow-finance-frontend-nine.vercel.app/?billing=return&tab=workspaceadmin&billing=success`
  - Stripe API confirmed the new session as `status=complete`, `payment_status=paid`, with real `customer` and `subscription`
  - Stripe API confirmed real events `checkout.session.completed`, `customer.subscription.created`, and `invoice.payment_succeeded` with `pending_webhooks=0`
  - published backend then returned `currentPlan=pro`, `hasBillingCustomer=true`, `stripePortalEnabled=true` for that same workspace
  - published `POST /api/saas/stripe/portal-session` returned `200` with a real Stripe portal URL
- gate reading: `CLOSED / EVIDENCED`

## What does not close the gate

- sandbox-only Stripe validation
- local smoke runs
- unit or integration tests without target-environment evidence
- synthetic or seeded activation/retention numbers
- local-only performance baselines
- the separate frontend published shell-loading issue

## Evidence runners available

- `npm run health:launch-gates`
- `npm run health:target-performance`
- `npm run health:stripe-live-smoke`
- `npm run health:activation-retention`

These runners do not close the gates on their own. They exist to generate dated artifacts, expose missing inputs, and keep the blocking reason explicit.

For activation/retention evidence collection, use `node scripts/export-activation-retention-events.mjs` to pull normalized rows from `GET /api/finance/events`. The reviewed export can be promoted through `test-results/activation-retention-export/published-export-verified.json` when `verified: true` is present; that promotion is now the closed, audited path, not an open gate.

## Close criteria

Public launch is not blocked on activation/retention anymore. The gate is closed with attached evidence and referenced in the live operations docs. The Stripe gate and the performance gate are already closed and referenced in the operations docs. The separate frontend published shell issue remains a frontend fix, not a gate reopen.

## Related docs

- [OPERATIONS_README.md](./OPERATIONS_README.md)
- [OPERATIONS_SLO_RUNBOOK_2026-06-04.md](./OPERATIONS_SLO_RUNBOOK_2026-06-04.md)
- [PERFORMANCE_BASELINE_2026-06-04.md](./PERFORMANCE_BASELINE_2026-06-04.md)
- [TARGET_PERFORMANCE_EVIDENCE_2026-06-04.md](./TARGET_PERFORMANCE_EVIDENCE_2026-06-04.md)
- [STRIPE_LIVE_SMOKE_2026-06-04.md](./STRIPE_LIVE_SMOKE_2026-06-04.md)
- [ACTIVATION_RETENTION_EVIDENCE_2026-06-04.md](./ACTIVATION_RETENTION_EVIDENCE_2026-06-04.md)
