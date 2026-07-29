# DRY Consolidation Assessment — 2026-07-27

## Scope

Behavior-preserving deduplication across live frontend hooks, financial services,
AI detectors, and shared helpers. This pass did not consolidate type ownership,
remove modules based on reachability, or change product behavior; those concerns
belong to the parallel type and unused-code tracks.

## Method and evidence

1. Read the canonical product and engineering rules, the active planning bundle,
   the GSD workflow, the previous cleanup report, and the runtime roots:
   `App.tsx`, `backend/src/index.ts`, `hooks/useAuthAndWorkspace.ts`,
   `hooks/useSyncEngine.ts`, `hooks/useFinancialState.ts`, and
   `src/app/financeService.ts`.
2. Followed the live flow:
   `App` composes authentication/workspace state, synchronization state, and
   financial state; `useFinancialState` delegates mutations to
   `financeService`; `useSyncEngine` persists and reconciles collection IDs.
3. Searched TypeScript/TSX sources for repeated helper implementations and then
   inspected consumers before editing.
4. Compared semantics, not only similar names. Similar helpers were rejected
   when they differed on local versus UTC dates, calendar validation, fallback
   behavior, or financial invariants.
5. Re-ran focused consumer tests and the app type-check after consolidation.

Evidence found:

- `applyIdMapToCollection` had two identical implementations:
  `hooks/useSyncEngine.ts` and `src/app/financeServiceHelpers.ts`. The hook had
  five live consumers and the finance service had four.
- `fixedExpenseDetectorHelpers.ts` and `salaryDetectorHelpers.ts` duplicated the
  same text normalization, median, local date parsing, local date formatting,
  and stable day-of-month calculation.
- A broad search still finds 66 date/normalization helper declarations. This is
  a warning signal, but not proof that all 66 share one valid contract.
- `useSyncEngine` still contains five explicit persistence branches for
  accounts, transactions, goals, reminders, and receivables.

## Critical assessment

The codebase is already past the stage where global DRY rewrites are safe. The
previous cleanup removed obvious duplicate and dead files; what remains is often
repetition caused by distinct financial, persistence, or boundary semantics.
The highest-value DRY work is therefore small, evidence-backed consolidation of
identical pure behavior.

The two implemented findings had a single algorithm and multiple live
consumers. Centralizing them reduces the chance that ID reconciliation or
recurring-pattern calculations drift independently. By contrast, a generic CRUD
repository or a global date parser would currently hide meaningful differences
and increase the blast radius of financial changes.

## Findings by confidence

### High confidence — implemented

#### H1. Collection ID reconciliation had two sources of truth

Both implementations returned the original array when there was no mapping and
created new objects only for mapped IDs. They were byte-for-byte equivalent in
behavior and served the same synchronization contract.

Recommendation: keep one generic pure helper.

Implementation:

- Added `src/utils/collectionIds.ts`.
- Updated `hooks/useSyncEngine.ts` and `src/app/financeService.ts` to use it.
- Removed the duplicate implementation from
  `src/app/financeServiceHelpers.ts`.

#### H2. Salary and fixed-expense detectors duplicated recurring primitives

Five pure functions were duplicated across both detector helper modules:
normalization, median, local date parsing, local date formatting, and stable
day-of-month calculation.

Recommendation: centralize only the identical primitives while leaving
detector-specific policy local.

Implementation:

- Added `src/ai/recurringPatternHelpers.ts`.
- Updated both detector modules and their local helpers to consume it.
- Kept keyword/pattern matching, interval checks, trend logic, and next-date
  policy in their owning detector helpers.

### Medium confidence — deferred

#### M1. Synchronization branches are mechanically repeated

`useSyncEngine.syncEntities` has five explicit calls to
`replaceSyncEntityCollection` and five explicit ID-application branches.

