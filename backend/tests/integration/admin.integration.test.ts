import request from 'supertest';
import app from '../../src/index';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';
import { resetSaasStoreForTests } from '../../src/utils/saasStore';

describe('Admin API', () => {
  beforeEach(() => {
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
  });

  it('GET /api/admin/usage-metering deve retornar sumario e eventos filtraveis por periodo', async () => {
    const ownerUserId = 'owner-admin-metering';
    const workspaceId = await createProWorkspace(ownerUserId);

    await request(app)
      .post('/api/banking/connect')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId)
      .send({
        bankId: 'bank_metering',
        itemId: 'item_metering',
        connectorId: 1,
      });

    const res = await request(app)
      .get('/api/admin/usage-metering?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe(workspaceId);
    expect(res.body.summary.totals.bankConnections).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(typeof res.body.nextCursor === 'string' || res.body.nextCursor === null).toBe(true);
  });

  it('GET /api/admin/audit-logs/export e /api/admin/usage-metering/export devem suportar export CSV', async () => {
    const ownerUserId = 'owner-admin-export';
    const workspaceId = await createProWorkspace(ownerUserId);

    await request(app)
      .post('/api/banking/connect')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspaceId)
      .send({
        bankId: 'bank_export',
        itemId: 'item_export',
        connectorId: 1,
      });

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
    expect(auditExport.text).toContain('id,at,userId,action,status,resource,metadata');

    expect(usageExport.status).toBe(200);
    expect(usageExport.headers['content-type']).toContain('text/csv');
    expect(usageExport.text).toContain('id,at,userId,resource,amount,metadata');
  });

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
});
