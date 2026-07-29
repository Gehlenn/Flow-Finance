# Firestore AI usage authority review

Date: 2026-07-29
Status: implementation ready to merge with cutover disabled; production activation blocked

## Scope

This phase prepares an atomic, workspace-scoped authority for `aiQueries`. It does not move `bankConnections` or `transactions` to Firestore.

The initial implementation attempted to move every quota resource at once. Review found that this was unsafe:

- repeated idempotency keys deduplicated the counter but still executed the provider operation;
- failed bank connection attempts could consume a shared workspace slot;
- existing current-month usage had no verified backfill path;
- `/api/saas/metering` still reads the legacy/Postgres event model.

## Implemented controls

- Firestore transaction reads workspace entitlements, usage, and the idempotency receipt before writing.
- Concurrent reservations cannot write past the workspace limit.
- Receipts make an accepted or rejected reservation stable for a key.
- An accepted replay returns `409` before the controller, preventing repeated provider execution without another quota unit.
- A rejected replay returns the original `429` decision without duplicating the audit event.
- Production and Vercel require an explicit `Idempotency-Key` when the authority is enabled.
- Firestore initialization or transaction failure becomes a clear `503`; development and tests retain an explicit legacy fallback.
- Schema and AI input security execute before quota reservation.
- Browser clients cannot write usage documents or read/write internal receipts and events.
- The browser request wrapper reuses one generated key across network retries and workspace recovery.
- CORS explicitly allows `Idempotency-Key`.

## Staged cutover

`FIRESTORE_AI_USAGE_AUTHORITY_ENABLED` defaults to `false`.

When disabled:

- all quota behavior remains on the existing path;
- `/api/saas/usage` returns the existing usage map;
- banking behavior is unchanged apart from validating the request body before quota.

When enabled:

- only `aiQueries` uses the Firestore authority;
- `transactions` and `bankConnections` remain legacy;
- `/api/saas/usage` preserves legacy history and legacy non-AI counters while replacing the current UTC month's `aiQueries` value with the authoritative value;
- an unavailable authority fails closed.

## Activation blockers

Do not enable the flag in production until all of the following are complete:

1. Backfill every workspace's current UTC-month `aiQueries` count into `workspaces/{workspaceId}/saas_usage/{YYYY-MM}`.
2. Execute the prepared Firestore Emulator concurrency tests and confirm:
   - exactly one request wins the final available slot;
   - concurrent retries with the same key produce one increment, receipt, and event.
3. Add behavioral Firestore Rules tests proving clients cannot access `receipts` or `events`.
4. Decide whether `/api/saas/metering` will read Firestore AI events or receive them through a transactional outbox.
5. Confirm the production service identity has only the Firestore permissions required for workspace, usage, receipt, and event operations.

## Deferred architecture

`bankConnections` requires its own authority phase. A correct design needs:

- atomic append/CAS in every connection-store driver;
- `pending`, `committed`, and `released` reservation states;
- reconciliation after ambiguous Pluggy timeouts;
- command-level idempotency with a stored result;
- concurrency tests covering external creation plus local persistence.

Charging after provider success alone is not safe because concurrent requests can create more external connections than the plan allows. A best-effort decrement after failure is also insufficient because a process can fail between provider creation and compensation.

AI event cost metadata is also deferred. Current authority events record reservation facts, not provider/model token cost, so they must not be presented as complete billing evidence.

## Verification

Validated locally:

- authority unit tests, including accepted replay, rejected replay, conflict, UTC boundary, limit enforcement, and operational failure mapping;
- middleware tests for legacy fallback, enabled authority, production/Vercel fail-closed behavior, replay blocking, headers, and invalid keys;
- route-order tests;
- SaaS integration tests for legacy reads, mixed authoritative reads, and unavailable authority;
- client retry/idempotency tests;
- Firestore Rules static tests;
- application and backend TypeScript checks;
- OpenAPI and CORS tests.

Not validated:

- the real Firestore Emulator concurrency gate. Execution was blocked by the platform usage limit, so no substitute result is claimed.
