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
 *   goals | accounts | transactions | reminders | receivables | subscriptions
 *
 * AI memory e task queue ficam apenas locais (são contexto efêmero).
 */

import { API_ENDPOINTS, apiRequest } from '../config/api.config';
import { logWarn } from '../utils/logger';
import { hydrateGoalsFromCloud as hydrateGoalsFromCloudImpl } from './localSyncGoalsHydrator';
import type {
  LocalSyncEntity,
  SyncItem,
  SyncPullResult,
  SyncPushPayload,
  SyncPushResult,
} from './localSyncTypes';

export type {
  LocalSyncEntity,
  SyncItem,
  SyncPullResult,
  SyncPushPayload,
  SyncPushResult,
} from './localSyncTypes';

export async function pushToCloud(
  entity: LocalSyncEntity,
  items: SyncItem[],
): Promise<SyncPushResult> {
  if (!items.length) {
    return {
      success: true,
      upserted: 0,
      deleted: 0,
      latestServerUpdatedAt: new Date().toISOString(),
      reconciledIds: [],
    };
  }

  const payload: SyncPushPayload = { entity, items };
  return apiRequest<SyncPushResult>(API_ENDPOINTS.SYNC.PUSH, {
    method: 'POST',
    body: JSON.stringify(payload),
    credentials: 'include',
    retries: 0,
    silent: true,
  });
}

export async function pullFromCloud(since?: string): Promise<SyncPullResult> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiRequest<SyncPullResult>(`${API_ENDPOINTS.SYNC.PULL}${qs}`, {
    method: 'GET',
    credentials: 'include',
    retries: 0,
    silent: true,
  });
}

async function pullFromCloudBestEffort(since?: string): Promise<SyncPullResult | null> {
  try {
    return await pullFromCloud(since);
  } catch (error) {
    logWarn('[LocalSync] Goal hydration skipped because cloud sync is unavailable', {
      since: since ?? null,
      error,
      fallback: 'local-sync-goal-hydration-unavailable',
    });
    return null;
  }
}

export async function hydrateGoalsFromCloud(): Promise<boolean> {
  return hydrateGoalsFromCloudImpl(pullFromCloudBestEffort);
}
