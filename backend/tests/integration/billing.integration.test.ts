import request from 'supertest';
import app from '../../src/index';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';

describe('Billing API', () => {
  beforeEach(() => {
    resetWorkspaceStoreForTests();
  });

  it('POST /api/billing/subscription deve criar assinatura do workspace', async () => {
    const ownerUserId = 'owner-billing';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Workspace Billing' });

    const res = await request(app)
      .post('/api/billing/subscription')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId)
      .send({ plan: 'pro', billingEmail: 'billing@flow.test' });

    expect(res.status).toBe(201);
    expect(res.body.subscription.subscriptionId).toBeDefined();
    expect(res.body.plan).toBe('pro');
    expect(res.body.entitlements.features).toContain('billingManagement');
  });

  it('GET /api/billing/export deve exportar dados do workspace autenticado', async () => {
    const ownerUserId = 'owner-export';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Workspace Export' });

    const res = await request(app)
      .get('/api/billing/export')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain(created.body.workspaceId);
  });
});




