import request from 'supertest';
import app from '../../src/index';
import { createTestAuthorizationHeader } from '../helpers/auth';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';

describe('Billing API', () => {
  beforeEach(() => {
    resetWorkspaceStoreForTests();
  });

  it('POST /api/billing/subscription permite assinatura mock no ambiente de teste', async () => {
    const ownerUserId = 'owner-billing';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Workspace Billing' });

    const res = await request(app)
      .post('/api/billing/subscription')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId)
      .send({ plan: 'pro', billingEmail: 'billing@flow.test' });

    expect(res.status).toBe(201);
    expect(res.body.subscription.subscriptionId).toBeDefined();
    expect(res.body.plan).toBe('pro');
    expect(res.body.entitlements.features).toContain('billingManagement');
  });

  it('POST /api/billing/subscription rejeita alteracao manual fora de mock/test', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAllowMockBillingUpdates = process.env.ALLOW_MOCK_BILLING_UPDATES;

    try {
      const ownerUserId = 'owner-billing-production';
      const created = await request(app)
        .post('/api/tenant')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .send({ name: 'Workspace Billing Production' });

      process.env.NODE_ENV = 'production';
      process.env.ALLOW_MOCK_BILLING_UPDATES = 'true';

      const res = await request(app)
        .post('/api/billing/subscription')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .set('x-workspace-id', created.body.workspaceId)
        .send({ plan: 'pro' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Mock billing updates are disabled in this environment');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousAllowMockBillingUpdates === undefined) {
        delete process.env.ALLOW_MOCK_BILLING_UPDATES;
      } else {
        process.env.ALLOW_MOCK_BILLING_UPDATES = previousAllowMockBillingUpdates;
      }
    }
  });

  it('GET /api/billing/export deve declarar indisponivel enquanto exportacao real nao existe', async () => {
    const ownerUserId = 'owner-export';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Workspace Export' });

    const res = await request(app)
      .get('/api/billing/export')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId);

    expect(res.status).toBe(501);
    expect(res.body.message).toContain('not yet implemented');
  });
});




