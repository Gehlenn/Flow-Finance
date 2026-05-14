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
}));

vi.mock('../../src/services/firestoreWorkspaceStore', () => ({
  loadWorkspaceEntities: syncMocks.loadWorkspaceEntitiesMock,
  replaceWorkspaceEntityCollection: syncMocks.replaceWorkspaceEntityCollectionMock,
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
    });

    await pullSyncEntities({ workspaceId: 'ws-1' });

    expect(syncMocks.loadWorkspaceEntitiesMock).toHaveBeenCalledWith('ws-1');
  });
});
