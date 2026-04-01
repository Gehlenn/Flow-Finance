import request from 'supertest';
import app from '../../src/index';
import { getLastWorkspaceForUser, resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';

describe('Tenant API', () => {
  beforeEach(() => {
    resetWorkspaceStoreForTests();
  });

  it('POST /api/tenant deve criar tenant', async () => {
    const res = await request(app).post('/api/tenant').send({ name: 'Empresa Teste', ownerUserId: 'owner-1' });
    expect(res.status).toBe(201);
    expect(res.body.workspaceId).toBeDefined();
  });

  it('POST /api/tenant/select deve selecionar tenant', async () => {
    const created = await request(app).post('/api/tenant').send({ name: 'Empresa Teste', ownerUserId: 'owner-1' });
    const res = await request(app).post('/api/tenant/select').send({ tenantId: created.body.workspaceId, userId: 'owner-1' });
    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe(created.body.workspaceId);
    expect(getLastWorkspaceForUser('owner-1')?.workspaceId).toBe(created.body.workspaceId);
  });
});
