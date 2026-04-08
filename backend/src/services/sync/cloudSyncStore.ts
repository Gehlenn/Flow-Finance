import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import logger from '../../config/logger';
import { applyFirestoreSettingsOnce } from '../openFinance/bankingConnectionStore';
import type { SyncEntity, SyncItem } from '../../validation/sync.schema';

export type CloudSyncStoreDriver = 'memory' | 'firebase';

export type StoredSyncItem = SyncItem & {
  serverUpdatedAt: string;
};

type SyncEntityPayload = Record<SyncEntity, StoredSyncItem[]>;

type PushResult = {
  upserted: number;
  deleted: number;
  latestServerUpdatedAt: string;
  reconciledIds: Array<{ clientId: string; serverId: string }>;
};

type SyncOwnershipContext = {
  userId: string;
  workspaceId: string;
};

type PullResult = {
  since: string | null;
  serverTime: string;
  entities: SyncEntityPayload;
};

type FirebaseAdapterStatus = {
  configured: boolean;
  ready: boolean;
  reason?: string;
};

export type CloudSyncStoreStatus = {
  driver: CloudSyncStoreDriver;
  enabled: boolean;
  configured: boolean;
  ready: boolean;
};

export interface FirebaseCloudSyncStoreAdapter {
  getStatus(): Promise<FirebaseAdapterStatus>;
  getScopeState(scopeId: string): Promise<Partial<SyncEntityPayload>>;
  setScopeState(scopeId: string, entities: Partial<SyncEntityPayload>): Promise<void>;
}

interface CloudSyncStore {
  getStatus(): Promise<CloudSyncStoreStatus>;
  pushItems(scopeId: string, entity: SyncEntity, items: SyncItem[], ownership?: SyncOwnershipContext): Promise<PushResult>;
  pullItems(scopeId: string, since?: string): Promise<PullResult>;
}

export interface CloudSyncStoreFactoryOptions {
  driver?: CloudSyncStoreDriver;
  firebaseAdapter?: FirebaseCloudSyncStoreAdapter;
}

const ENTITIES: SyncEntity[] = ['accounts', 'transactions', 'goals', 'reminders', 'subscriptions'];

function createEmptyEntities(): SyncEntityPayload {
  return {
    accounts: [],
    transactions: [],
    goals: [],
    reminders: [],
    subscriptions: [],
  };
}

function normalizeEntities(entities?: Partial<SyncEntityPayload>): SyncEntityPayload {
  const normalized = createEmptyEntities();

  for (const entity of ENTITIES) {
    normalized[entity] = Array.isArray(entities?.[entity]) ? [...(entities?.[entity] || [])] : [];
  }

  return normalized;
}

function mergeEntityItems(existing: StoredSyncItem[], items: SyncItem[], now: string): { merged: StoredSyncItem[]; upserted: number; deleted: number } {
  const byId = new Map(existing.map((item) => [item.id, item]));
  let upserted = 0;
  let deleted = 0;

  for (const item of items) {
    byId.set(item.id, {
      ...item,
      serverUpdatedAt: now,
    });

    if (item.deleted) {
      deleted += 1;
    } else {
      upserted += 1;
    }
  }

  return {
    merged: Array.from(byId.values()).sort((a, b) => b.serverUpdatedAt.localeCompare(a.serverUpdatedAt)),
    upserted,
    deleted,
  };
}

function filterEntitiesBySince(entities: SyncEntityPayload, since?: string): PullResult {
  const sinceMs = since ? new Date(since).getTime() : null;
  const serverTime = new Date().toISOString();

  const filtered = ENTITIES.reduce<SyncEntityPayload>((acc, entity) => {
    const items = entities[entity];
    acc[entity] = sinceMs === null
      ? items
      : items.filter((item) => new Date(item.serverUpdatedAt).getTime() > sinceMs);
    return acc;
  }, createEmptyEntities());

  return {
    since: since || null,
    serverTime,
    entities: filtered,
  };
}

class FirebaseAdminCloudSyncStoreAdapter implements FirebaseCloudSyncStoreAdapter {
  private readonly collectionName = 'cloud_sync_state';
  private firestore: Firestore | null = null;
  private status: FirebaseAdapterStatus = {
    configured: false,
    ready: false,
    reason: 'not-initialized',
  };

  private buildStatus(configured: boolean, ready: boolean, reason?: string): FirebaseAdapterStatus {
    this.status = { configured, ready, reason };
    return this.status;
  }

  private isServiceAccountConfigured(): boolean {
    return Boolean(
      process.env.FIREBASE_PROJECT_ID
      && process.env.FIREBASE_CLIENT_EMAIL
      && process.env.FIREBASE_PRIVATE_KEY,
    );
  }

