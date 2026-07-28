# Track 08 - AI slop, stubs and comments

Date: 2026-07-27
Scope: production TypeScript/TSX comments and apparent scaffolding in the combined worktree.

> Final integration note: exact Unicode inspection found double-encoded symbols
> that were outside the phase-marker scan. The final pass repaired 1,625
> sequences across seven production files, including structural separators and
> user-visible arrows, bullets, warnings, multiplication signs, ellipses, and
> category icons. Known broken sequences now scan to zero.

## Verdict

The main problem was not unfinished runtime code. It was implementation-history
narration left in production files: `PART`, `STEP` and `Sprint` labels, oversized
section banners, a stale OAuth `scaffold mock-first` description, and commented
provider implementations that did not exist.

The live candidates that looked like stubs were not removed:

- the local mock bank provider is used by Open Banking and health tests;
- both AI control panels are development tools with runtime entry points and
  tests;
- billing export's `501` is an explicit unavailable-feature contract;
- the banking connect-token `501` is a provider-mode response, not a stub.

Result:

- implementation-phase markers: **57 -> 0**;
- decorative banner comments: **140 -> 123**;
- explicit stub/scaffold comment matches: **2 -> 0**;
- real `TODO`/`FIXME`/`HACK`/`XXX` markers: **0 -> 0**;
- `501`/not-implemented contract matches: **3 -> 3**, deliberately preserved.

No production feature, endpoint, financial invariant, security rationale,
external contract, public JSDoc or runbook was removed.

## Method and baseline

1. Read the project instructions, canonical Flow Finance planning context, GSD
   workflow, historical cleanup assessment and reports `01` through `07`.
2. Searched production roots separately from tests, documentation, generated
   output, `.tmp`, coverage and dependencies.
3. Used anchored task-marker patterns. A case-insensitive search for `TODO`
   alone is invalid in this Portuguese codebase because it matches words such
   as `todos`.
4. Traced every apparent stub through imports, routes, OpenAPI, tests and product
   documentation before deciding whether it was dead.
5. Limited edits to high-confidence comment cleanup. Existing code changes from
   other parallel tracks were preserved.

Initial inventory:

| Signal | Baseline | Interpretation |
| --- | ---: | --- |
| `PART`/`Sprint`/`Phase`/`Step` markers | 57 | Historical implementation sequencing, not maintainable architecture |
| Decorative section banners | 140 | Mixed: some useful navigation, some phase narration |
| Anchored `TODO`/`FIXME`/`HACK`/`XXX` | 1 textual hit | False positive: Portuguese `Todo ponto de entrada` |
| Stub/scaffold vocabulary in comments | 2 | Stale OAuth scaffold label and mock-provider implementation narration |
| `501`/not implemented | 3 | Billing implementation + OpenAPI contract, and conditional banking response |

The banner count was used for triage, not as a deletion target. Many remaining
section labels still help navigation in long controllers, parsers, security
modules and DTO collections.

## Critical assessment

### 1. Phase labels had outlived the implementation plan

Comments such as `PART 2`, `PART 9`, `STEP 4` and `Sprint 3` describe how work
was once sequenced. They do not tell a new maintainer what the current boundary
or invariant is. They also make files appear unfinished after the behavior is
already implemented and tested.

Where a section label remained useful, it was replaced with a short
responsibility-based label such as `Transaction synchronization`, `Event
persistence` or `Memory integration`. Comments that merely repeated the next
function name were removed.

### 2. Apparent stubs were mostly real contracts

Textual searches alone would have produced destructive recommendations:

- `services/integrations/mockBankProvider.ts` is imported by
  `openBankingService`, and `getProvider('mock')` is exercised by the integration
  health gate.
- `pages/AIControlPanel.tsx` is lazy-loaded by navigation and covered by
  snapshot, simulation, parser and memory tests.
- `src/debug/aiPanel/AIControlPanel.tsx` has a separate bootstrap entry and
  viewer tests.
- `/api/billing/export` deliberately returns `501`; the response is asserted by
  an integration test, declared in OpenAPI and kept outside the current Pro
  promise.
- `/api/banking/connect-token` returns `501` only when Pluggy is not the active
  provider. That is a mode-specific API response.

These are not safe dead-code candidates.

### 3. Provider comments advertised code that did not exist

The mock provider file contained a tree showing hypothetical Pluggy, Belvo and
TrueLayer classes plus three commented registry entries. Those comments were
removed because they looked like implementation and package guidance without
providing runtime behavior.

The `ProviderKey` union was retained. Active Open Banking records and tests use
provider values beyond `mock`, so narrowing the type would be a contract change,
not comment cleanup.

### 4. Useful comments remain

The pass deliberately retained comments that explain:

