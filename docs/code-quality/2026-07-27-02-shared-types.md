# Shared Types Assessment - 2026-07-27

## Scope and method

This track reviewed type ownership across the Flow Finance app and backend without changing financial meaning or crossing the frontend/backend build boundary.

Method:

1. Read the canonical product, engineering, stack, 30-day, intake, integration, AI and billing-gating context.
2. Read `docs/CODE_QUALITY_CLEANUP_2026-04-30.md`, both package manifests and all three TypeScript configurations.
3. Inventoried top-level `type`, `interface` and `enum` declarations under production source roots.
4. Grouped declarations by name and by normalized AST shape.
5. Traced every candidate through imports, exports and runtime consumers before deciding ownership.
6. Required both structural equality and shared semantics before consolidation.

Inventory snapshot:

- 699 top-level type/interface/enum declarations across 233 production files in the concurrent cleanup snapshot.
- 13 groups remain structurally identical after this pass and the coordinated dead-code removals.
- Most remaining exact groups cross the app/backend compilation boundary or belong to intentionally separate API, persistence, authorization or billing contracts.

This count is an inventory aid, not a quality score. A repeated shape is not automatically a shared contract.

## Critical assessment

The codebase had three distinct problems:

1. **Real duplicate ownership inside the app.** Navigation tabs, sync entities/status/id maps, profile state, cash-flow timeframe and subscription cycle had multiple sources of truth with identical semantics.
2. **Weak parallel typing around bank sync.** The engine exposed a precise report while the persistence helper described the same report with `unknown[]` and `unknown` analysis fields. That allowed drift at the handoff between generation and storage.
3. **Superficial duplication across boundaries.** SaaS/billing, finance HTTP DTOs and banking DTOs contain equal-looking declarations, but current TypeScript project boundaries and validation responsibilities are different. Collapsing these now would turn a type cleanup into a contract migration.

The broad `shared/types/index.ts` barrel was not a safe canonical owner: no production consumer imported it, several declarations had already drifted from live models, and it mixed runtime, JWT, billing, graph and finance concerns. It was reported to and removed by the coordinated dead-code track instead of being used as a new dependency.

## Proven duplications and ownership decisions

| Area | Evidence | Decision | Canonical owner |
| --- | --- | --- | --- |
| Navigation tab | `hooks/navigationTypes.ts` and `hooks/useNavigationTabs.tsx` had identical unions; all page/shell consumers already used `navigationTypes.ts` | Consolidate | `hooks/navigationTypes.ts` |
| Sync status | `hooks/useSyncEngine.ts` and `src/app/appShellLayout.ts` had identical unions | Consolidate | `src/services/sync/syncTypes.ts` |
| Sync entity | Firestore workspace types and cloud sync client had identical unions | Consolidate | `src/services/sync/syncTypes.ts` |
| Sync id map | Hook and Firestore workspace types both used `Record<string, string>` for the same reconciliation map | Consolidate | `src/services/sync/syncTypes.ts` |
| Profile state | Hook, demo bootstrap, local storage and Firestore each declared the same name/theme/alerts/reminders shape | Consolidate | `src/services/profileTypes.ts` |
| Cash-flow timeframe | Cash Flow UI recreated the exact analytics-engine timeframe union | Consolidate | `src/engines/finance/analyticsEngine.ts` |
| Subscription cycle | Shared detector core and full AI detector declared the same billing cadence | Consolidate | `src/ai/subscriptionDetectionCore.ts` |
| Bank sync report | Engine used precise result/analysis fields while its persistence helper used `unknown` for the same report | Consolidate and strengthen | `src/finance/bankSyncTypes.ts` |

## Keep versus consolidate matrix

| Candidate | Decision | Reason |
| --- | --- | --- |
| Root prediction types vs backend prediction types | Resolved by dead-code track, not consolidated | The coordinated unused-code analysis removed the unreferenced frontend prediction hook/chart and root type copy. Active backend prediction types remain backend-owned. This track did not cross the build boundary or migrate the prediction API. |
| App finance timeline types vs backend finance-controller DTOs | Defer | Equal shapes are currently internal engine output versus HTTP response contracts. No runtime schema proves they can evolve together. |
| `src/saas/types.ts` vs `backend/shared/policyEngine.ts` | Defer | Exact shapes exist, but authorization and billing are high-risk boundaries with separate compilation and tests. Prior cleanup explicitly deferred this migration. |
| App `WorkspacePlan` vs backend workspace plan | Keep separate | The app type owns packaging/gating while the backend type participates in persisted/API workspace state. |
| `WorkspaceRole` vs SaaS `UserRole` | Keep separate | Membership role and policy role happen to share literals today but have different ownership and change drivers. |
| App bank model vs backend banking-controller types | Keep separate | They use different serialization and validation boundaries even where status/provider literals match. |
| Feature flag contexts | Keep separate | The basic flag service and enhanced kill-switch service require different fields and plan semantics. Same name does not mean same contract. |
| Financial health contexts | Keep separate | One consumes monthly amounts and user context; the other consumes normalized ratios and forecast inputs. They are homonyms, not duplicates. |
| Subscription detector result types | Keep separate | The compatibility finance detector emits a small result; the AI detector emits enriched transactions, confidence and forecasts. |
| Local `StorageLike` aliases | Keep local | The one-property alias is trivial and coupling two unrelated bootstraps would not reduce complexity. |
| `shared/types/index.ts` | Removed by dead-code track | No live imports and materially drifted declarations; not suitable as a canonical owner. |

