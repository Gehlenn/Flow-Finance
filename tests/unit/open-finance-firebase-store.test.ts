// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBankingConnectionStore,
  migrateConnectionsBetweenStores,
  type FirebaseBankingConnectionStoreAdapter,
  type StoredBankConnection,
} from '../../backend/src/services/openFinance/bankingConnectionStore';

class InMemoryFirebaseAdapter implements FirebaseBankingConnectionStoreAdapter {
  private static readonly store = new Map<string, StoredBankConnection[]>();

  static reset(): void {
    InMemoryFirebaseAdapter.store.clear();
  }

  async getStatus() {
    return {
      configured: true,
      ready: true,
    };
  }

  async getConnectionsForUser(userId: string): Promise<StoredBankConnection[]> {
    return InMemoryFirebaseAdapter.store.get(userId) || [];
  }

  async setConnectionsForUser(userId: string, connections: StoredBankConnection[]): Promise<void> {
    InMemoryFirebaseAdapter.store.set(userId, connections);
  }

  async listUsersWithConnections(): Promise<string[]> {
    return [...InMemoryFirebaseAdapter.store.keys()].filter((userId) => {
      return (InMemoryFirebaseAdapter.store.get(userId) || []).length > 0;
    });
  }

  async getAllUserConnections(): Promise<Array<{ userId: string; connections: StoredBankConnection[] }>> {
    return [...InMemoryFirebaseAdapter.store.entries()].map(([userId, connections]) => ({
      userId,
      connections,
    }));
  }
}

function buildConnection(overrides: Partial<StoredBankConnection> = {}): StoredBankConnection {
  return {
    id: 'conn-1',
    user_id: 'user-1',
    bank_name: 'Nubank',
    provider: 'pluggy',
    connection_status: 'connected',
    external_account_id: 'item-1',
    created_at: '2026-03-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('Open Finance Firebase store', () => {
  beforeEach(() => {
    InMemoryFirebaseAdapter.reset();
    vi.unstubAllEnvs();
  });

  it('persiste conexoes entre instancias (simulando restart)', async () => {
    const firstInstance = createBankingConnectionStore({
      driver: 'firebase',
      firebaseAdapter: new InMemoryFirebaseAdapter(),
    });

    await firstInstance.setConnectionsForUser('restart-user', [buildConnection({ id: 'conn-r1', user_id: 'restart-user' })]);

    const secondInstance = createBankingConnectionStore({
      driver: 'firebase',
      firebaseAdapter: new InMemoryFirebaseAdapter(),
    });

    const persisted = await secondInstance.getConnectionsForUser('restart-user');
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.id).toBe('conn-r1');
  });

  it('migra conexoes do driver em memoria para Firebase por usuario', async () => {
    const sourceStore = createBankingConnectionStore({ driver: 'memory' });
    await sourceStore.setConnectionsForUser('migrate-user', [
      buildConnection({ id: 'conn-m1', user_id: 'migrate-user', external_account_id: 'item-m1' }),
      buildConnection({ id: 'conn-m2', user_id: 'migrate-user', external_account_id: 'item-m2' }),
    ]);

    const targetStore = createBankingConnectionStore({
      driver: 'firebase',
      firebaseAdapter: new InMemoryFirebaseAdapter(),
    });

    const result = await migrateConnectionsBetweenStores(sourceStore, targetStore, ['migrate-user']);

    expect(result).toEqual({ migratedUsers: 1, migratedConnections: 2 });
    expect(await targetStore.countUsersWithConnections()).toBe(1);

    const migrated = await targetStore.getConnectionsForUser('migrate-user');
    expect(migrated).toHaveLength(2);
    expect(migrated.map((item) => item.id)).toEqual(['conn-m1', 'conn-m2']);
  });

  it('seleciona Firebase quando OPEN_FINANCE_STORE_DRIVER=firebase', async () => {
    vi.stubEnv('OPEN_FINANCE_STORE_DRIVER', 'firebase');

    const store = createBankingConnectionStore({
      firebaseAdapter: new InMemoryFirebaseAdapter(),
    });

    const status = await store.getStatus();
    expect(status.driver).toBe('firebase');
    expect(status.ready).toBe(true);
  });
});
