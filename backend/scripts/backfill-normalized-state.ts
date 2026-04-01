import 'dotenv/config';

import { initializePostgresStateStore, isPostgresStateStoreEnabled } from '../src/services/persistence/postgresStateStore';
import {
  getWorkspaceStoreSnapshotForTests,
  initializeWorkspaceStorePersistence,
} from '../src/services/admin/workspaceStore';
import {
  getWorkspaceBillingHookCount,
  getWorkspaceUsage,
  initializeSaasStorePersistence,
} from '../src/utils/saasStore';
import { getAuditEventCount, initializeAuditLogPersistence } from '../src/services/admin/auditLog';

async function main(): Promise<void> {
  if (!isPostgresStateStoreEnabled()) {
    throw new Error('POSTGRES_STATE_STORE_ENABLED=true is required to backfill normalized state');
  }

  if (String(process.env.DISABLE_LEGACY_STATE_BLOBS || '').toLowerCase() === 'true') {
    throw new Error('Disable DISABLE_LEGACY_STATE_BLOBS while running the backfill script');
  }

  const initialized = await initializePostgresStateStore();
  if (!initialized) {
    throw new Error('Postgres state store could not be initialized');
  }

  await initializeWorkspaceStorePersistence();
  await initializeSaasStorePersistence();
  await initializeAuditLogPersistence();

  const workspaceSnapshot = getWorkspaceStoreSnapshotForTests();
  const workspaceIds = workspaceSnapshot.workspaces.map((workspace) => workspace.workspaceId);
  const usageMonths = workspaceIds.reduce((acc, workspaceId) => acc + Object.keys(getWorkspaceUsage(workspaceId)).length, 0);
  const billingHooks = workspaceIds.reduce((acc, workspaceId) => acc + getWorkspaceBillingHookCount(workspaceId), 0);

  console.log(JSON.stringify({
    status: 'ok',
    workspaces: workspaceSnapshot.workspaces.length,
    workspaceUsers: workspaceSnapshot.workspaceUsers.length,
    userPreferences: workspaceSnapshot.userPreferences.length,
    workspaceUsageMonths: usageMonths,
    workspaceBillingHooks: billingHooks,
    auditEventsBuffered: getAuditEventCount(),
    nextStep: 'Enable DISABLE_LEGACY_STATE_BLOBS=true after validating the normalized tables in Postgres.',
  }, null, 2));
}

void main().catch((error) => {
  console.error('[backfill-normalized-state] failed');
  console.error(error);
  process.exit(1);
});
