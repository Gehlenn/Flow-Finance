import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';
import { resetCloudSyncStoreForTests } from '../../src/services/sync/cloudSyncStore';

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

let app: Express;

describe('sync conflict policy', () => {
  beforeAll(async () => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    ({ default: app } = await import('../../src/index'));
  });

  beforeEach(() => {
    resetWorkspaceStoreForTests();
    resetCloudSyncStoreForTests();
  });

  it('returns explicit conflict metadata and preserves the newer record', async () => {
    const ownerUserId = 'owner-sync-conflict';

    const workspace = await request(app)
      .post('/api/tenant')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .send({ name: 'Conflict Workspace' });

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspace.body.workspaceId)
      .send({
        entity: 'transactions',
        items: [{ id: 'tx-1', updatedAt: '2026-04-11T12:00:00.000Z', payload: { amount: 150, label: 'winner' } }],
      })
      .expect(200);

    const stalePush = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspace.body.workspaceId)
      .send({
        entity: 'transactions',
        items: [{ id: 'tx-1', updatedAt: '2026-04-11T11:00:00.000Z', payload: { amount: 20, label: 'stale' } }],
      });

    const pull = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', `Bearer mock-token-for-${ownerUserId}`)
      .set('x-workspace-id', workspace.body.workspaceId);

    expect(stalePush.status).toBe(200);
    expect(stalePush.body.conflictPolicy).toBe('client-updated-at-last-write-wins');
    expect(stalePush.body.conflicts).toHaveLength(1);
    expect(stalePush.body.conflicts[0].reason).toBe('stale_client_update');
    expect(pull.body.entities.transactions[0].payload.label).toBe('winner');
    expect(pull.body.entities.transactions[0].payload.amount).toBe(150);
  });
});

