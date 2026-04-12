import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, vi } from 'vitest';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';
import { resetCloudSyncStoreForTests } from '../../src/services/sync/cloudSyncStore';
import { getAuditEvents, resetAuditLogForTests } from '../../src/services/admin/auditLog';

vi.mock('../../src/config/database', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  testConnection: vi.fn().mockResolvedValue(false),
  checkDatabaseHealth: vi.fn().mockResolvedValue(false),
  closePool: vi.fn().mockResolvedValue(undefined),
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  },
  default: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  },
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  isPostgresStateStoreEnabled: vi.fn().mockReturnValue(false),
  initializePostgresStateStore: vi.fn().mockResolvedValue(false),
  saveWorkspaceStoreState: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceStoreState: vi.fn().mockResolvedValue(null),
  saveWorkspaceSaasState: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceSaasState: vi.fn().mockResolvedValue(null),
  saveJsonState: vi.fn().mockResolvedValue(undefined),
  loadJsonState: vi.fn().mockResolvedValue(null),
  insertAuditEvent: vi.fn().mockResolvedValue(undefined),
  loadRecentAuditEvents: vi.fn().mockResolvedValue([]),
  queryAuditEvents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  queryWorkspaceMeteringSummary: vi.fn().mockResolvedValue(null),
  queryWorkspaceUsageEvents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  queryWorkspaceById: vi.fn().mockResolvedValue(null),
  queryWorkspacesForUser: vi.fn().mockResolvedValue([]),
  queryWorkspaceUsers: vi.fn().mockResolvedValue([]),
  queryLastWorkspaceForUser: vi.fn().mockResolvedValue(null),
  queryWorkspaceByBillingCustomerId: vi.fn().mockResolvedValue(null),
  queryTenantById: vi.fn().mockResolvedValue(null),
  queryTenantsForUser: vi.fn().mockResolvedValue([]),
  queryDomainEvents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  insertDomainEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/openFinance/providerMode', () => ({
  isSupportedOpenFinanceProvider: () => true,
  isPluggyProviderEnabled: () => false,
}));

let app: Express;

describe('Workspace storage isolation', () => {
  beforeAll(async () => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.OPEN_FINANCE_PROVIDER = 'mock';
    process.env.OPEN_FINANCE_STORE_DRIVER = 'memory';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    process.env.FEATURE_OPEN_FINANCE = 'true';
    ({ default: app } = await import('../../src/index'));
  });

  beforeEach(() => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.OPEN_FINANCE_PROVIDER = 'mock';
    process.env.OPEN_FINANCE_STORE_DRIVER = 'memory';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    process.env.FEATURE_OPEN_FINANCE = 'true';
    resetWorkspaceStoreForTests();
    resetCloudSyncStoreForTests();
    resetAuditLogForTests();
  });

  it('isolates sync state by workspace for the same user', async () => {
    const ownerUserId = 'owner-sync-same-user';

    const firstWorkspace = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Workspace One' });

    const secondWorkspace = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Workspace Two' });

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', firstWorkspace.body.workspaceId)
      .send({
        entity: 'goals',
        items: [{ id: 'goal_ws1', updatedAt: '2026-03-31T10:00:00.000Z', payload: { target: 1000 } }],
      });

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', secondWorkspace.body.workspaceId)
      .send({
        entity: 'goals',
        items: [{ id: 'goal_ws2', updatedAt: '2026-03-31T11:00:00.000Z', payload: { target: 2000 } }],
      });

    const firstPull = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', firstWorkspace.body.workspaceId);

    const secondPull = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', secondWorkspace.body.workspaceId);

    expect(firstPull.status).toBe(200);
    expect(secondPull.status).toBe(200);
    expect(firstPull.body.entities.goals).toHaveLength(1);
    expect(secondPull.body.entities.goals).toHaveLength(1);
    expect(firstPull.body.entities.goals[0].id).toBe('goal_ws1');
    expect(secondPull.body.entities.goals[0].id).toBe('goal_ws2');
    expect(firstPull.body.entities.goals[0].payload.workspace_id).toBe(firstWorkspace.body.workspaceId);
    expect(firstPull.body.entities.goals[0].payload.tenant_id).toBe(firstWorkspace.body.tenantId);
    expect(firstPull.body.entities.goals[0].payload.user_id).toBe(ownerUserId);
    expect(secondPull.body.entities.goals[0].payload.workspace_id).toBe(secondWorkspace.body.workspaceId);
    expect(secondPull.body.entities.goals[0].payload.tenant_id).toBe(secondWorkspace.body.tenantId);
    expect(secondPull.body.entities.goals[0].payload.user_id).toBe(ownerUserId);

    const logs = getAuditEvents({ action: 'goal.created', userId: ownerUserId });
    expect(logs.some((entry) => entry.workspaceId === firstWorkspace.body.workspaceId && entry.resourceId === 'goal_ws1')).toBe(true);
    expect(logs.some((entry) => entry.workspaceId === secondWorkspace.body.workspaceId && entry.resourceId === 'goal_ws2')).toBe(true);
  });

  it('isolates saas usage state by workspace for the same user', async () => {
    const ownerUserId = 'owner-usage-same-user';

    const firstWorkspace = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Usage Workspace One' });

    const secondWorkspace = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Usage Workspace Two' });

    const firstUpdate = await request(app)
      .put('/api/saas/usage')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', firstWorkspace.body.workspaceId)
      .send({
        usage: {
          '2026-04': {
            transactions: 5,
            aiQueries: 1,
            bankConnections: 0,
          },
        },
      });

    const secondUpdate = await request(app)
      .put('/api/saas/usage')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', secondWorkspace.body.workspaceId)
      .send({
        usage: {
          '2026-04': {
            transactions: 9,
            aiQueries: 3,
            bankConnections: 0,
          },
        },
      });

    expect(firstUpdate.status).toBe(200);
    expect(secondUpdate.status).toBe(200);

    const firstRead = await request(app)
      .get('/api/saas/usage')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', firstWorkspace.body.workspaceId);

    const secondRead = await request(app)
      .get('/api/saas/usage')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', secondWorkspace.body.workspaceId);

    expect(firstRead.status).toBe(200);
    expect(secondRead.status).toBe(200);
    expect(firstRead.body.usage['2026-04'].transactions).toBe(5);
    expect(secondRead.body.usage['2026-04'].transactions).toBe(9);
    expect(firstRead.body.workspaceId).toBe(firstWorkspace.body.workspaceId);
    expect(secondRead.body.workspaceId).toBe(secondWorkspace.body.workspaceId);
  }, 15000);
});






