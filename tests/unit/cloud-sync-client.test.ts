import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncMocks = vi.hoisted(() => ({
  loadWorkspaceEntitiesMock: vi.fn(),
  replaceWorkspaceEntityCollectionMock: vi.fn().mockResolvedValue({
    success: true,
    upserted: 0,
    deleted: 0,
    latestServerUpdatedAt: '2026-05-08T00:00:00.000Z',
    reconciledIds: [],
  }),
  pullFromCloudMock: vi.fn(),
  pushToCloudMock: vi.fn(),
}));

vi.mock('../../src/services/firestoreWorkspaceStore', () => ({
  loadWorkspaceEntities: syncMocks.loadWorkspaceEntitiesMock,
  replaceWorkspaceEntityCollection: syncMocks.replaceWorkspaceEntityCollectionMock,
}));

vi.mock('../../src/services/localSyncService', () => ({
  pullFromCloud: syncMocks.pullFromCloudMock,
  pushToCloud: syncMocks.pushToCloudMock,
}));

import {
  pullSyncEntities,
  replaceSyncEntityCollection,
} from '../../src/services/sync/cloudSyncClient';

describe('cloudSyncClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty entities when workspace context is missing', async () => {
    const result = await pullSyncEntities({ workspaceId: '' }, '2026-05-01T00:00:00.000Z');

    expect(result.since).toBe('2026-05-01T00:00:00.000Z');
    expect(result.entities).toEqual({
      accounts: [],
      transactions: [],
      goals: [],
      reminders: [],
      receivables: [],
    });
    expect(syncMocks.loadWorkspaceEntitiesMock).not.toHaveBeenCalled();
  });

  it('throws when replacing sync entities without workspace context', async () => {
    await expect(replaceSyncEntityCollection(
      'accounts',
      [],
      [],
      { userId: 'user-1', tenantId: 'tenant-1', workspaceId: '' },
    )).rejects.toThrow(/workspaceId/i);
    expect(syncMocks.replaceWorkspaceEntityCollectionMock).not.toHaveBeenCalled();
  });

  it('delegates to the workspace store when workspace context exists', async () => {
    syncMocks.loadWorkspaceEntitiesMock.mockResolvedValueOnce({
      accounts: [],
      transactions: [],
      goals: [],
      reminders: [],
      receivables: [],
    });

    await pullSyncEntities({ workspaceId: 'ws-1' });

    expect(syncMocks.loadWorkspaceEntitiesMock).toHaveBeenCalledWith('ws-1');
  });

  it('uses backend pull when backend driver is requested', async () => {
    syncMocks.pullFromCloudMock.mockResolvedValueOnce({
      since: null,
      serverTime: '2026-05-09T00:00:00.000Z',
      entities: {
        accounts: [],
        transactions: [],
        goals: [],
        reminders: [],
        receivables: [],
        subscriptions: [],
      },
    });

    await pullSyncEntities({ workspaceId: 'ws-1' }, undefined, { driver: 'backend' });

    expect(syncMocks.pullFromCloudMock).toHaveBeenCalledWith(undefined);
    expect(syncMocks.loadWorkspaceEntitiesMock).not.toHaveBeenCalled();
  });

  it('propagates an unavailable backend pull instead of returning empty financial collections', async () => {
    syncMocks.pullFromCloudMock.mockRejectedValueOnce(new Error('backend unavailable'));

    await expect(
      pullSyncEntities({ workspaceId: 'ws-1' }, undefined, { driver: 'backend' }),
    ).rejects.toThrow('backend unavailable');
  });

  it('uses backend push when backend driver is requested', async () => {
    syncMocks.pushToCloudMock.mockResolvedValueOnce({
      success: true,
      upserted: 1,
      deleted: 0,
      latestServerUpdatedAt: '2026-05-09T00:00:00.000Z',
      reconciledIds: [],
    });

    await replaceSyncEntityCollection(
      'accounts',
      [{ id: 'acc-1', name: 'Banco' }],
      [],
      { userId: 'user-1', tenantId: 'tenant-1', workspaceId: 'ws-1' },
      { driver: 'backend' },
    );

    expect(syncMocks.pushToCloudMock).toHaveBeenCalledWith(
      'accounts',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'acc-1',
          payload: expect.objectContaining({ id: 'acc-1', name: 'Banco' }),
        }),
      ]),
    );
    expect(syncMocks.replaceWorkspaceEntityCollectionMock).not.toHaveBeenCalled();
  });

  it('propagates an unavailable backend push instead of fabricating a successful write', async () => {
    syncMocks.pushToCloudMock.mockRejectedValueOnce(new Error('backend unavailable'));

    await expect(replaceSyncEntityCollection(
      'accounts',
      [{ id: 'acc-1', name: 'Banco' }],
      [],
      { userId: 'user-1', tenantId: 'tenant-1', workspaceId: 'ws-1' },
      { driver: 'backend' },
    )).rejects.toThrow('backend unavailable');
  });
});