  private async ensureFirestore(): Promise<Firestore | null> {
    if (this.firestore) {
      return this.firestore;
    }

    const usingServiceAccount = this.isServiceAccountConfigured();
    const usingApplicationDefault = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

    if (!usingServiceAccount && !usingApplicationDefault) {
      this.buildStatus(false, false, 'firebase-credentials-missing');
      return null;
    }

    try {
      const existingApp = getApps()[0];
      const app = existingApp || initializeApp(usingServiceAccount
        ? {
            credential: cert({
              projectId: String(process.env.FIREBASE_PROJECT_ID || ''),
              clientEmail: String(process.env.FIREBASE_CLIENT_EMAIL || ''),
              privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            }),
            projectId: String(process.env.FIREBASE_PROJECT_ID || undefined),
            databaseURL: process.env.FIREBASE_DATABASE_URL,
          }
        : {
            credential: applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID,
            databaseURL: process.env.FIREBASE_DATABASE_URL,
          });

      const firestore = getFirestore(app);
      applyFirestoreSettingsOnce(firestore);
      this.firestore = firestore;
      this.buildStatus(true, true);
      return this.firestore;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'firebase-init-failed';
      logger.error({ error: message }, 'Failed to initialize Firebase Cloud Sync store');
      this.buildStatus(true, false, message);
      return null;
    }
  }

  async getStatus(): Promise<FirebaseAdapterStatus> {
    if (!this.firestore) {
      await this.ensureFirestore();
    }

    return this.status;
  }

  async getScopeState(scopeId: string): Promise<Partial<SyncEntityPayload>> {
    const firestore = await this.ensureFirestore();
    if (!firestore) {
      return {};
    }

    const snapshot = await firestore.collection(this.collectionName).doc(scopeId).get();
    if (!snapshot.exists) {
      return {};
    }

    const data = snapshot.data();
    return normalizeEntities(data?.entities as Partial<SyncEntityPayload> | undefined);
  }

