import { Account } from '../../../models/Account';
import { Goal, Receivable, Reminder, Transaction } from '../../../types';
import {
  loadWorkspaceEntities,
  replaceWorkspaceEntityCollection,
} from '../firestoreWorkspaceStore';
import { pullFromCloud, pushToCloud } from '../localSyncService';
import type { SyncEntity } from './syncTypes';

export type SyncDriver = 'firestore' | 'backend';

type SyncRecord = { id: string };

type SyncItem<TPayload> = {
  id: string;
  clientId?: string;
  updatedAt: string;
  deleted?: boolean;
  payload?: TPayload;
};

type PushResponse = {
  success: boolean;
  upserted: number;
  deleted: number;
  latestServerUpdatedAt: string;
  reconciledIds: Array<{ clientId: string; serverId: string }>;
};

type PullResponse<TPayload> = {
  since: string | null;
  serverTime: string;
  entities: Record<SyncEntity, Array<SyncItem<TPayload>>>;
};

export type FirestoreSyncContext = {
  userId: string;
  tenantId: string;
  workspaceId: string;
};

type SyncDriverOptions = {
  driver?: SyncDriver;
};

function hasWorkspaceContext(workspaceId?: string): boolean {
  return Boolean(workspaceId?.trim());
}

function buildPullItems<TPayload extends SyncRecord>(items?: TPayload[]): Array<SyncItem<TPayload>> {
  return (items || []).map((item) => {
    const record = item as { updated_at?: string; created_at?: string; date?: string; id: string };
    return {
      id: String(item.id),
      updatedAt: String(record.updated_at || record.created_at || record.date || new Date().toISOString()),
      payload: item,
    };
  });
}

function buildPushItems<TPayload extends SyncRecord>(
  nextItems: TPayload[],
  previousItems: TPayload[],
): Array<SyncItem<TPayload>> {
  const nextById = new Map(nextItems.map((item) => [String(item.id), item] as const));
  const items: Array<SyncItem<TPayload>> = [];

  for (const item of nextItems) {
    const record = item as { updated_at?: string; created_at?: string; date?: string; id: string };
    items.push({
      id: String(item.id),
      updatedAt: String(record.updated_at || record.created_at || record.date || new Date().toISOString()),
      payload: item,
    });
  }

  for (const previous of previousItems) {
    if (nextById.has(String(previous.id))) {
      continue;
    }

    const record = previous as { updated_at?: string; created_at?: string; date?: string; id: string };
    items.push({
      id: String(previous.id),
      updatedAt: String(record.updated_at || record.created_at || record.date || new Date().toISOString()),
      deleted: true,
    });
  }

  return items;
}

export async function pullSyncEntities<TPayload>(
  context: Pick<FirestoreSyncContext, 'workspaceId'>,
  since?: string,
  options?: SyncDriverOptions,
): Promise<PullResponse<TPayload>> {
  if (!hasWorkspaceContext(context.workspaceId)) {
    return {
      since: since || null,
      serverTime: new Date().toISOString(),
      entities: { accounts: [], transactions: [], goals: [], reminders: [], receivables: [] },
    };
  }

  if (options?.driver === 'backend') {
    const result = await pullFromCloud(since);
    const entities = result?.entities;

    return {
      since: result?.since || since || null,
      serverTime: result?.serverTime || new Date().toISOString(),
      entities: {
        accounts: (entities?.accounts || []) as Array<SyncItem<TPayload>>,
        transactions: (entities?.transactions || []) as Array<SyncItem<TPayload>>,
        goals: (entities?.goals || []) as Array<SyncItem<TPayload>>,
        reminders: (entities?.reminders || []) as Array<SyncItem<TPayload>>,
        receivables: (entities?.receivables || []) as Array<SyncItem<TPayload>>,
      },
    };
  }

  const entities = await loadWorkspaceEntities(context.workspaceId);

  return {
    since: since || null,
    serverTime: new Date().toISOString(),
    entities: {
      accounts: buildPullItems(entities.accounts as unknown as SyncRecord[]) as Array<SyncItem<TPayload>>,
      transactions: buildPullItems(entities.transactions as unknown as SyncRecord[]) as Array<SyncItem<TPayload>>,
      goals: buildPullItems(entities.goals as unknown as SyncRecord[]) as Array<SyncItem<TPayload>>,
      reminders: buildPullItems(entities.reminders as unknown as SyncRecord[]) as Array<SyncItem<TPayload>>,
      receivables: buildPullItems(entities.receivables as unknown as SyncRecord[]) as Array<SyncItem<TPayload>>,
    },
  };
}

export async function replaceSyncEntityCollection<TPayload extends SyncRecord>(
  entity: SyncEntity,
  nextItems: TPayload[],
  previousItems: TPayload[],
  context: FirestoreSyncContext,
  options?: SyncDriverOptions,
): Promise<PushResponse> {
  if (!hasWorkspaceContext(context.workspaceId)) {
    throw new Error('Workspace sync requires a workspaceId.');
  }

  if (options?.driver === 'backend') {
    const items = buildPushItems(nextItems, previousItems);
    const result = await pushToCloud(entity, items);

    return result || {
      success: true,
      upserted: nextItems.length,
      deleted: Math.max(previousItems.length - nextItems.length, 0),
      latestServerUpdatedAt: new Date().toISOString(),
      reconciledIds: [],
    };
  }

  return replaceWorkspaceEntityCollection(
    entity,
    nextItems,
    previousItems,
    context,
  );
}

export function extractSyncPayloads<TPayload>(
  items: Array<SyncItem<TPayload>>,
): TPayload[] {
  return items
    .filter((item) => !item.deleted && item.payload)
    .map((item) => item.payload as TPayload);
}

export type { PushResponse, PullResponse, SyncItem };
