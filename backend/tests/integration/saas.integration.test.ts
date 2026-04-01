import request from 'supertest';
import app from '../../src/index';
import { resetSaasStoreForTests } from '../../src/utils/saasStore';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';

describe('SaaS API workspace scope', () => {
  beforeEach(() => {
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

    await request(app)
      .post('/api/banking/connect')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId)
      .send({
        bankId: 'bank_metering',
        itemId: 'item_metering',
        connectorId: 1,
      });

    const res = await request(app)
      .get('/api/saas/metering?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('workspace');
    expect(res.body.workspaceId).toBe(created.body.workspaceId);
    expect(res.body.summary.totals.bankConnections).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});
