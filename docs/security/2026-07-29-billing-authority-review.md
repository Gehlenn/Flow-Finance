# Billing authority security review — 2026-07-29

Scope: workspace commercial-plan changes, subscription persistence, and the legacy billing endpoint. This review does not treat green tests as payment-provider reconciliation evidence.

## SEC-BILL-001 — Direct client mutation of commercial billing state

- Severity: Critical (corrected)
- Location: `pages/WorkspaceAdmin.tsx` and `src/services/firestoreBillingStateStore.ts`; `firestore.rules` workspace update and `billing_state` rules.
- Evidence: the administrative UI previously persisted plan changes directly to Firestore, while the server path already limited manual workspace plan changes to mock/test environments. The rules authorized a workspace manager to update the workspace document and `billing_state` without a field-level invariant for plan, entitlement, customer, or subscription fields.
- Impact: a signed-in manager could bypass Stripe checkout/webhook authority and grant paid entitlements or alter commercial state.
- Fix: the administrative UI now requests the API plan-change flow, direct client plan and billing-state writers were removed, `billing_state` is server-only, and Firestore rules fail closed for workspace authority fields (`plan`, entitlements, customer, and subscription). New workspaces and tenants are constrained to the free plan; later commercial changes must come from the backend/Stripe-authoritative path.
- Mitigation: the API also rejects the legacy manual subscription route outside mock/test (SEC-BILL-002), and the billing-state reader falls back to the authoritative workspace document rather than local client state.
- False-positive / verification: corrected. Firestore emulator/static tests must prove that a manager cannot modify protected billing fields, and API tests must prove the UI-compatible plan route remains denied outside mock/test. Confirm Stripe checkout plus a signed webhook remains the only production plan-changing flow.

## SEC-BILL-002 — Legacy subscription route could alter plans in production

- Severity: High (corrected)
- Location: `backend/src/billing/billingService.ts`, `backend/src/routes/billingRoutes.ts`, `backend/src/docs/openapiFragments.ts`.
- Evidence: `POST /api/billing/subscription` accepted an authorized `billing:manage` caller and wrote an internal subscription directly. Unlike `POST /api/saas/plan`, it did not enforce the mock/test gate.
- Impact: an authenticated billing manager could create or change a workspace subscription outside the Stripe-authoritative flow.
- Fix: `BillingService.createSubscription` now uses the shared `isMockBillingEnabled()` predicate. It is enabled by `NODE_ENV=test`, or by `ALLOW_MOCK_BILLING_UPDATES=true` only outside production; production always returns HTTP 403. The endpoint is retained as a documented mock/test compatibility route because no traffic-retention evidence was available.
- Mitigation: its OpenAPI contract advertises mock/test-only behavior and the 403 response; integration coverage proves both test success and production-mode denial.
- False-positive / verification: corrected. Run `backend/tests/integration/billing.integration.test.ts`; its production case keeps the override set and still requires HTTP 403.

## SEC-BILL-003 — Usage and membership authority needs a separate policy decision

- Severity: Medium (deferred)
- Location: `firestore.rules` `saas_usage` and workspace membership paths; `backend/src/routes/saas.ts` usage routes.
- Evidence: client-capable Firestore rules and server usage routes coexist. The current review did not establish which usage counters are client-authored telemetry versus server-metered billing inputs, nor an authoritative membership migration path.
- Impact: prematurely denying all client writes could break valid operational data; leaving billable usage ambiguous can distort quotas.
- Fix: inventory each usage writer and classify it as client telemetry, server-metered quota input, or derived display data. Then restrict billable counters to trusted backend writes and add emulator tests.
- Mitigation: do not use client-writable usage directly for invoice or entitlement decisions until that inventory is complete.
- False-positive / verification: status is intentionally deferred, not a finding of exploitation. Verify through runtime writer inventory, Firestore emulator tests, and Stripe reconciliation requirements.

## SEC-BILL-004 — Physical removal of the legacy endpoint lacks traffic evidence

- Severity: Low (deferred)
- Location: `backend/src/routes/billingRoutes.ts`, `backend/src/billing/*`, API documentation and integration tests.
- Evidence: static repository references exist in tests and administrative workflows, but no production traffic, client-version, or operational-consumer evidence was available in this review.
- Impact: deleting the route without observability could break older clients or internal tooling; retaining it without a gate would be unsafe.
- Fix: retain the gated route temporarily, emit/inspect route telemetry, announce a removal date, then remove endpoint, docs, and test fixtures once there are no active consumers.
- Mitigation: SEC-BILL-002 makes the retained route unavailable for production plan changes.
- False-positive / verification: deferred by evidence gap. Verify with production request telemetry over an agreed deprecation window before removal.

## SEC-BILL-005 — Mock billing hooks could persist false events before denial

- Severity: High (corrected)
- Location: `backend/src/services/saas/billingService.ts` and `backend/src/routes/saas.ts`.
- Evidence: the workspace hook path previously appended client-supplied billing events before the plan-change function checked whether mock billing was enabled. A production `plan_changed` request could therefore return 403 after leaving a false event in the billing ledger; non-plan events could return 200.
- Impact: an authenticated billing manager could not grant entitlements, but could corrupt billing evidence and operational diagnostics.
- Fix: all user and workspace mock hook paths now enforce the environment gate before any append. The gate also ignores `ALLOW_MOCK_BILLING_UPDATES=true` when `NODE_ENV=production`.
- Mitigation: production billing changes continue through signed Stripe webhooks, whose provider synchronization path is separate from the mock hook API.
- False-positive / verification: corrected. Unit coverage asserts that a rejected production hook leaves the workspace hook count at zero.

## SEC-BILL-006 — Workspace creation is not bound to tenant membership

- Severity: Medium (pre-existing, deferred)
- Location: `firestore.rules` workspace create rule and `src/services/firestoreWorkspaceBootstrapStore.ts`.
- Evidence: any signed-in client can create a free workspace document carrying an arbitrary `tenantId`; the rule does not prove tenant ownership or membership. The legitimate personal-workspace bootstrap uses a multi-document batch, so a safe fix needs a matching `getAfter()` contract across tenant, workspace, and membership documents.
- Impact: this does not grant billing entitlements under the new free-only create rule, but it permits cross-tenant document pollution and weakens isolation evidence.
- Fix: design an atomic bootstrap rule that binds the new workspace to a tenant owned by the caller and validates the corresponding membership documents with `getAfter()`.
- Mitigation: client-created workspaces are constrained to `plan=free` and cannot include billing-authoritative fields.
- False-positive / verification: not introduced by this change. Cover owner bootstrap success, arbitrary-tenant denial, and batch rollback in a dedicated isolation cycle.
