import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, vi } from 'vitest';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';
import { resetSaasStoreForTests } from '../../src/utils/saasStore';

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

describe('Admin API', () => {
  beforeAll(async () => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.OPEN_FINANCE_PROVIDER = 'mock';
    process.env.OPEN_FINANCE_STORE_DRIVER = 'memory';
    ({ default: app } = await import('../../src/index'));
  });

  beforeEach(() => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.OPEN_FINANCE_PROVIDER = 'mock';
    process.env.OPEN_FINANCE_STORE_DRIVER = 'memory';
    resetWorkspaceStoreForTests();
    resetSaasStoreForTests();
  });

  async function createProWorkspace(ownerUserId: string) {
    const created = await request(app)
      .post('/api/tenant')
      .send({ name: 'Workspace Admin', ownerUserId });

    await request(app)
      .post('/api/billing/subscription')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId)
      .send({ plan: 'pro' });

    return created.body.workspaceId as string;
  }

  it('GET /api/admin/users deve listar usuários do workspace', async () => {
    const ownerUserId = 'owner-admin-users';
    const workspaceId = await createProWorkspace(ownerUserId);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].userId).toBe(ownerUserId);
  });

  it('GET /api/admin/audit-logs deve listar logs do workspace', async () => {
    const ownerUserId = 'owner-admin-audit';
    const workspaceId = await createProWorkspace(ownerUserId);

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((entry: { resource?: string }) => entry.resource === workspaceId)).toBe(true);
    const auditEntry = res.body.items.find((entry: { workspaceId?: string; tenantId?: string }) => entry.workspaceId === workspaceId);
    expect(auditEntry?.tenantId).toBeTruthy();
  });

  it('GET /api/admin/usage-metering deve retornar sumario e eventos filtraveis por periodo', async () => {
    const ownerUserId = 'owner-admin-metering';
    const workspaceId = await createProWorkspace(ownerUserId);

    const res = await request(app)
      .get('/api/admin/usage-metering?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe(workspaceId);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totals).toBeDefined();
    expect(res.body.summary.totals.bankConnections).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(typeof res.body.nextCursor === 'string' || res.body.nextCursor === null).toBe(true);
  }, 30000);

  it('GET /api/admin/audit-logs/export e /api/admin/usage-metering/export devem suportar export CSV', async () => {
    const ownerUserId = 'owner-admin-export';
    const workspaceId = await createProWorkspace(ownerUserId);

    const auditExport = await request(app)
      .get('/api/admin/audit-logs/export?format=csv')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId);

    const usageExport = await request(app)
      .get('/api/admin/usage-metering/export?format=csv')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId);

    expect(auditExport.status).toBe(200);
    expect(auditExport.headers['content-type']).toContain('text/csv');
    expect(auditExport.text).toContain('id,at,tenantId,workspaceId,userId,action,status,resourceType,resourceId,resource,metadata');

    expect(usageExport.status).toBe(200);
    expect(usageExport.headers['content-type']).toContain('text/csv');
    if (usageExport.text.length > 0) {
      expect(usageExport.text).toContain('id,at,userId,resource,amount,metadata');
    }
  }, 30000);

  it('GET /api/admin/audit-logs deve expor cursor para paginacao', async () => {
    const ownerUserId = 'owner-admin-cursor';
    const workspaceId = await createProWorkspace(ownerUserId);

    const firstPage = await request(app)
      .get('/api/admin/audit-logs?limit=1')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId);

    expect(firstPage.status).toBe(200);
    expect(Array.isArray(firstPage.body.items)).toBe(true);
    expect(firstPage.body.items.length).toBe(1);
    expect(typeof firstPage.body.nextCursor === 'string').toBe(true);

    const secondPage = await request(app)
      .get(`/api/admin/audit-logs?limit=10&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId);

    expect(secondPage.status).toBe(200);
    expect(Array.isArray(secondPage.body.items)).toBe(true);
  });

  it('viewer nao pode gerenciar membros do workspace', async () => {
    const ownerUserId = 'owner-admin-viewer';
    const viewerUserId = 'viewer-admin-viewer';
    const workspaceId = await createProWorkspace(ownerUserId);

    await request(app)
      .post(`/api/workspace/${workspaceId}/users`)
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: viewerUserId, role: 'viewer' });

    const res = await request(app)
      .post(`/api/workspace/${workspaceId}/users`)
      .set('Authorization', `Bearer mock-token-for-${viewerUserId}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: 'another-user', role: 'member' });

    expect(res.status).toBe(403);
  });
});
