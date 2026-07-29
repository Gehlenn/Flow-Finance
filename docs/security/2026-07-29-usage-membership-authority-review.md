# Usage and Membership Authority Review

Date: 2026-07-29
Scope: SaaS usage metering, workspace provisioning, and tenant/workspace membership

## Executive assessment

The current runtime has competing authorities:

- AI usage is enforced by the backend quota middleware, while the AICFO client also writes a second counter to Firestore.
- Workspace provisioning is primarily server-side, but development can fall back to a separate client-side Firestore bootstrap.
- Membership can be changed through both the backend and direct Firestore writes.
- `workspace_members` and `tenant_members` can diverge because neither the client nor the server maintains both projections atomically.

These are security and integrity defects, not only cleanup opportunities. A workspace admin can currently grant the `owner` role, direct Firestore writes can change membership identity fields, and an owner can be removed without preserving a final active owner.

## Findings

| Severity | Finding | Evidence | Decision |
| --- | --- | --- | --- |
| P0 | A workspace admin can grant `owner`, including through the API. | `backend/src/routes/workspace.ts`, `backend/shared/policyEngine.ts`, `firestore.rules` | Enforce role hierarchy server-side and deny membership writes from clients. |
| P0 | A workspace manager can rewrite identity and role fields in a membership document. | `firestore.rules` rules for `workspace_members` and `tenant_members` | Make both membership collections server-managed. |
| P1 | The final workspace owner can be removed, orphaning the workspace. | `backend/src/services/admin/workspaceStoreFirestore.ts`, `backend/src/routes/workspace.ts` | Check the target role and active owner count in the same server-side operation. |
| P1 | `workspace_members` and `tenant_members` are inconsistent, forgeable authorities. | `src/services/firestoreWorkspaceMembershipStore.ts`, `backend/src/services/admin/workspaceStoreFirestore.ts` | Keep `workspace_members` as operational authority and maintain `tenant_members` only as a server-managed tenant projection. |
| P1 | AICFO usage has two writers and two stores. | `pages/AICFO.tsx`, `backend/src/routes/ai.ts`, `backend/src/middleware/quota.ts` | Keep backend metering as the only writer and make the client read the server summary. |
| P1 | Firestore usage increment is a non-transactional read-modify-write. | `src/services/firestoreBillingUsageStore.ts` | Retire client writes and deny Firestore mutations for `saas_usage`. |
| P1 | Browser-accessible usage mutation endpoints permit arbitrary metering changes. | `backend/src/routes/saas.ts` | Retain read-only usage for product clients; remove public mutation paths. |
| P2 | Concurrent first-session bootstrap can create duplicate personal workspaces. | `src/services/workspaceSession.ts`, `backend/src/services/admin/workspaceStoreFirestore.ts` | Make the server bootstrap idempotent and remove the client Firestore fallback. |
| P2 | Client-owned workspace pointers can reference a workspace the user cannot access. | `firestore.rules`, `backend/src/services/admin/workspaceStoreFirestore.ts` | Protect server-owned pointer fields and validate membership before using them. |

## Target authority model

1. Product clients read usage from `GET /api/saas/usage`.
2. Product operations such as AI and bank connections meter usage inside authenticated backend routes.
3. Firestore `saas_usage` is legacy read-only data during deprecation and is not merged into authoritative totals.
4. The backend is the only writer for tenants, workspaces, workspace memberships, tenant membership projections, and active workspace pointers.
5. `workspace_members` is the authorization source. `tenant_members` is a derived projection with canonical document IDs.
6. Owner escalation and removal are checked in the backend service, including the invariant that every active workspace has at least one active owner.

## High-confidence implementation scope

- Replace real-user workspace listing, creation, and membership mutations with authenticated HTTP calls.
- Remove the development/localhost Firestore provisioning fallback. Demo and explicit E2E modes remain isolated.
- Make initial personal workspace creation idempotent.
- Maintain workspace and tenant membership records atomically.
- Validate roles strictly and enforce owner-only owner management.
- Deny client mutations for tenants, workspaces, workspace memberships, tenant memberships, and SaaS usage.
- Remove the AICFO Firestore usage increment and reconcile its display from the backend usage response.
- Remove public usage mutation endpoints that have no product caller.
- Add backend, frontend, and Firestore emulator regression tests for the authority boundaries.

## Deliberately deferred

The following changes need separate operational or product decisions and are not safe to bundle into this authority cutover:

- Changing quota persistence failure from fail-open to `503`.
- Replacing snapshot persistence with a transactional Postgres counter and idempotency ledger.
- Defining what the `transactions` quota measures across manual creation, imports, and synchronization.
- Physically deleting legacy Firestore usage documents before a deprecation window and production verification.
- Reworking every direct client profile or financial-data write outside the collections reviewed here.
- Implementing transactional workspace authority in the Postgres-only fallback. Production mutations now fail closed when the Firestore transactional authority is unavailable.

## Required validation

- Backend role, last-owner, idempotent bootstrap, tenant projection, and cross-workspace isolation tests.
- Frontend HTTP adapter and no-Firestore-fallback tests.
- Firestore emulator tests proving all product roles are denied direct authority writes.
- Focused AICFO tests proving one server-side metering path.
- App and backend type checks, architecture checks, full CI suite, and production build.

## Implemented resolution

- AICFO no longer writes usage. It reconciles the authoritative backend total after a successful AI response.
- Browser-accessible usage upsert, increment, and reset routes were removed.
- `saas_usage`, tenants, workspaces, workspace memberships, tenant membership projections, and audit logs reject all client mutations in Firestore Rules.
- Real-user workspace provisioning and member management now use authenticated backend routes; the localhost Firestore fallback and its client write modules were removed.
- Firestore provisioning and membership changes are transactional, maintain the tenant projection, protect owner hierarchy, preserve a final owner, and emit server-authored audit events.
- Creating an additional workspace revalidates tenant ownership inside the same transaction.
- Production workspace authority fails closed if its transactional Firestore store is unavailable; test/demo modes retain isolated in-memory behavior.
- Workspace billing-hook history now reads the server-side store instead of an unwritten Firestore subcollection.
- Demo mode no longer exposes member-management controls that require a real authenticated backend session.

Validation completed:

- app and backend type checks;
- 60 focused frontend tests;
- 13 focused backend unit/integration tests;
- 22 Firestore emulator tests;
- 235 test files through the stable CI runner;
- Knip and Madge architecture gates;
- production frontend build;
- `git diff --check`.