## Implemented high-confidence changes

- Removed the duplicate `Tab` declaration from `useNavigationTabs`.
- Added `src/services/sync/syncTypes.ts` for app sync status, entity names and reconciliation id maps.
- Removed duplicate sync declarations and updated hook, Firestore, cloud-sync and app-shell consumers.
- Added `src/services/profileTypes.ts` and updated demo, local storage, Firestore profile and hook consumers.
- Reused the analytics engine's `CashflowTimeframe` in the Cash Flow UI.
- Renamed the detector-core cadence to `SubscriptionBillingCycle` and reused it from detector helpers and the full detector.
- Added `src/finance/bankSyncTypes.ts`; the report persistence helper now accepts the precise engine report rather than a parallel weak shape.
- Removed type re-exports with no proven consumers:
  - `Tab` from `hooks/useNavigationTabs.tsx`
  - `AppShellSyncStatus` from `src/app/appShellLayout.ts`
  - `SyncEntityIdMap` from `src/services/sync/cloudSyncClient.ts`
  - profile/sync types from the Firestore workspace barrel

## Contract checks

`tests/unit/shared-type-contracts.test.ts` verifies at compile/transform time that:

- navigation consumers use the canonical `Tab`;
- Cash Flow uses the analytics timeframe;
- subscription inference returns the canonical billing cycle;
- bank sync storage returns the canonical report;
- demo and local profiles return the same `ProfileState`;
- cloud sync accepts the canonical `SyncEntity`;
- shell status accepts the canonical `SyncStatus`;
- reconciliation maps retain the expected key/value shape.

Existing focused tests cover behavior for bank sync, cloud sync and the sync hook.

## Validation

Passed:

- `npm run type-check:app`
- `npm run type-check:backend`
- `npx vitest run tests/unit/shared-type-contracts.test.ts --pool=threads --maxWorkers=1 --reporter=verbose`
  - 1 file, 1 test passed.
- `npx vitest run tests/unit/bank-sync-engine.test.ts --pool=threads --maxWorkers=1 --reporter=verbose`
  - 4 discovered copies, 20 tests passed because the repository's Vitest discovery also matched three `.tmp` deploy copies.
- `npx vitest run tests/unit/cloud-sync-client.test.ts tests/unit/useSyncEngine.test.tsx --exclude .tmp/** --pool=threads --maxWorkers=1 --reporter=verbose`
  - 2 files, 15 tests passed.
- `npx vitest run tests/unit/subscription-receipt.test.ts tests/unit/demoBootstrap.test.ts --exclude .tmp/** --pool=threads --maxWorkers=1 --reporter=verbose`
  - 2 files, 27 tests passed.
- `npx vitest run tests/unit/cashflow-clarity.test.tsx --exclude .tmp/** --pool=threads --maxWorkers=1 --reporter=verbose`
  - 1 file, 10 tests passed.
- `npx vitest run tests/unit/navigation-tab-url-sync.test.tsx --exclude .tmp/** --pool=threads --maxWorkers=1 --reporter=verbose`
  - 1 file, 3 tests passed.

Environment-limited:

- Two larger combined Vitest batches kept processes alive without emitting output until command timeout during heavy concurrent test activity. The exact spawned `npx`, `cmd` and `node` process trees were terminated; no known test process from this track was left orphaned.
- The affected navigation, Cash Flow, subscription and demo files were then rerun in smaller batches and all passed as reported above.

## Deferrals and risks

1. **Billing/SaaS remains duplicated.** Consolidation requires authorization, quota, workspace isolation, billing-hook and Stripe regression coverage.
2. **Backend sync supports `subscriptions`; app entity sync does not.** This pass intentionally preserved that difference. Adding subscriptions to app sync requires state, hydration, persistence and conflict-resolution behavior, not only a wider union.
3. **Static report typing does not validate stored JSON.** `getSyncReports()` still trusts local storage after parsing. Runtime schema validation belongs in a boundary-hardening track.
4. **Profile parsing is still boundary-specific.** Local and Firestore normalizers remain separate even though their output type is shared; merging behavior was outside this type-only scope.
5. **DTO generation is absent.** If frontend/backend drift becomes recurrent, prefer schemas or generated types over importing implementation files across project roots.
6. **Prediction has no active frontend owner now.** If the product reintroduces prediction UI, establish an explicit API contract or generated type rather than restoring a copied root declaration.

## Recommendations

1. Treat SaaS/billing consolidation as a security-sensitive migration with contract tests before moving declarations.
2. Add runtime schemas at JSON, Firestore and HTTP boundaries; shared TypeScript types alone do not validate external data.
3. If prediction returns to the frontend, create an explicit API-contract phase rather than changing `rootDir` or copying backend declarations opportunistically.
4. Keep small domain-local types local when sharing would only introduce coupling.
5. Continue rejecting broad barrels that mix unrelated domains; canonical owners should sit beside the behavior or schema they describe.
