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
- The metering route replaces only current-month AI totals and accepted AI events when the
  authority is enabled; historical and non-AI usage remain on the legacy source.
- Authoritative event reads are filtered, ordered, and limited in Firestore. Rejected quota
  attempts are not loaded as consumption.
- Metering rejects invalid date ranges, fails closed in production, and identifies AI cost
  coverage as partial or unavailable instead of inventing provider-cost evidence.

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
- `/api/saas/metering` preserves legacy history and non-AI events while replacing current-month AI events with accepted Firestore authority events;
- an unavailable authority fails closed.

## Activation blockers

Do not enable the flag in production until all of the following are complete:

1. Deploy the required `events(outcome, createdAt)` composite index from
   `firestore.indexes.json` and record proof that it is ready in the production project.
2. Establish the mandatory quiescence window and execute the production current-month
   backfill according to `2026-07-29-firestore-ai-usage-backfill-runbook.md`. Record the
   dry-run, apply, and final dry-run aggregate outputs.
3. Confirm the actual production runtime principal and IAM bindings match
   `2026-07-29-firestore-usage-authority-production-permissions.md`, without a broader
   conflicting role.
4. Make an explicit product decision about what consumes quota. The current implementation
   reserves before controller/provider execution, so an admitted request can consume quota
   even if the provider later fails. Changing this safely requires a reservation lifecycle or
   compensation/reconciliation design, not a catch/fallback.

Completed engineering prerequisites:

- Firestore Emulator concurrency and same-key retry tests passed.
- Behavioral Rules tests deny client get/list/create/update/delete access to `receipts` and
  `events` for unauthenticated, viewer, member, admin, and owner contexts.
- The current-month Firestore metering reader, legacy merge, bounded event query, cost
  coverage contract, and production fail-closed behavior are implemented and tested.
- The dry-run-first, idempotent backfill tooling and operational runbook are implemented.
- The minimum runtime IAM permission specification is documented. Actual production
  principal/binding evidence remains an operational blocker above.

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
- Firestore Emulator concurrency and retry tests.
- behavioral Firestore Rules tests for internal authority subcollections;
- backfill source-integrity, conflict, synthetic-event, dry-run, and idempotency tests;
- metering event merge, date range, bounded query, cost coverage, and production 503 tests;
- root/backend TypeScript, application/backend builds, Knip, Madge, secret scan, and the
  repository unit-test suite.

Not validated by this repository:

- the production Firestore composite-index deployment state;
- the production backfill execution and quiescence evidence;
- the deployed runtime service identity and its effective IAM policy;
- the product decision for whether quota represents admission, provider attempt, or useful
  response.
