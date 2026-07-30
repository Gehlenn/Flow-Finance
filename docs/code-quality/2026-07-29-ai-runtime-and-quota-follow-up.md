# AI runtime and quota follow-up

Date: 2026-07-29

## Scope

This follow-up rechecked backend AI reachability, provider resilience, quota
error handling, and compatibility exports after the initial eight-track code
quality cleanup.

The review used runtime import tracing, route-order inspection, full-text
consumer searches, Knip, Madge, focused tests, and an independent adversarial
review. Tests were not treated as proof that a module participates in the
production runtime.

## Critical assessment

### A second AI stack was isolated from production

The live request path is:

`routes/ai.ts` -> `quotaMiddleware` -> `aiController.ts` -> `config/ai.ts` ->
`config/openai.ts` or `config/gemini.ts`.

The separate factory/orchestrator/provider stack under `backend/src/services/ai`
had no importer from that path, bootstrap, scripts, or another production
entrypoint. Its barrel was an orphan in the backend graph. Five unit-test files
kept the island reachable to Knip because backend tests are configured as
entrypoints, but those tests only exercised the unused implementation.

### Active AI resilience still needs a behavior decision

The active provider path has no effective backend cancellation deadline, while
the frontend aborts its request after 30 seconds. Some controllers also convert
provider failures into HTTP 200 fallback payloads. Changing those contracts
affects retries, provider cost, UX, and the meaning of an `aiQueries` quota
reservation, so this pass did not silently redefine them.

### Legacy quota persistence can hide confirmed write failures

`enforceLegacyQuota` catches persistence exceptions and continues to the
controller. In addition, the normalized Postgres writer can return without a
durable write when the store is disabled or unavailable. However, the
repository explicitly records the Postgres cutover as deferred and still
retains legacy state blobs for that transition.

Failing closed on every unavailable normalized write would therefore risk
blocking the current production path before its storage cutover is complete.
The exception-swallowing behavior remains a high-priority follow-up, but it
must be changed together with an explicit durability contract and deployment
readiness evidence.

## Implemented high-confidence changes

Removed the unused backend AI island:

- `AIServiceFactory.ts`
- `AIOrchestrator.ts`
- `IAIProvider.ts`
- `OpenAIProvider.ts`
- `GeminiProvider.ts`
- `index.ts`
- `types.ts`

Removed the five unit-test files dedicated exclusively to that island.

Preserved the active modules:

- `aiCostMonitor.ts`
- `AISecurityGuard.ts`
- `PromptInjectionGuard.ts`

The only live declaration from the removed type bundle, `AIProvider`, now
belongs to `aiCostMonitor.ts`.

Also removed:

- internal compatibility aliases `UsageAuthorityUnavailableError` and
  `UsageIdempotencyConflictError`, which had no consumer or published package
  boundary;
- the `FF_AI_FALLBACK` comment entry, which had no environment reader,
  implementation, or test.

The full backend suite also exposed one stale observability test that expected
production workspace mutations to use Postgres when Firestore was unavailable.
The documented security contract makes transactional Firestore the production
workspace authority and fails closed when it is unavailable. The test now
asserts that existing contract instead of expecting the deprecated behavior;
production code was not weakened.

## Deferred recommendations

1. Define whether `aiQueries` measures admission, provider attempt, or useful
   completion before changing retry, refund, replay, or provider-failover
   behavior.
2. Add a real backend provider timeout with cancellation and a budget below the
   client timeout.
3. Replace indistinguishable HTTP 200 provider-failure fallbacks with an
   explicit, documented error contract after the UX and retry policy is chosen.
4. Make confirmed legacy quota write failures fail closed with a stable 503
   contract, request-correlated logging, and route-level tests.
5. Make the persistence layer report whether a write was durable, then enable
   strict production enforcement only with verified Postgres or Firestore
   authority readiness.
6. Remove the unused user-scope quota branch only with a schema and historical
   data migration decision; current routes already establish workspace context
   before applying quota.

## Validation

- backend TypeScript: PASS
- active AI/quota/backend regression selection: 11 files, 90 tests PASS
- complete backend unit suite: 101 files, 498 tests PASS
- Knip backend: no issues
- Madge backend: zero circular dependencies
- exact consumer search for removed modules and aliases: no remaining references
- `git diff --check`: PASS
