/**
 * LOCAL SYNC SERVICE
 *
 * Write-through sync layer: localStorage atua como cache local imediato
 * e o backend (Firestore via cloudSyncStore) atua como fonte de verdade cross-device.
 *
 * Padrão:
 *   1. Escrita local (localStorage) -> imediata, síncrona
 *   2. Push nuvem (fire-and-forget) -> assíncrono, não bloqueia UI
 *   3. Pull nuvem on-load -> hidrata localStorage ao carregar workspace
 *
 * Entidades suportadas (espelho do SyncEntity do backend):
 *   goals | accounts | transactions | reminders | subscriptions
 *
 * AI memory e task queue ficam apenas locais (são contexto efêmero).
 */

import { API_ENDPOINTS, apiRequest } from '../config/api.config';
import { logWarn } from '../utils/logger';
import { hydrateGoalsFromCloud as hydrateGoalsFromCloudImpl } from './localSyncGoalsHydrator';

export type LocalSyncEntity = 'goals' | 'accounts' | 'transactions' | 'reminders' | 'subscriptions';

export interface SyncItem {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  payload?: Record<string, unknown>;
}

export interface SyncPushPayload {
  entity: LocalSyncEntity;
  items: SyncItem[];
}

export interface SyncPushResult {
  success: boolean;
  upserted: number;
  deleted: number;
  latestServerUpdatedAt: string;
  reconciledIds: Array<{ clientId: string; serverId: string }>;
}

export interface SyncPullResult {
  since: string | null;
  serverTime: string;
  entities: {
    goals: SyncItem[];
    accounts: SyncItem[];
    transactions: SyncItem[];
    reminders: SyncItem[];
    subscriptions: SyncItem[];
  };
}

export async function pushToCloud(
  entity: LocalSyncEntity,
  items: SyncItem[],
): Promise<void> {
  if (!items.length) return;

  try {
    const payload: SyncPushPayload = { entity, items };
    await apiRequest<SyncPushResult>(API_ENDPOINTS.SYNC.PUSH, {
      method: 'POST',
      body: JSON.stringify(payload),
      credentials: 'include',
      silent: true,
    });
  } catch (error) {
    logWarn('[LocalSync] pushToCloud failed; keeping local state as source of truth', {
      entity,
      itemCount: items.length,
      error,
      fallback: 'local-sync-push-failed',
    });
  }
}

export async function pullFromCloud(since?: string): Promise<SyncPullResult | null> {
  try {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return await apiRequest<SyncPullResult>(`${API_ENDPOINTS.SYNC.PULL}${qs}`, {
      method: 'GET',
      credentials: 'include',
      silent: true,
    });
  } catch (error) {
    logWarn('[LocalSync] pullFromCloud failed; returning null to preserve local state', {
      since: since ?? null,
      error,
      fallback: 'local-sync-pull-failed',
    });
    return null;
  }
}

export async function hydrateGoalsFromCloud(): Promise<boolean> {
  return hydrateGoalsFromCloudImpl(pullFromCloud);
}
