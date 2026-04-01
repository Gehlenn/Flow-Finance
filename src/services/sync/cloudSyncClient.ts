import { apiRequest, API_ENDPOINTS } from '../../config/api.config';

export type SyncEntity = 'accounts' | 'transactions' | 'goals' | 'subscriptions';

type SyncPayload = Record<string, unknown>;

type SyncItem<TPayload extends SyncPayload> = {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  payload?: TPayload;
};

type PullResponse<TPayload extends SyncPayload> = {
  since: string | null;
  serverTime: string;
  entities: Record<SyncEntity, Array<SyncItem<TPayload>>>;
};

function resolveUpdatedAt(payload: SyncPayload): string {
  const candidates = [
    payload.updatedAt,
    payload.updated_at,
    payload.createdAt,
    payload.created_at,
    payload.date,
  ];

  const resolved = candidates.find((value) => typeof value === 'string' && value.length > 0);
  return typeof resolved === 'string' ? resolved : new Date().toISOString();
}

function buildSyncItems<TPayload extends SyncPayload>(
  nextItems: TPayload[],
  previousItems: TPayload[]
): Array<SyncItem<TPayload>> {
  const previousById = new Map(previousItems.map((item) => [String(item.id), item]));
  const nextById = new Map(nextItems.map((item) => [String(item.id), item]));

  const upserts = nextItems.map((item) => ({
    id: String(item.id),
    updatedAt: resolveUpdatedAt(item),
    payload: item,
  }));

  const deletions = previousItems
    .filter((item) => !nextById.has(String(item.id)))
    .map((item) => ({
      id: String(item.id),
      updatedAt: resolveUpdatedAt(previousById.get(String(item.id)) || item),
      deleted: true,
    }));

  return [...upserts, ...deletions];
}

export async function pullSyncEntities<TPayload extends SyncPayload>(
  since?: string
): Promise<PullResponse<TPayload>> {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiRequest<PullResponse<TPayload>>(`${API_ENDPOINTS.SYNC.PULL}${query}`, {
    method: 'GET',
  });
}

export async function replaceSyncEntityCollection<TPayload extends SyncPayload>(
  entity: SyncEntity,
  nextItems: TPayload[],
  previousItems: TPayload[]
): Promise<void> {
  const items = buildSyncItems(nextItems, previousItems);
  if (items.length === 0) {
    return;
  }

  await apiRequest(API_ENDPOINTS.SYNC.PUSH, {
    method: 'POST',
    body: JSON.stringify({
      entity,
      items,
    }),
  });
}

export function extractSyncPayloads<TPayload extends SyncPayload>(
  items: Array<SyncItem<TPayload>>
): TPayload[] {
  return items
    .filter((item) => !item.deleted && item.payload)
    .map((item) => item.payload as TPayload);
}
