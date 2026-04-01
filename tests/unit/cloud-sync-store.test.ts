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

  async getScopeState(scopeId: string) {
    return InMemoryFirebaseSyncAdapter.store.get(scopeId) || {};
  }

  async setScopeState(scopeId: string, entities: Partial<Record<SyncEntity, StoredSyncItem[]>>) {
    const current = InMemoryFirebaseSyncAdapter.store.get(scopeId) || {};
    InMemoryFirebaseSyncAdapter.store.set(scopeId, {
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

  it('pushes and pulls entity collections', async () => {
    const push = await pushSyncItems('workspace-1', 'transactions', [
      { id: 'tx-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { amount: 100 } },
    ]);

    expect(push.upserted).toBe(1);

    const pulled = await pullSyncItems('workspace-1');
    expect(pulled.entities.transactions).toHaveLength(1);
    expect(pulled.entities.transactions[0].id).toBe('tx-1');
    expect(pulled.entities.transactions[0].payload).toEqual({ amount: 100 });
    expect(pulled.entities.accounts).toHaveLength(0);
  });

  it('isolates data between scopes', async () => {
    await pushSyncItems('workspace-a', 'goals', [
      { id: 'g-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { target: 5000 } },
    ]);
    await pushSyncItems('workspace-b', 'goals', [
      { id: 'g-2', updatedAt: '2026-03-01T11:00:00.000Z', payload: { target: 9000 } },
    ]);

    const scopeA = await pullSyncItems('workspace-a');
    const scopeB = await pullSyncItems('workspace-b');

    expect(scopeA.entities.goals).toHaveLength(1);
    expect(scopeA.entities.goals[0].id).toBe('g-1');
    expect(scopeB.entities.goals).toHaveLength(1);
    expect(scopeB.entities.goals[0].id).toBe('g-2');
  });

  it('filters by since using serverUpdatedAt', async () => {
    await pushSyncItems('workspace-3', 'subscriptions', [
      { id: 's-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { name: 'A' } },
    ]);

    const firstPull = await pullSyncItems('workspace-3');
    const since = firstPull.serverTime;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await pushSyncItems('workspace-3', 'subscriptions', [
      { id: 's-2', updatedAt: '2026-03-01T11:00:00.000Z', payload: { name: 'B' } },
    ]);

    const delta = await pullSyncItems('workspace-3', since);
    expect(delta.entities.subscriptions).toHaveLength(1);
    expect(delta.entities.subscriptions[0].id).toBe('s-2');
  });

  it('preserves deletion markers', async () => {
    await pushSyncItems('workspace-4', 'accounts', [
      { id: 'acc-1', updatedAt: '2026-03-01T10:00:00.000Z', payload: { bank: 'A' } },
      { id: 'acc-1', updatedAt: '2026-03-01T11:00:00.000Z', deleted: true },
    ]);

    const pulled = await pullSyncItems('workspace-4');
    expect(pulled.entities.accounts).toHaveLength(1);
    expect(pulled.entities.accounts[0].id).toBe('acc-1');
    expect(pulled.entities.accounts[0].deleted).toBe(true);
  });

  it('persists between instances when using firebase driver', async () => {
    const firstStore = createCloudSyncStore({
      driver: 'firebase',
      firebaseAdapter: new InMemoryFirebaseSyncAdapter(),
    });

    await firstStore.pushItems('workspace-5', 'transactions', [
      { id: 'tx-100', updatedAt: '2026-03-01T10:00:00.000Z', payload: { amount: 500 } },
    ]);

    const secondStore = createCloudSyncStore({
      driver: 'firebase',
      firebaseAdapter: new InMemoryFirebaseSyncAdapter(),
    });

    const pulled = await secondStore.pullItems('workspace-5');
    expect(pulled.entities.transactions).toHaveLength(1);
    expect(pulled.entities.transactions[0].id).toBe('tx-100');
  });
});
