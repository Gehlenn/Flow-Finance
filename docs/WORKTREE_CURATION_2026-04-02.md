# Worktree Curation - 2026-04-02

This note groups the current worktree into changes that are ready to commit versus changes that still need cleanup or a separate review pass.

## Ready For Commit

These areas are validated by `npm run lint` and targeted test coverage executed on April 2, 2026.

### Frontend Architecture Cutover

- [App.tsx](/E:/app%20e%20jogos%20criados/Flow-Finance/App.tsx)
- [hooks/useAuthAndWorkspace.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/hooks/useAuthAndWorkspace.ts)
- [hooks/useSyncEngine.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/hooks/useSyncEngine.ts)
- [hooks/useFinancialState.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/hooks/useFinancialState.ts)
- [hooks/useNavigationTabs.tsx](/E:/app%20e%20jogos%20criados/Flow-Finance/hooks/useNavigationTabs.tsx)
- [hooks/useCashFlowState.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/hooks/useCashFlowState.ts)
- [src/app/financeService.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/app/financeService.ts)

### Workspace Admin / Audit / Permissions

- [pages/WorkspaceAdmin.tsx](/E:/app%20e%20jogos%20criados/Flow-Finance/pages/WorkspaceAdmin.tsx)
- [pages/WorkspaceAudit.tsx](/E:/app%20e%20jogos%20criados/Flow-Finance/pages/WorkspaceAudit.tsx)
- [src/security/workspacePermissions.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/security/workspacePermissions.ts)
- [src/services/firestoreWorkspaceStore.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/services/firestoreWorkspaceStore.ts)
- [src/services/firestoreBillingStore.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/services/firestoreBillingStore.ts)
- [src/services/workspaceSession.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/services/workspaceSession.ts)
- [components/Settings.tsx](/E:/app%20e%20jogos%20criados/Flow-Finance/components/Settings.tsx)
- [firestore.rules](/E:/app%20e%20jogos%20criados/Flow-Finance/firestore.rules)
- [firebase.json](/E:/app%20e%20jogos%20criados/Flow-Finance/firebase.json)
- [package.json](/E:/app%20e%20jogos%20criados/Flow-Finance/package.json)
- [.github/workflows/firestore-rules.yml](/E:/app%20e%20jogos%20criados/Flow-Finance/.github/workflows/firestore-rules.yml)

### SaaS / Usage / Event Persistence

- [src/saas/types.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/saas/types.ts)
- [src/saas/httpAdapters.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/saas/httpAdapters.ts)
- [src/saas/firestoreAdapters.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/saas/firestoreAdapters.ts)
- [src/saas/usageTracker.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/saas/usageTracker.ts)
- [src/events/eventEngine.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/events/eventEngine.ts)
- [backend/src/routes/saas.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/routes/saas.ts)
- [backend/src/routes/finance.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/routes/finance.ts)
- [backend/src/services/finance](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/services/finance)

### Sync / IDs / Ownership / Security

- [src/services/sync/cloudSyncClient.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/services/sync/cloudSyncClient.ts)
- [backend/src/routes/sync.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/routes/sync.ts)
- [backend/src/services/sync/cloudSyncStore.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/services/sync/cloudSyncStore.ts)
- [backend/src/validation/sync.schema.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/validation/sync.schema.ts)
- [backend/src/config/cors.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/config/cors.ts)
- [backend/src/docs](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/docs)

### Import / OCR / Subscription Consolidation

- [src/services/importacao/extractImporter.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/services/importacao/extractImporter.ts)
- [src/services/importacao/ocrRecibo.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/services/importacao/ocrRecibo.ts)
- [src/importers/importPipeline.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/importers/importPipeline.ts)
  Status: removed intentionally
- [src/ai/subscriptionDetectionCore.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/ai/subscriptionDetectionCore.ts)
- [src/ai/subscriptionDetector.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/ai/subscriptionDetector.ts)
- [src/engines/finance/subscriptionDetector/subscriptionDetector.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/src/engines/finance/subscriptionDetector/subscriptionDetector.ts)

### Clean Runtime Baselines

- [backend/data/saas-store.json](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/data/saas-store.json)
- [backend/data/workspaces.json](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/data/workspaces.json)

These now contain deterministic empty baselines instead of locally generated IDs and timestamps.

## Needs More Cleanup Before Commit

### Historical Docs With Encoding Drift

- [docs/AUDITORIA_THOROUGH_2026-03-11.md](/E:/app%20e%20jogos%20criados/Flow-Finance/docs/AUDITORIA_THOROUGH_2026-03-11.md)
- [docs/CHANGELOG.md](/E:/app%20e%20jogos%20criados/Flow-Finance/docs/CHANGELOG.md)

These files currently mix the intended historical-note changes with a large encoding/character-set diff. They should be cleaned in a dedicated doc-only pass before commit, or excluded from the next code-focused commit.

### Large Backend Migration / Cutover Slice

- [backend/src/services/persistence/postgresStateStore.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/services/persistence/postgresStateStore.ts)
- [backend/src/services/admin/workspaceStore.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/services/admin/workspaceStore.ts)
- [backend/src/utils/saasStore.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/utils/saasStore.ts)
- [backend/migrations/003_multi_tenant_audit.sql](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/migrations/003_multi_tenant_audit.sql)
- [backend/scripts/apply-normalized-migrations.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/scripts/apply-normalized-migrations.ts)
- [backend/scripts/postgres-cutover-run.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/scripts/postgres-cutover-run.ts)
- [backend/scripts/postgres-cutover-preflight.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/scripts/postgres-cutover-preflight.ts)
- [backend/src/utils/postgresMigrationPlan.ts](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/src/utils/postgresMigrationPlan.ts)
- [backend/POSTGRES_CUTOVER.md](/E:/app%20e%20jogos%20criados/Flow-Finance/backend/POSTGRES_CUTOVER.md)

This slice type-checks, but it is broad enough that it should ideally ship in its own commit after a focused integration review.

## Recommended Commit Grouping

1. Frontend composition root, hooks, finance service, sync, import/OCR/subscriptions, workspace admin UI, Firestore SaaS/workspace adapters, tests.
2. Backend API hardening and support files: CORS, OpenAPI, sync ownership, SaaS/finance routes, validation, tests.
3. Backend normalized-state / cutover / migration work.
4. Docs-only cleanup for historical documents with encoding normalization.

## Validation Used For This Curation

- `npm run lint`
- `npm run test:coverage:critical`
- `npm run test -- tests/unit/useAuthAndWorkspace.test.tsx tests/unit/useSyncEngine.test.tsx tests/unit/useFinancialState.test.tsx tests/unit/finance-service.test.ts tests/unit/firestore-billing-store.test.ts tests/unit/firestore-adapters.test.ts tests/unit/firestore-workspace-store.test.ts tests/unit/settings-workspace-admin.test.tsx tests/unit/workspace-admin-page.test.tsx tests/unit/workspace-audit-page.test.tsx tests/unit/firestore-rules.static.test.ts`