  async setScopeState(scopeId: string, entities: Partial<SyncEntityPayload>): Promise<void> {
    const firestore = await this.ensureFirestore();
    if (!firestore) {
      throw new Error('Firebase Cloud Sync store is not ready');
    }

    await firestore.collection(this.collectionName).doc(scopeId).set({
      scopeId,
      entities,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
}

function isTemporaryEntityId(id: string): boolean {
  return id.startsWith('tmp_') || id.startsWith('flow_');
}

function reconcileIncomingItems(
  existing: StoredSyncItem[],
  items: SyncItem[],
): { normalizedItems: SyncItem[]; reconciledIds: Array<{ clientId: string; serverId: string }> } {
  const existingByClientId = new Map<string, string>();

  for (const item of existing) {
    if (item.clientId) {
      existingByClientId.set(item.clientId, item.id);
    }
  }

  const reconciledIds: Array<{ clientId: string; serverId: string }> = [];
  const normalizedItems = items.map((item) => {
    if (item.deleted) {
      return item;
    }

    const clientId = item.clientId || (isTemporaryEntityId(item.id) ? item.id : undefined);
    if (!clientId) {
      return item;
    }

    const serverId = existingByClientId.get(clientId) || randomUUID();
    existingByClientId.set(clientId, serverId);
    reconciledIds.push({ clientId, serverId });

    return {
      ...item,
      id: serverId,
      clientId,
      payload: item.payload
        ? {
            ...item.payload,
            id: serverId,
          }
        : item.payload,
    };
  });

  return { normalizedItems, reconciledIds };
}

function assertDeleteOwnership(
  existing: StoredSyncItem | undefined,
  ownership: SyncOwnershipContext | undefined,
): void {
  if (!existing || !ownership) {
    return;
  }

  const payloadUserId = typeof existing.payload?.user_id === 'string' ? existing.payload.user_id : undefined;
  const payloadWorkspaceId = typeof existing.payload?.workspace_id === 'string' ? existing.payload.workspace_id : undefined;

  if ((payloadUserId && payloadUserId !== ownership.userId) || (payloadWorkspaceId && payloadWorkspaceId !== ownership.workspaceId)) {
    throw new Error('Cross-user delete blocked by sync ownership validation');
  }
}

class InMemoryCloudSyncStore implements CloudSyncStore {
  private readonly scopeSyncStore = new Map<string, Map<SyncEntity, Map<string, StoredSyncItem>>>();

  private ensureScopeEntityMap(scopeId: string, entity: SyncEntity): Map<string, StoredSyncItem> {
    const byEntity = this.scopeSyncStore.get(scopeId) || new Map<SyncEntity, Map<string, StoredSyncItem>>();
    if (!this.scopeSyncStore.has(scopeId)) {
      this.scopeSyncStore.set(scopeId, byEntity);
    }

    const existing = byEntity.get(entity);
    if (existing) {
      return existing;
    }

    const created = new Map<string, StoredSyncItem>();
    byEntity.set(entity, created);
    return created;
  }

  async getStatus(): Promise<CloudSyncStoreStatus> {
    return {
      driver: 'memory',
      enabled: true,
      configured: true,
      ready: true,
    };
  }

  async pushItems(scopeId: string, entity: SyncEntity, items: SyncItem[], ownership?: SyncOwnershipContext): Promise<PushResult> {
    const entityMap = this.ensureScopeEntityMap(scopeId, entity);
    const existingItems = Array.from(entityMap.values());
    const { normalizedItems, reconciledIds } = reconcileIncomingItems(existingItems, items);
    const now = new Date().toISOString();
    let upserted = 0;
    let deleted = 0;

    for (const item of normalizedItems) {
      if (item.deleted) {
        assertDeleteOwnership(entityMap.get(item.id), ownership);
      }

      entityMap.set(item.id, {
        ...item,
        serverUpdatedAt: now,
      });

      if (item.deleted) {
        deleted += 1;
      } else {
        upserted += 1;
      }
    }

    return { upserted, deleted, latestServerUpdatedAt: now, reconciledIds };
  }

  async pullItems(scopeId: string, since?: string): Promise<PullResult> {
    const byEntity = this.scopeSyncStore.get(scopeId) || new Map<SyncEntity, Map<string, StoredSyncItem>>();
    const entities = ENTITIES.reduce<SyncEntityPayload>((acc, entity) => {
      const entityMap = byEntity.get(entity);
      acc[entity] = entityMap ? Array.from(entityMap.values()) : [];
      return acc;
    }, createEmptyEntities());

    return filterEntitiesBySince(entities, since);
  }
}

class FirebaseCloudSyncStore implements CloudSyncStore {
  constructor(private readonly adapter: FirebaseCloudSyncStoreAdapter) {}

  async getStatus(): Promise<CloudSyncStoreStatus> {
    const status = await this.adapter.getStatus();
    return {
      driver: 'firebase',
      enabled: true,
      configured: status.configured,
      ready: status.ready,
    };
  }

  async pushItems(scopeId: string, entity: SyncEntity, items: SyncItem[], ownership?: SyncOwnershipContext): Promise<PushResult> {
    const current = normalizeEntities(await this.adapter.getScopeState(scopeId));
    const now = new Date().toISOString();
    const { normalizedItems, reconciledIds } = reconcileIncomingItems(current[entity], items);
    for (const item of normalizedItems) {
      if (item.deleted) {
        assertDeleteOwnership(current[entity].find((entry) => entry.id === item.id), ownership);
      }
    }
    const merged = mergeEntityItems(current[entity], normalizedItems, now);

    await this.adapter.setScopeState(scopeId, {
      [entity]: merged.merged,
    });

    return {
      upserted: merged.upserted,
      deleted: merged.deleted,
      latestServerUpdatedAt: now,
      reconciledIds,
    };
  }

  async pullItems(scopeId: string, since?: string): Promise<PullResult> {
    const state = normalizeEntities(await this.adapter.getScopeState(scopeId));
    return filterEntitiesBySince(state, since);
  }
}

function parseStoreDriver(driver?: string): CloudSyncStoreDriver | null {
  const normalized = String(driver || '').toLowerCase();
  if (normalized === 'memory' || normalized === 'firebase') {
    return normalized;
  }

  return null;
}

export function resolveCloudSyncStoreDriver(): CloudSyncStoreDriver {
  const explicitDriver = parseStoreDriver(process.env.CLOUD_SYNC_STORE_DRIVER);
  if (explicitDriver) {
    return explicitDriver;
  }

  const hasFirebaseCredentials = Boolean(
    (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
    || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );

  return hasFirebaseCredentials ? 'firebase' : 'memory';
}

export function createCloudSyncStore(options: CloudSyncStoreFactoryOptions = {}): CloudSyncStore {
  const driver = options.driver || resolveCloudSyncStoreDriver();

  if (driver === 'firebase') {
    return new FirebaseCloudSyncStore(options.firebaseAdapter || new FirebaseAdminCloudSyncStoreAdapter());
  }

  return new InMemoryCloudSyncStore();
}

let cloudSyncStore: CloudSyncStore = createCloudSyncStore();

export async function pushSyncItems(
  scopeId: string,
  entity: SyncEntity,
  items: SyncItem[],
  ownership?: SyncOwnershipContext,
): Promise<PushResult> {
  return cloudSyncStore.pushItems(scopeId, entity, items, ownership);
}

export async function pullSyncItems(scopeId: string, since?: string): Promise<PullResult> {
  return cloudSyncStore.pullItems(scopeId, since);
}

export async function getCloudSyncStoreStatus(): Promise<CloudSyncStoreStatus> {
  return cloudSyncStore.getStatus();
}

export function resetCloudSyncStoreForTests(): void {
  cloudSyncStore = createCloudSyncStore({ driver: 'memory' });
}