- financial calculations and date semantics;
- security and tenant-isolation decisions;
- best-effort recovery and observability ownership;
- external API and persisted-data contracts;
- why development diagnostics are excluded from production;
- public interfaces and non-obvious domain policy.

## Implemented high-confidence cleanup

### Implementation-history markers

Removed or replaced all 57 phase markers across:

- Open Banking orchestration and mock provider;
- AI control panel and import event emission;
- adaptive AI, debug, insight, risk and recurring detectors;
- AI worker entry point;
- event engine;
- bank sync, CSV, OFX, money map and recurring services.

Functional labels were kept only where they help a maintainer navigate a long
module.

### Stale scaffold narration

- Replaced `Callback OAuth Google (scaffold mock-first)` with the current route
  responsibility: exchanging the Google callback for an application session.
- Replaced the mock provider's implementation-plan diagram with a concise
  description of its current local-flow role.
- Removed commented future provider instances and package-install suggestions.
- Removed `Sprint 3 simple function API` above `runAIWorker()`.

### Redundant comments

- Reworded comments that repeated the next statement into intent, such as
  preserving a successful import when auxiliary category-learning notification
  fails.
- Removed section banners that did nothing beyond restating a function name.
- Reduced one duplicated AI graph-tab banner to a single short label.

## Deliberately preserved

| Candidate | Evidence | Decision |
| --- | --- | --- |
| Billing export `501` | Route/controller/service, OpenAPI, integration test and monetization note agree that export is unavailable and not sold | Preserve explicit contract |
| Banking connect-token `501` | Returned only outside Pluggy provider mode | Preserve provider-mode response |
| Mock bank provider | Imported by live Open Banking service and exercised by health tests | Preserve runtime implementation |
| Both AI control panels | Runtime entry points and focused tests exist | Preserve internal tooling |
| `IS_DEV` guard comment | Explains a production-exclusion decision | Preserve, make concise |
| Portuguese `Todo ponto de entrada` | Sentence, not a task marker | Preserve |
| Remaining 123 section banners | Mixed structural value; no evidence supports mass deletion | Defer opportunistic cleanup |

## Validation

Passed on the combined worktree after the comment cleanup:

```text
npm run type-check:app
PASS

npm run type-check:backend
PASS

Focused application tests
12 files
101 tests PASS

Focused OAuth controller tests
1 file
2 tests PASS

Knip files/unlisted/unresolved
PASS

Madge application graph
0 circular dependencies

Madge backend graph
0 circular dependencies

npm run docs:check-mojibake
PASS

git diff --check -- <track files>
PASS (line-ending notices only)
```

The focused application set covered Open Banking, IO health, AI control-panel
snapshots, event routing, bank sync, fixed-expense and salary detection,
subscription receipts, OFX/CSV imports, money map and recurring transactions.

The billing integration file is excluded by the repository's active Vitest
configuration, so this track does not claim a fresh execution of that test. Its
source, OpenAPI fragment and monetization documentation were inspected as
contract evidence, and the production billing code was not changed.

`tests/unit/observability-client.test.ts` was not edited.

## Files touched by this track

- `backend/src/routes/auth.ts`
- `pages/AIControlPanel.tsx`
- `pages/ImportTransactions.tsx`
- `services/integrations/mockBankProvider.ts`
- `services/integrations/openBankingService.ts`
- `src/ai/adaptiveAIEngine.ts`
- `src/ai/aiDebugService.ts`
- `src/ai/fixedExpenseDetector.ts`
- `src/ai/insightGenerator.ts`
- `src/ai/queue/AIWorker.ts`
- `src/ai/riskAnalyzer.ts`
- `src/ai/salaryDetector.ts`
- `src/ai/subscriptionDetector.ts`
- `src/events/eventEngine.ts`
- `src/finance/bankSyncEngine.ts`
- `src/finance/csvParser.ts`
- `src/finance/moneyMap.ts`
- `src/finance/ofxParser.ts`
- `src/finance/recurringService.ts`
- `docs/code-quality/2026-07-27-08-ai-slop-comments.md`

Several of these files also contain concurrent changes owned by tracks `01`
through `07`. This track did not revert or rewrite those changes.

## Recommendations

1. Add a narrow comment-lint rule for new `PART`, `Sprint`, `Phase` and numbered
   implementation-step markers in production source. Do not use a raw
   case-insensitive `TODO` substring search.
2. Prefer comments that explain policy, invariants, boundaries or failure
   behavior. Do not narrate work order or restate the next function.
3. Clean remaining decorative banners opportunistically when a file is already
   being changed; a repository-wide banner purge would create noise without a
   behavior or maintenance benefit.
4. Keep explicit unavailable-feature responses documented and tested. Retire
   the billing export `501` only through a product/API decision, not through
   keyword cleanup.
5. Do not narrow provider contracts until persisted connection data and all
   provider-mode consumers have been audited.

No commit or push was made.
