import request from 'supertest';
import app from '../../src/index';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';

describe('Workspace authorization outside SaaS routes', () => {
  beforeEach(() => {
    resetWorkspaceStoreForTests();
  });

  it('POST /api/finance/metrics requires workspace context and succeeds with authorized workspace', async () => {
    const ownerUserId = 'owner-finance-authz';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Finance Workspace' });

    const missingWorkspace = await request(app)
      .post('/api/finance/metrics')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({
        transactions: [
          { amount: 1000, type: 'Receita', date: '2026-03-01T00:00:00.000Z' },
        ],
      });

    expect(missingWorkspace.status).toBe(400);

    const withWorkspace = await request(app)
      .post('/api/finance/metrics')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId)
      .send({
        transactions: [
          { amount: 1000, type: 'Receita', date: '2026-03-01T00:00:00.000Z' },
          { amount: 250, type: 'Despesa', category: 'Moradia', date: '2026-03-02T00:00:00.000Z' },
        ],
      });

    expect(withWorkspace.status).toBe(200);
    expect(withWorkspace.body.timeline).toBeDefined();
  });

  it('GET /api/sync/health requires workspace context', async () => {
    const ownerUserId = 'owner-sync-authz';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Sync Workspace' });

    const missingWorkspace = await request(app)
      .get('/api/sync/health')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`);

    expect(missingWorkspace.status).toBe(400);

    const withWorkspace = await request(app)
      .get('/api/sync/health')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', created.body.workspaceId);

    expect(withWorkspace.status).toBe(200);
  });
});




