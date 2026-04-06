/**
 * LOCAL SYNC SERVICE
 *
 * Write-through sync layer: localStorage atua como cache local imediato
 * e o backend (Firestore via cloudSyncStore) atua como fonte de verdade cross-device.
 *
 * Padrão:
 *   1. Escrita local (localStorage) → imediata, síncrona
 *   2. Push nuvem (fire-and-forget) → assíncrono, não bloqueia UI
 *   3. Pull nuvem on-load → hidrata localStorage ao carregar workspace
 *
 * Entidades suportadas (espelho do SyncEntity do backend):
 *   goals | accounts | transactions | subscriptions
 *
 * AI memory e task queue ficam apenas locais (são contexto efêmero).
 */

import { API_ENDPOINTS, apiRequest } from '../config/api.config';

export type LocalSyncEntity = 'goals' | 'accounts' | 'transactions' | 'subscriptions';

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
    subscriptions: SyncItem[];
  };
}

// ─── Push ─────────────────────────────────────────────────────────────────────

/**
 * Envia itens locais para o backend. Fire-and-forget — não lança exceção
 * para não bloquear a escrita local. Erros são logados silenciosamente.
 */
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
  } catch {
    // Falha silenciosa intencional: localStorage já foi atualizado.
    // O próximo push bem-sucedido reconcilia o estado.
  }
}

// ─── Pull ─────────────────────────────────────────────────────────────────────

/**
 * Busca todos os itens do workspace na nuvem desde `since` (ISO string opcional).
 * Retorna null em caso de erro para que o caller possa ignorar com segurança.
 */
export async function pullFromCloud(since?: string): Promise<SyncPullResult | null> {
  try {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return await apiRequest<SyncPullResult>(`${API_ENDPOINTS.SYNC.PULL}${qs}`, {
      method: 'GET',
      credentials: 'include',
      silent: true,
    });
  } catch {
    return null;
  }
}

// ─── Goals hydration ──────────────────────────────────────────────────────────

const GOALS_STORAGE_KEY = 'flow_financial_goals';
const GOALS_LAST_PULL_KEY = 'flow_financial_goals_last_pull';

/**
 * Hidrata as metas do localStorage com dados da nuvem.
 * Estratégia: cloud upsert — items vindos da nuvem sobrescrevem o local por `id`.
 * Items locais não presentes na nuvem são mantidos (podem ser edições offline).
 * Items com `deleted: true` vindos da nuvem são removidos do localStorage.
 *
 * @returns true se o localStorage foi atualizado
 */
export async function hydrateGoalsFromCloud(): Promise<boolean> {
  const since = localStorage.getItem(GOALS_LAST_PULL_KEY) ?? undefined;
  const result = await pullFromCloud(since || undefined);

  if (!result) return false;

  const cloudGoals = result.entities.goals;
  if (!cloudGoals.length) {
    // Nada novo na nuvem — salva o serverTime para o próximo pull incremental
    localStorage.setItem(GOALS_LAST_PULL_KEY, result.serverTime);
    return false;
  }

  let local: Record<string, unknown>[] = [];
  try {
    local = JSON.parse(localStorage.getItem(GOALS_STORAGE_KEY) || '[]');
  } catch {
    local = [];
  }

  const localMap = new Map(local.map((g) => [(g as { id: string }).id, g]));

  for (const cloudItem of cloudGoals) {
    if (cloudItem.deleted) {
      localMap.delete(cloudItem.id);
    } else if (cloudItem.payload) {
      // Cloud vence no merge — sobrescreve o item local pelo id
      localMap.set(cloudItem.id, { ...cloudItem.payload, id: cloudItem.id });
    }
  }

  localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(Array.from(localMap.values())));
  localStorage.setItem(GOALS_LAST_PULL_KEY, result.serverTime);

  return true;
}
