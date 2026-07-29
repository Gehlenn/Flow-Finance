import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, vi } from 'vitest';
import { createTestAuthorizationHeader } from '../helpers/auth';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';
import { resetCloudSyncStoreForTests } from '../../src/services/sync/cloudSyncStore';
import { getAuditEvents, resetAuditLogForTests } from '../../src/services/admin/auditLog';
import { setWorkspaceUsage } from '../../src/utils/saasStore';

vi.mock('../../src/config/database', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  testConnection: vi.fn().mockResolvedValue(false),
  hasDatabaseConfig: vi.fn().mockReturnValue(false),
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
  }, 30000);

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

  it('fails closed on POST /api/workspace in production without a durable backend', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const ownerUserId = 'owner-workspace-production';

      const res = await request(app)
        .post('/api/workspace')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .send({ name: 'Workspace Production' });

      expect(res.status).toBe(503);
      expect(res.body.message).toBe('Persistencia duravel de workspace indisponivel');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('isolates sync state by workspace for the same user', async () => {
    const ownerUserId = 'owner-sync-same-user';

    const firstWorkspace = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Workspace One' });

    const secondWorkspace = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Workspace Two' });

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', firstWorkspace.body.workspaceId)
      .send({
        entity: 'goals',
        items: [{ id: 'goal_ws1', updatedAt: '2026-03-31T10:00:00.000Z', payload: { target: 1000 } }],
      });

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', secondWorkspace.body.workspaceId)
      .send({
        entity: 'goals',
        items: [{ id: 'goal_ws2', updatedAt: '2026-03-31T11:00:00.000Z', payload: { target: 2000 } }],
      });

    const firstPull = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', firstWorkspace.body.workspaceId);

    const secondPull = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
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
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Usage Workspace One' });

    const secondWorkspace = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Usage Workspace Two' });

    await setWorkspaceUsage(firstWorkspace.body.workspaceId, {
      '2026-04': { transactions: 5, aiQueries: 1, bankConnections: 0 },
    });
    await setWorkspaceUsage(secondWorkspace.body.workspaceId, {
      '2026-04': { transactions: 9, aiQueries: 3, bankConnections: 0 },
    });

    const firstRead = await request(app)
      .get('/api/saas/usage')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', firstWorkspace.body.workspaceId);

    const secondRead = await request(app)
      .get('/api/saas/usage')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', secondWorkspace.body.workspaceId);

    expect(firstRead.status).toBe(200);
    expect(secondRead.status).toBe(200);
    expect(firstRead.body.usage['2026-04'].transactions).toBe(5);
    expect(secondRead.body.usage['2026-04'].transactions).toBe(9);
    expect(firstRead.body.workspaceId).toBe(firstWorkspace.body.workspaceId);
    expect(secondRead.body.workspaceId).toBe(secondWorkspace.body.workspaceId);
  }, 15000);

  it('keeps sync and usage isolated under artificial multi-workspace load', async () => {
    const ownerUserId = 'owner-artificial-load';
    const workspaceCount = 8;
    const workspaces: Array<{ workspaceId: string; tenantId: string }> = [];

    for (let index = 0; index < workspaceCount; index++) {
      const response = await request(app)
        .post('/api/tenant')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .send({ name: `Load Workspace ${index + 1}` });

      expect(response.status).toBe(201);
      workspaces.push({
        workspaceId: response.body.workspaceId,
        tenantId: response.body.tenantId,
      });
    }

    for (const [index, workspace] of workspaces.entries()) {
      const goalId = `goal_load_${index + 1}`;

      const syncResponse = await request(app)
        .post('/api/sync/push')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .set('x-workspace-id', workspace.workspaceId)
        .send({
          entity: 'goals',
          items: [{
            id: goalId,
            updatedAt: `2026-04-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
            payload: { target: (index + 1) * 1000 },
          }],
        });

      await setWorkspaceUsage(workspace.workspaceId, {
        '2026-04': {
          transactions: index + 1,
          aiQueries: (index + 1) * 2,
          bankConnections: 0,
        },
      });

      expect(syncResponse.status).toBe(200);
    }

    for (const [index, workspace] of workspaces.entries()) {
      const pullResponse = await request(app)
        .get('/api/sync/pull')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .set('x-workspace-id', workspace.workspaceId);

      const usageRead = await request(app)
        .get('/api/saas/usage')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .set('x-workspace-id', workspace.workspaceId);

      expect(pullResponse.status).toBe(200);
      expect(usageRead.status).toBe(200);
      expect(pullResponse.body.entities.goals).toHaveLength(1);
      expect(pullResponse.body.entities.goals[0].id).toBe(`goal_load_${index + 1}`);
      expect(pullResponse.body.entities.goals[0].payload.workspace_id).toBe(workspace.workspaceId);
      expect(pullResponse.body.entities.goals[0].payload.tenant_id).toBe(workspace.tenantId);
      expect(usageRead.body.workspaceId).toBe(workspace.workspaceId);
      expect(usageRead.body.usage['2026-04'].transactions).toBe(index + 1);
      expect(usageRead.body.usage['2026-04'].aiQueries).toBe((index + 1) * 2);
    }

    const goalLogs = getAuditEvents({ action: 'goal.created', userId: ownerUserId });
    expect(new Set(goalLogs.map((entry) => entry.workspaceId)).size).toBe(workspaceCount);
  }, 30000);
});






