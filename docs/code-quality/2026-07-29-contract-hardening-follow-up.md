# Contract hardening follow-up

Date: 2026-07-29

## Scope

This follow-up reviewed the remaining sync casts and the duplicated billing,
SaaS and subscription contracts after the main code-quality cleanup.

Three independent reviews covered:

- sync payload ownership and runtime validation;
- backend billing and SaaS contracts;
- the distinct meanings of financial recurrence, persisted subscriptions and
  workspace billing subscriptions.

Only behavior-preserving, high-confidence changes were implemented.

## Implemented

- Added one backend SaaS catalog for plan IDs, resources, feature keys, billing
  hook events, limits and entitlements.
- Made the backend policy engine, workspace entitlements, metering store and
  Zod request schemas consume that catalog.
- Replaced manual SaaS route request shapes with types inferred from the
  validating Zod schemas.
- Made `WorkspacePlan`, `PlanId` and `PlanName` aliases of the same backend
  plan contract.
- Made the Firestore workspace usage snapshot an alias of the existing
  frontend usage contract.
- Added one backend sync entity catalog and reused it in the schema, route,
  store helpers and OpenAPI.
- Corrected the OpenAPI sync entity enum to include `receivables`.
- Corrected `POST /api/billing/subscription` documentation to its real `201`
  response and documented its current request and response shapes.
- Removed the unreachable legacy `User`, `Subscription`, `SubscriptionPlan`
  and `UserEntity` declarations from `src/domain/entities.ts`.
- Added catalog parity and OpenAPI contract assertions.

The changes add no `any` or `as unknown as` occurrences.

## Sync validation assessment

The five casts in `src/services/sync/cloudSyncClient.ts` were not removed.
Deleting them now would make the types look stronger without validating the
stored or HTTP data.

The current backend validates only the sync envelope. Entity payloads remain
`Record<string, unknown>`, and existing tests and integrations persist partial
records that do not satisfy the frontend domain models. Examples include goals
with only `target`, transactions with `amount` and `label`, and an integration
reminder without the frontend-required `priority`.

The safe sequence is:

1. inventory persisted sync payloads by entity and missing field;
2. correct partial producers and test fixtures;
3. migrate or quarantine invalid stored records without replacing them with
   empty collections;
4. introduce entity-specific runtime schemas at HTTP, Firestore web and
   Firebase Admin boundaries;
5. replace the generic payload with an entity-to-payload type map and remove
   the casts.

## Subscription boundaries

The following contracts intentionally remain separate:

- AI-detected recurring expenses;
- user-confirmed financial subscriptions stored in a workspace;
- the Flow Finance workspace's own commercial subscription.

They have different lifecycles and states. In particular, `cancelled` in the
financial record and `canceled` in Stripe billing do not represent the same
domain object.

## Critical billing authority finding

Billing authority is not singular yet:

- the admin UI can update workspace plan state directly in Firestore;
- `/api/saas/plan` blocks manual production changes outside mock/test mode;
- Firestore rules allow a manager to update the relevant workspace and
  `billing_state` documents without field-level protection for plan data;
- `POST /api/billing/subscription` is a second backend mutation path with no
  production consumer found in the repository.

This is a security and product-contract migration, not a type-only cleanup.
The next phase must make backend/Stripe the sole billing authority, add rules
tests denying direct client mutations, and verify external traffic before
removing the alternate subscription endpoint.

## Validation

- `npm run type-check:app`: pass.
- Focused frontend and SaaS tests: 27/27 pass.
- Additional agent-run focused backend tests: 9/9 pass.
- `npm run build`: pass, 2,820 modules.
- Root Knip: no files or dependency issues.
- Madge app: zero cycles.
- Madge backend: zero cycles.
- `git diff --check`: pass.

The full backend type-check and OpenAPI suite could not run locally because a
previous interrupted backend install left `backend/node_modules` incomplete.
Backend Knip consequently reported only the declared `tsx` CLI as unavailable,
although the backend scripts and lockfile both reference it. Isolated strict
compilation of the changed backend production modules passed. A clean-checkout
CI run remains required before merge.
