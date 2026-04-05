import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, vi } from 'vitest';
import { resetSaasStoreForTests } from '../../src/utils/saasStore';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';

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

describe('SaaS API workspace scope', () => {
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
    resetSaasStoreForTests();
    resetWorkspaceStoreForTests();
  });

  it('GET /api/saas/plans returns workspace-scoped catalog when workspace context is provided', async () => {
    const ownerUserId = 'owner-saas-plans';
    const created = await request(app)
      .post('/api/tenant')
      .send({ name: 'Workspace Plans', ownerUserId });

    const res = await request(app)
      .get('/api/saas/plans')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('workspace');
    expect(res.body.workspaceId).toBe(created.body.workspaceId);
    expect(res.body.currentPlan).toBe('free');
  });

  it('POST /api/saas/plan upgrades the workspace plan and PUT /api/saas/usage persists workspace usage', async () => {
    const ownerUserId = 'owner-saas-upgrade';
    const created = await request(app)
      .post('/api/tenant')
      .send({ name: 'Workspace Upgrade', ownerUserId });

    const upgrade = await request(app)
      .post('/api/saas/plan')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId)
      .send({ plan: 'pro' });

    expect(upgrade.status).toBe(200);
    expect(upgrade.body.scope).toBe('workspace');
    expect(upgrade.body.currentPlan).toBe('pro');

    const usageUpdate = await request(app)
      .put('/api/saas/usage')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId)
      .send({
        usage: {
          '2026-03': {
            transactions: 12,
            aiQueries: 8,
            bankConnections: 2,
          },
        },
      });

    expect(usageUpdate.status).toBe(200);
    expect(usageUpdate.body.scope).toBe('workspace');

    const usageRead = await request(app)
      .get('/api/saas/usage')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId);

    expect(usageRead.status).toBe(200);
    expect(usageRead.body.scope).toBe('workspace');
    expect(usageRead.body.usage['2026-03']).toEqual({
      transactions: 12,
      aiQueries: 8,
      bankConnections: 2,
    });
  });

  it('GET /api/saas/metering returns workspace-scoped usage summary and events', async () => {
    const ownerUserId = 'owner-saas-metering';
    const created = await request(app)
      .post('/api/tenant')
      .send({ name: 'Workspace Metering', ownerUserId });

    const res = await request(app)
      .get('/api/saas/metering?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('workspace');
    expect(res.body.workspaceId).toBe(created.body.workspaceId);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totals).toBeDefined();
    expect(res.body.summary.totals.bankConnections).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.events)).toBe(true);
  }, 15000);
});
