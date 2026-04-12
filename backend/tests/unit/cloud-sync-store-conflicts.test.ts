import { describe, expect, it } from 'vitest';

import { pullSyncItems, pushSyncItems, resetCloudSyncStoreForTests } from '../../src/services/sync/cloudSyncStore';

describe('cloud sync conflict policy', () => {
  it('preserves existing item when an older client update arrives later', async () => {
    resetCloudSyncStoreForTests();

    await pushSyncItems('ws-1', 'transactions', [
      {
        id: 'tx-1',
        updatedAt: '2026-04-11T10:00:00.000Z',
        payload: { description: 'newer', amount: 150 },
      },
    ]);

    const result = await pushSyncItems('ws-1', 'transactions', [
      {
        id: 'tx-1',
        updatedAt: '2026-04-11T09:00:00.000Z',
        payload: { description: 'older', amount: 90 },
      },
    ]);

    const pull = await pullSyncItems('ws-1');
    expect(result.conflictPolicy).toBe('client-updated-at-last-write-wins');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toBe('stale_client_update');
    expect(pull.entities.transactions[0].payload?.description).toBe('newer');
    expect(pull.entities.transactions[0].payload?.amount).toBe(150);
  });

  it('preserves existing item on same timestamp with divergent payload', async () => {
    resetCloudSyncStoreForTests();

    await pushSyncItems('ws-1', 'goals', [
      {
        id: 'goal-1',
        updatedAt: '2026-04-11T10:00:00.000Z',
        payload: { target: 1000, label: 'original' },
      },
    ]);

    const result = await pushSyncItems('ws-1', 'goals', [
      {
        id: 'goal-1',
        updatedAt: '2026-04-11T10:00:00.000Z',
        payload: { target: 2000, label: 'divergent' },
      },
    ]);

    const pull = await pullSyncItems('ws-1');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toBe('same_timestamp_divergent_payload');
    expect(pull.entities.goals[0].payload?.target).toBe(1000);
    expect(pull.entities.goals[0].payload?.label).toBe('original');
  });
});