Recommendation: consider a typed collection descriptor only after the shared
sync-type consolidation is stable and tests cover partial updates and ID maps
for every entity kind. A loop that requires erased unions or broad casts would
reduce type safety and clarity, so it was not introduced here.

#### M2. Date parsing remains fragmented

The source scan found 66 date/normalization helper declarations. Several look
similar, but inspected implementations differ in important ways:

- impossible calendar dates may be rejected or normalized;
- date-only values may be local-calendar or UTC-oriented;
- callers require `Date`, timestamp, date key, or nullable fallback;
- import, forecast, UI, and provider boundaries have different trust models.

Recommendation: first define explicit date contracts and a shared behavior
matrix. Consolidate only groups proven equivalent by tests. Do not replace these
helpers with a single permissive parser.

#### M3. Two utility entry points overlap

`utils/helpers.ts` and `src/utils/helpers.ts` both expose `makeId` and
`formatCurrency`, but their surrounding storage behavior and `makeId`
implementations differ.

Recommendation: split pure ID/currency utilities into dedicated modules in a
separate migration, update the import graph, and remove compatibility entry
points only after reachability validation.

### Low confidence or rejected

#### R1. Generic financial CRUD abstraction

Transaction, account, and goal mutations repeat find/assert/map/filter shapes,
but their invariants differ: batch transaction deletion, last-account
protection, ownership enforcement, scoped-field normalization, and goal amount
clamping. A generic repository would hide those rules and increase complexity.

Decision: keep the explicit service functions.

#### R2. Merge detector-specific next-date policy

Fixed-expense next-date calculation caps a detected day at 28; salary uses the
detected day directly. Combining them behind a boolean or options object would
make the policy less visible.

Decision: keep two small policy functions and share only their primitives.

#### R3. Merge frontend and backend health/bootstrap paths

Similar route/bootstrap shapes cross distinct runtime and trust boundaries.
Sharing them would couple deploy targets without enough maintenance benefit.

Decision: no cross-runtime consolidation.

## Tests added

`tests/unit/dry-consolidation-helpers.test.ts` covers:

- text normalization and odd/even median behavior;
- local-calendar handling of a date-only value;
- stable recurring day-of-month calculation;
- ID reconciliation, identity preservation without mappings, and input
  immutability.

Existing detector, synchronization, and finance-service tests were also used as
consumer-level regression coverage.

## Validation

- `npx vitest run tests/unit/dry-consolidation-helpers.test.ts tests/unit/fixed-expense-detector.test.ts tests/unit/salary-detector.test.ts tests/unit/useSyncEngine.test.tsx tests/unit/finance-service.test.ts --pool=forks --maxWorkers=1`
  - PASS: 17 test files, 82 tests.
- `npm run type-check:app`
  - PASS.
- `npm run docs:check-mojibake`
  - PASS: no mojibake patterns found.
- `git diff --check -- <owned files>`
  - PASS; only line-ending conversion notices were emitted.

The full suite and aggregate coverage were intentionally left to central
integration because parallel Node processes made the aggregate baseline exceed
its timeout. No production files were removed, and no commit or push was made.

## Files changed by this track

- `hooks/useSyncEngine.ts`
- `src/ai/fixedExpenseDetector.ts`
- `src/ai/fixedExpenseDetectorHelpers.ts`
- `src/ai/recurringPatternHelpers.ts`
- `src/ai/salaryDetector.ts`
- `src/ai/salaryDetectorHelpers.ts`
- `src/app/financeService.ts`
- `src/app/financeServiceHelpers.ts`
- `src/utils/collectionIds.ts`
- `tests/unit/dry-consolidation-helpers.test.ts`
- `docs/code-quality/2026-07-27-01-dry-consolidation.md`

## Residual risk

The main residual risk is integration overlap in `hooks/useSyncEngine.ts`, which
is also participating in the parallel shared-type cleanup. The combined file
type-checks and its focused tests pass at this snapshot. The integration owner
should re-run the app type-check after all parallel edits settle.
