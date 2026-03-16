import type { SyncEntity, SyncItem } from '../../validation/sync.schema';

type StoredSyncItem = SyncItem & {
  serverUpdatedAt: string;
};

const userSyncStore = new Map<string, Map<SyncEntity, Map<string, StoredSyncItem>>>();

const ENTITIES: SyncEntity[] = ['accounts', 'transactions', 'goals', 'subscriptions'];

function ensureUserEntityMap(userId: string, entity: SyncEntity): Map<string, StoredSyncItem> {
  const byEntity = userSyncStore.get(userId) || new Map<SyncEntity, Map<string, StoredSyncItem>>();
  if (!userSyncStore.has(userId)) {
    userSyncStore.set(userId, byEntity);
  }

  const existing = byEntity.get(entity);
  if (existing) {
    return existing;
  }

  const created = new Map<string, StoredSyncItem>();
  byEntity.set(entity, created);
  return created;
}

export function pushSyncItems(userId: string, entity: SyncEntity, items: SyncItem[]): {
  upserted: number;
  deleted: number;
  latestServerUpdatedAt: string;
} {
  const entityMap = ensureUserEntityMap(userId, entity);
  let upserted = 0;
  let deleted = 0;
  const now = new Date().toISOString();

  for (const item of items) {
    const next: StoredSyncItem = {
      ...item,
      serverUpdatedAt: now,
    };

    entityMap.set(item.id, next);
    if (item.deleted) {
      deleted += 1;
    } else {
      upserted += 1;
    }
  }

  return { upserted, deleted, latestServerUpdatedAt: now };
}

export function pullSyncItems(userId: string, since?: string): {
  since: string | null;
  serverTime: string;
  entities: Record<SyncEntity, StoredSyncItem[]>;
} {
  const byEntity = userSyncStore.get(userId) || new Map<SyncEntity, Map<string, StoredSyncItem>>();
  const sinceMs = since ? new Date(since).getTime() : null;
  const serverTime = new Date().toISOString();

  const entities = ENTITIES.reduce<Record<SyncEntity, StoredSyncItem[]>>((acc, entity) => {
    const entityMap = byEntity.get(entity);
    if (!entityMap) {
      acc[entity] = [];
      return acc;
    }

    const allItems = Array.from(entityMap.values());
    const filtered = sinceMs === null
      ? allItems
      : allItems.filter((item) => new Date(item.serverUpdatedAt).getTime() > sinceMs);

    acc[entity] = filtered.sort((a, b) => b.serverUpdatedAt.localeCompare(a.serverUpdatedAt));
    return acc;
  }, {
    accounts: [],
    transactions: [],
    goals: [],
    subscriptions: [],
  });

  return { since: since || null, serverTime, entities };
}

export function resetCloudSyncStoreForTests(): void {
  userSyncStore.clear();
}