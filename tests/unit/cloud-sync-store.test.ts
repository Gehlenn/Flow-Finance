import { beforeEach, describe, expect, it } from 'vitest';
import {
  pullSyncItems,
  pushSyncItems,
  resetCloudSyncStoreForTests,
} from '../../backend/src/services/sync/cloudSyncStore';

describe('cloudSyncStore', () => {
  beforeEach(() => {
    resetCloudSyncStoreForTests();
  });

  it('faz push e pull por entidade', () => {
    const push = pushSyncItems('u1', 'transactions', [
      { id: 'tx-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { amount: 100 } },
    ]);

    expect(push.upserted).toBe(1);

    const pulled = pullSyncItems('u1');
    expect(pulled.entities.transactions).toHaveLength(1);
    expect(pulled.entities.transactions[0].id).toBe('tx-1');
    expect(pulled.entities.transactions[0].payload).toEqual({ amount: 100 });
    expect(pulled.entities.accounts).toHaveLength(0);
  });

  it('mantém isolamento multi-tenant no pull', () => {
    pushSyncItems('u1', 'goals', [{ id: 'g-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { target: 5000 } }]);
    pushSyncItems('u2', 'goals', [{ id: 'g-2', updatedAt: '2026-03-01T11:00:00.000Z', payload: { target: 9000 } }]);

    const user1 = pullSyncItems('u1');
    const user2 = pullSyncItems('u2');

    expect(user1.entities.goals).toHaveLength(1);
    expect(user1.entities.goals[0].id).toBe('g-1');
    expect(user2.entities.goals).toHaveLength(1);
    expect(user2.entities.goals[0].id).toBe('g-2');
  });

  it('filtra por since usando serverUpdatedAt', async () => {
    pushSyncItems('u3', 'subscriptions', [{ id: 's-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { name: 'A' } }]);

    const firstPull = pullSyncItems('u3');
    const since = firstPull.serverTime;

    await new Promise((resolve) => setTimeout(resolve, 5));
    pushSyncItems('u3', 'subscriptions', [{ id: 's-2', updatedAt: '2026-03-01T11:00:00.000Z', payload: { name: 'B' } }]);

    const delta = pullSyncItems('u3', since);
    expect(delta.entities.subscriptions).toHaveLength(1);
    expect(delta.entities.subscriptions[0].id).toBe('s-2');
  });

  it('preserva marcadores de deleção', () => {
    pushSyncItems('u4', 'accounts', [
      { id: 'acc-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { bank: 'A' } },
      { id: 'acc-1', updatedAt: '2026-03-01T11:00:00.000Z', deleted: true },
    ]);

    const pulled = pullSyncItems('u4');
    expect(pulled.entities.accounts).toHaveLength(1);
    expect(pulled.entities.accounts[0].id).toBe('acc-1');
    expect(pulled.entities.accounts[0].deleted).toBe(true);
  });
});
