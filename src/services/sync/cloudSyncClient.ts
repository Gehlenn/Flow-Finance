import { Account } from '../../../models/Account';
import { Goal, Transaction } from '../../../types';
import {
  loadWorkspaceEntities,
  replaceWorkspaceEntityCollection,
  type SyncEntityIdMap,
} from '../firestoreWorkspaceStore';

export type SyncEntity = 'accounts' | 'transactions' | 'goals' | 'reminders';

type SyncPayload = object;

type SyncItem<TPayload extends SyncPayload> = {
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

type PullResponse<TPayload extends SyncPayload> = {
  since: string | null;
  serverTime: string;
  entities: Record<SyncEntity, Array<SyncItem<TPayload>>>;
};

export type FirestoreSyncContext = {
  userId: string;
  tenantId: string;
  workspaceId: string;
};

function buildPullItems<TPayload extends SyncPayload>(items: Array<TPayload & { id: string }>): Array<SyncItem<TPayload>> {
  return items.map((item) => {
    const record = item as { updated_at?: string; created_at?: string; date?: string; id: string };
    return {
      id: String(item.id),
      updatedAt: String(record.updated_at || record.created_at || record.date || new Date().toISOString()),
      payload: item,
    };
  });
}

export async function pullSyncEntities<TPayload extends SyncPayload>(
  context: Pick<FirestoreSyncContext, 'workspaceId'>,
  since?: string,
): Promise<PullResponse<TPayload>> {
  const entities = await loadWorkspaceEntities(context.workspaceId);

  return {
    since: since || null,
    serverTime: new Date().toISOString(),
    entities: {
      accounts: buildPullItems(entities.accounts as unknown as Array<TPayload & { id: string }>),
      transactions: buildPullItems(entities.transactions as unknown as Array<TPayload & { id: string }>),
      goals: buildPullItems(entities.goals as unknown as Array<TPayload & { id: string }>),
      reminders: buildPullItems(entities.reminders as unknown as Array<TPayload & { id: string }>),
    },
  };
}

export async function replaceSyncEntityCollection<TPayload extends SyncPayload>(
  entity: SyncEntity,
  nextItems: Array<TPayload & { id: string }>,
  previousItems: Array<TPayload & { id: string }>,
  context: FirestoreSyncContext,
): Promise<PushResponse> {
  return replaceWorkspaceEntityCollection(
    entity,
    nextItems,
    previousItems,
    context,
  );
}

export function extractSyncPayloads<TPayload extends SyncPayload>(
  items: Array<SyncItem<TPayload>>,
): TPayload[] {
  return items
    .filter((item) => !item.deleted && item.payload)
    .map((item) => item.payload as TPayload);
}

export type { PushResponse, PullResponse, SyncItem, SyncEntityIdMap };
