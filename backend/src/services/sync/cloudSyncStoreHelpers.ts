import { randomUUID } from 'crypto';
import type { SyncEntity, SyncItem } from '../../validation/sync.schema';

export type StoredSyncItem = SyncItem & {
  serverUpdatedAt: string;
};

export type SyncEntityPayload = Record<SyncEntity, StoredSyncItem[]>;

export type SyncConflictReason =
  | 'stale_client_update'
  | 'same_timestamp_divergent_payload'
  | 'invalid_updated_at';

export type SyncConflict = {
  id: string;
  reason: SyncConflictReason;
  incomingUpdatedAt: string;
  existingUpdatedAt: string;
  resolution: 'preserved_existing';
};

export type SyncOwnershipContext = {
  userId: string;
  workspaceId: string;
};

export const ENTITIES: SyncEntity[] = ['accounts', 'transactions', 'goals', 'reminders', 'subscriptions'];

export function createEmptyEntities(): SyncEntityPayload {
  return {
    accounts: [],
    transactions: [],
    goals: [],
    reminders: [],
    subscriptions: [],
  };
}

export function normalizeEntities(entities?: Partial<SyncEntityPayload>): SyncEntityPayload {
  const normalized = createEmptyEntities();
  for (const entity of ENTITIES) {
    normalized[entity] = Array.isArray(entities?.[entity]) ? [...(entities?.[entity] || [])] : [];
  }
  return normalized;
}

export function parseUpdatedAt(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasSameSyncContent(existing: StoredSyncItem, incoming: SyncItem): boolean {
  return JSON.stringify({
    clientId: existing.clientId ?? null,
    updatedAt: existing.updatedAt,
    deleted: Boolean(existing.deleted),
    payload: existing.payload ?? null,
  }) === JSON.stringify({
    clientId: incoming.clientId ?? null,
    updatedAt: incoming.updatedAt,
    deleted: Boolean(incoming.deleted),
    payload: incoming.payload ?? null,
  });
}

export function shouldApplyIncomingItem(
  existing: StoredSyncItem | undefined,
  incoming: SyncItem,
): { apply: boolean; conflict?: SyncConflict } {
  if (!existing) {
    return { apply: true };
  }

  const existingUpdatedAt = parseUpdatedAt(existing.updatedAt);
  const incomingUpdatedAt = parseUpdatedAt(incoming.updatedAt);

  if (existingUpdatedAt === null || incomingUpdatedAt === null) {
    return {
      apply: false,
      conflict: {
        id: incoming.id,
        reason: 'invalid_updated_at',
        incomingUpdatedAt: incoming.updatedAt,
        existingUpdatedAt: existing.updatedAt,
        resolution: 'preserved_existing',
      },
    };
  }

  if (incomingUpdatedAt > existingUpdatedAt) {
    return { apply: true };
  }

  if (incomingUpdatedAt < existingUpdatedAt) {
    return {
      apply: false,
      conflict: {
        id: incoming.id,
        reason: 'stale_client_update',
        incomingUpdatedAt: incoming.updatedAt,
        existingUpdatedAt: existing.updatedAt,
        resolution: 'preserved_existing',
      },
    };
  }

  if (hasSameSyncContent(existing, incoming)) {
    return { apply: true };
  }

  return {
    apply: false,
    conflict: {
      id: incoming.id,
      reason: 'same_timestamp_divergent_payload',
      incomingUpdatedAt: incoming.updatedAt,
      existingUpdatedAt: existing.updatedAt,
      resolution: 'preserved_existing',
    },
  };
}

export function mergeEntityItems(
  existing: StoredSyncItem[],
  items: SyncItem[],
  now: string,
): { merged: StoredSyncItem[]; upserted: number; deleted: number; conflicts: SyncConflict[] } {
  const byId = new Map(existing.map((item) => [item.id, item] as const));
  let upserted = 0;
  let deleted = 0;
  const conflicts: SyncConflict[] = [];

  for (const item of items) {
    const current = byId.get(item.id);
    const decision = shouldApplyIncomingItem(current, item);

    if (!decision.apply) {
      if (decision.conflict) {
        conflicts.push(decision.conflict);
      }
      continue;
    }

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
    conflicts,
  };
}

export function filterEntitiesBySince(entities: SyncEntityPayload, since?: string): {
  since: string | null;
  serverTime: string;
  entities: SyncEntityPayload;
} {
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

export function isTemporaryEntityId(id: string): boolean {
  return id.startsWith('tmp_') || id.startsWith('flow_');
}

export function reconcileIncomingItems(
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

export function assertDeleteOwnership(
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
