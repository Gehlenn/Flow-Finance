# Code quality cleanup — final integration

Date: 2026-07-27
Scope: Flow Finance web application, backend, scripts, tests, package manifests,
and dependency graph.

## Outcome

Eight independent research and implementation tracks reviewed duplication,
shared types, reachability, circular dependencies, weak types, error handling,
legacy paths, and comment quality. Each track has its own critical assessment,
evidence, decisions, and deferred items:

1. [DRY consolidation](./2026-07-27-01-dry-consolidation.md)
2. [Shared type ownership](./2026-07-27-02-shared-types.md)
3. [Unused code and dependencies](./2026-07-27-03-unused-code.md)
4. [Circular dependencies](./2026-07-27-04-circular-dependencies.md)
5. [Weak types and dynamic boundaries](./2026-07-27-05-weak-types.md)
6. [Error handling and observability](./2026-07-27-06-error-handling.md)
7. [Legacy, compatibility, and fallbacks](./2026-07-27-07-legacy-fallbacks.md)
8. [AI slop, stubs, and comments](./2026-07-27-08-ai-slop-comments.md)

The initial cleanup removes 59 tracked files and 15 direct dependencies. The
adversarial pass then removes the final unused root `@types/supertest`
declaration and adds only the platform/tooling dependencies needed for iOS,
Knip, and Madge. Knip reports no unused files, unused dependencies, unlisted
dependencies, or unresolved imports.

## Implemented high-confidence changes

- Consolidated collection ID derivation and recurring-pattern calculations
  without merging domain rules that intentionally differ.
- Established leaf type owners for sync, profile, bank sync, AI memory, signal
  engine, import, audit, and backend persistence contracts.
- Removed parallel models, services, events, prediction UI/hooks, import
  engines, security helpers, wrappers, scripts, tests, and package dependencies
  that had no live reachability.
- Reduced the app/backend dependency graph from 18 cycles to zero. One was a
  runtime Sentry/logger cycle; the other 17 were type-ownership cycles.
- Removed both production `any` occurrences and reduced unsafe double casts
  from 18 to five. The five remaining casts are documented serialization
  boundaries pending runtime validators.
- Removed three redundant catch layers while preserving validation,
  observability, retry, security, local-first, and provider-failover behavior.
- Removed obsolete feature-flag aliases, a duplicate Open Finance route gate,
  dead receipt/import compatibility paths, phase narration, fictional provider
  scaffolding, and stale implementation-history comments.
- Repaired 1,625 exact double-encoded symbol sequences across seven production
  files, including user-visible arrows, bullets, warnings, multiplication
  signs, and ellipses.

## Final integration corrections

- Added explicit TypeScript 6 callback contracts for Firebase session
  bootstrapping and a platform-neutral timer type for the AI worker.
- Configured Knip to analyze Vite/Vitest configs statically instead of executing
  them through an incompatible dynamic loader. Runtime configs remain explicit
  entry files.
- Excluded ignored `.tmp` deployment snapshots from Vitest discovery so the
  backend command validates only the live repository.
- Updated one stale AI authorization test mock from the former string response
  to the current `AIResponseEnvelope` contract.
- Removed the final test-only import engine and `pdf-parse` after the clean Knip
  run exposed the orphaned chain.

## Adversarial hardening

- Made backend sync pull failures propagate instead of replacing loaded
  financial entities with empty collections.
- Made backend sync push failures propagate instead of fabricating successful
  writes; the sync engine now disables the failed backend driver and preserves
  current entities.
- Kept goal hydration explicitly best-effort as a separate, logged adapter
  rather than weakening the primary sync contract.
- Made the public Pluggy webhook fail closed with `503` when the provider is
  active without `PLUGGY_WEBHOOK_SECRET`; invalid secrets remain `401` and the
  disabled provider remains an inert `202`.
- Added the Pluggy signing header and `202`/`401`/`503` outcomes to OpenAPI.
- Installed local, pinned Knip 5.80.0 and Madge 8.0.0 gates and added the
  combined architecture check to the canonical build workflow.
- Added the missing Capacitor iOS dependency and split clean-checkout platform
  setup into Android and iOS commands used by their respective CI jobs.

## Final validation

| Gate | Result |
| --- | --- |
| Root dependency tree | `npm ls --depth=0` clean |
| Backend clean-install contract | lockfile dry-run PASS; the final local exact `npm ci` hit a 10-minute Windows timeout and left only ignored `node_modules` state for remote CI to replace |
| App and backend TypeScript | PASS |
| Clean-install contract | `npm ci --dry-run --ignore-scripts` PASS |
| Knip files/dependencies/unlisted/unresolved | `files: []`, `issues: []` |
| Madge app and backend | 0 circular dependencies in both graphs |
| Capacitor doctor | core/CLI/Android/iOS aligned at 8.3.0; Android PASS |
| Production build | PASS, 2,820 modules transformed |
| Critical coverage suite | 171/171 tests; 99.54% statements, 98.15% branches, 100% functions, 99.74% lines |
| Backend unit suite | 102 files, 485/485 tests |
| Sync/webhook/observability regressions | 42/42 tests |
| Stable full suite | 236 test files completed |
| Documentation encoding check | PASS |
| Documentation link check | PASS |
| Secret scan | PASS |
| Visual baseline and E2E matrix contract | PASS |
| Git whitespace check | PASS |

The backend TypeScript and 485-test results above were recorded before the
final exact-install attempt. That attempt did not change tracked files, but its
timeout left the ignored local dependency directory incomplete; the remote
clean-checkout workflow is therefore the authoritative final installation
check.

## Deliberately deferred

- Runtime validators plus an entity-type map should replace the five remaining
  storage/sync casts before those boundaries can be tightened safely.
- Billing/SaaS and some frontend/backend subscription contracts need a product
  decision before they can share a single owner.
- Active provider, persistence, offline, authentication, import, security, and
  observability fallbacks remain because they implement explicit operational
  behavior. Their individual evidence is recorded in tracks 6 and 7.
- Remaining structural section labels are retained where they help navigation
  in long modules; they should be simplified only when those modules are
  otherwise edited.

## Worktree provenance

`tests/unit/observability-client.test.ts` was already modified before this
cleanup began. Those changes remain isolated from the cleanup commit. During
focused validation, its stale fallback-version expectation was corrected from
`0.9.6` to the current `0.9.7`; the focused observability test now passes.
