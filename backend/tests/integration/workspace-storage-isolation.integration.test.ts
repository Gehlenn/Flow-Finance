import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, vi } from 'vitest';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';
import { resetCloudSyncStoreForTests } from '../../src/services/sync/cloudSyncStore';
import { getAuditEvents, resetAuditLogForTests } from '../../src/services/admin/auditLog';

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
    ({ default: app } = await import('../../src/index'));
  });

  beforeEach(() => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.OPEN_FINANCE_PROVIDER = 'mock';
    process.env.OPEN_FINANCE_STORE_DRIVER = 'memory';
    resetWorkspaceStoreForTests();
    resetCloudSyncStoreForTests();
    resetAuditLogForTests();
  });

  it('isolates sync state by workspace for the same user', async () => {
    const ownerUserId = 'owner-sync-same-user';

    const firstWorkspace = await request(app)
      .post('/api/tenant')
      .send({ name: 'Workspace One', ownerUserId });

    const secondWorkspace = await request(app)
      .post('/api/tenant')
      .send({ name: 'Workspace Two', ownerUserId });

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', firstWorkspace.body.workspaceId)
      .send({
        entity: 'goals',
        items: [{ id: 'goal_ws1', updatedAt: '2026-03-31T10:00:00.000Z', payload: { target: 1000 } }],
      });

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', secondWorkspace.body.workspaceId)
      .send({
        entity: 'goals',
        items: [{ id: 'goal_ws2', updatedAt: '2026-03-31T11:00:00.000Z', payload: { target: 2000 } }],
      });

    const firstPull = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', firstWorkspace.body.workspaceId);

    const secondPull = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
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

  it('isolates banking connections by workspace for the same user', async () => {
    const ownerUserId = 'owner-banking-same-user';

    const firstWorkspace = await request(app)
      .post('/api/tenant')
      .send({ name: 'Bank Workspace One', ownerUserId });

    const secondWorkspace = await request(app)
      .post('/api/tenant')
      .send({ name: 'Bank Workspace Two', ownerUserId });

    await request(app)
      .post('/api/banking/connect')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', firstWorkspace.body.workspaceId)
      .send({
        bankId: 'nubank',
      });

    const firstList = await request(app)
      .get('/api/banking/connections')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', firstWorkspace.body.workspaceId);

    const secondList = await request(app)
      .get('/api/banking/connections')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', secondWorkspace.body.workspaceId);

    expect(firstList.status).toBe(200);
    expect(secondList.status).toBe(200);
    expect(firstList.body).toHaveLength(1);
    expect(secondList.body).toHaveLength(0);
  }, 15000);
});
