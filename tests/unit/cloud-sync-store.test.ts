import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCloudSyncStore,
  pullSyncItems,
  pushSyncItems,
  resetCloudSyncStoreForTests,
  type FirebaseCloudSyncStoreAdapter,
  type StoredSyncItem,
} from '../../backend/src/services/sync/cloudSyncStore';
import type { SyncEntity } from '../../backend/src/validation/sync.schema';

class InMemoryFirebaseSyncAdapter implements FirebaseCloudSyncStoreAdapter {
  private static readonly store = new Map<string, Partial<Record<SyncEntity, StoredSyncItem[]>>>();

  static reset(): void {
    InMemoryFirebaseSyncAdapter.store.clear();
  }

  async getStatus() {
    return {
      configured: true,
      ready: true,
    };
  }

  async getUserState(userId: string) {
    return InMemoryFirebaseSyncAdapter.store.get(userId) || {};
  }

  async setUserState(userId: string, entities: Partial<Record<SyncEntity, StoredSyncItem[]>>) {
    const current = InMemoryFirebaseSyncAdapter.store.get(userId) || {};
    InMemoryFirebaseSyncAdapter.store.set(userId, {
      ...current,
      ...entities,
    });
  }
}

describe('cloudSyncStore', () => {
  beforeEach(() => {
    resetCloudSyncStoreForTests();
    InMemoryFirebaseSyncAdapter.reset();
  });

  it('faz push e pull por entidade', async () => {
    const push = await pushSyncItems('u1', 'transactions', [
      { id: 'tx-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { amount: 100 } },
    ]);

    expect(push.upserted).toBe(1);

    const pulled = await pullSyncItems('u1');
    expect(pulled.entities.transactions).toHaveLength(1);
    expect(pulled.entities.transactions[0].id).toBe('tx-1');
    expect(pulled.entities.transactions[0].payload).toEqual({ amount: 100 });
    expect(pulled.entities.accounts).toHaveLength(0);
  });

  it('mantém isolamento multi-tenant no pull', async () => {
    await pushSyncItems('u1', 'goals', [{ id: 'g-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { target: 5000 } }]);
    await pushSyncItems('u2', 'goals', [{ id: 'g-2', updatedAt: '2026-03-01T11:00:00.000Z', payload: { target: 9000 } }]);

    const user1 = await pullSyncItems('u1');
    const user2 = await pullSyncItems('u2');

    expect(user1.entities.goals).toHaveLength(1);
    expect(user1.entities.goals[0].id).toBe('g-1');
    expect(user2.entities.goals).toHaveLength(1);
    expect(user2.entities.goals[0].id).toBe('g-2');
  });

  it('filtra por since usando serverUpdatedAt', async () => {
    await pushSyncItems('u3', 'subscriptions', [{ id: 's-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { name: 'A' } }]);

    const firstPull = await pullSyncItems('u3');
    const since = firstPull.serverTime;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await pushSyncItems('u3', 'subscriptions', [{ id: 's-2', updatedAt: '2026-03-01T11:00:00.000Z', payload: { name: 'B' } }]);

    const delta = await pullSyncItems('u3', since);
    expect(delta.entities.subscriptions).toHaveLength(1);
    expect(delta.entities.subscriptions[0].id).toBe('s-2');
  });

  it('preserva marcadores de deleção', async () => {
    await pushSyncItems('u4', 'accounts', [
      { id: 'acc-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { bank: 'A' } },
      { id: 'acc-1', updatedAt: '2026-03-01T11:00:00.000Z', deleted: true },
    ]);

    const pulled = await pullSyncItems('u4');
    expect(pulled.entities.accounts).toHaveLength(1);
    expect(pulled.entities.accounts[0].id).toBe('acc-1');
    expect(pulled.entities.accounts[0].deleted).toBe(true);
  });

  it('persiste entre instancias quando usa driver firebase', async () => {
    const firstStore = createCloudSyncStore({
      driver: 'firebase',
      firebaseAdapter: new InMemoryFirebaseSyncAdapter(),
    });

    await firstStore.pushItems('u5', 'transactions', [
      { id: 'tx-100', updatedAt: '2026-03-01T10:00:00.000Z', payload: { amount: 500 } },
    ]);

    const secondStore = createCloudSyncStore({
      driver: 'firebase',
      firebaseAdapter: new InMemoryFirebaseSyncAdapter(),
    });

    const pulled = await secondStore.pullItems('u5');
    expect(pulled.entities.transactions).toHaveLength(1);
    expect(pulled.entities.transactions[0].id).toBe('tx-100');
  });
});
