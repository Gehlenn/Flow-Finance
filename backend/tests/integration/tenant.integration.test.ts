import request from 'supertest';
import app from '../../src/index';
import { getLastWorkspaceForUser, resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';

describe('Tenant API', () => {
  beforeEach(() => {
    resetWorkspaceStoreForTests();
  });

  it('POST /api/tenant exige autenticacao', async () => {
    const res = await request(app)
      .post('/api/tenant')
      .send({ name: 'Empresa Teste' });

    expect(res.status).toBe(401);
  });

  it('POST /api/tenant deve criar tenant autenticado', async () => {
    const ownerUserId = 'owner-1';
    const res = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Empresa Teste' });

    expect(res.status).toBe(201);
    expect(res.body.workspaceId).toBeDefined();
  });

  it('POST /api/tenant/select deve selecionar tenant autenticado', async () => {
    const ownerUserId = 'owner-1';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Empresa Teste' });

    const res = await request(app)
      .post('/api/tenant/select')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ tenantId: created.body.workspaceId });

    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe(created.body.workspaceId);
    expect(getLastWorkspaceForUser(ownerUserId)?.workspaceId).toBe(created.body.workspaceId);
  });
});
