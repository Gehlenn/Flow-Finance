import fs from 'fs';
import path from 'path';
import { getWorkspace, getWorkspaceEntitlements } from '../services/admin/workspaceStore';
import logger from '../config/logger';
import {
  loadJsonState,
  loadWorkspaceSaasState,
  saveJsonState,
  saveWorkspaceSaasState,
} from '../services/persistence/postgresStateStore';
import {
  appendScopedBillingHook,
  areLegacyStateBlobsDisabled,
  cloneState,
  cloneUsageSnapshot,
  currentMonthKey,
  EMPTY_STATE,
  getMonthlyUsage,
  getStoreFilePath,
  incrementScopedUsage,
  normalizeBillingHookMap,
  normalizeUsageEventMap,
  normalizeUsageMap,
  persistLegacyState,
  setScopedUsage,
  logLegacyStoreLoadFailure,
} from './saasStoreHelpers';

export type ResourceKind = 'transactions' | 'aiQueries' | 'bankConnections';

export type UsageSnapshot = {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
};

export type PlanId = 'free' | 'pro';

export type BillingHookEvent =
  | 'usage_recorded'
  | 'limit_reached'
  | 'upgrade_required'
  | 'plan_changed';

export type BillingHookPayload = {
  userId?: string;
  workspaceId?: string;
  plan: PlanId;
  event: BillingHookEvent;
  resource?: ResourceKind;
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
};

export type WorkspaceUsageEvent = {
  id: string;
  workspaceId: string;
  userId?: string;
  resource: ResourceKind;
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
};

type ScopedUsageMap = Record<string, Record<string, UsageSnapshot>>;
type ScopedBillingHookMap = Record<string, BillingHookPayload[]>;

type SaasStoreState = {
  usageByWorkspace: ScopedUsageMap;
  usageByUser: ScopedUsageMap;
  billingHooksByWorkspace: ScopedBillingHookMap;
  billingHooksByUser: ScopedBillingHookMap;
  usageEventsByWorkspace: Record<string, WorkspaceUsageEvent[]>;
  userPlans: Record<string, PlanId>;
};

const DEFAULT_STORE_FILE = path.resolve(__dirname, '../../data/saas-store.json');
const POSTGRES_STATE_KEY = 'saas_store_state';

let stateCache: SaasStoreState | null = null;

export const PLAN_LIMITS: Record<PlanId, UsageSnapshot> = {
  free: { transactions: 500, aiQueries: 100, bankConnections: 1 },
  pro: { transactions: 10000, aiQueries: 5000, bankConnections: 20 },
};

function loadState(): SaasStoreState {
  if (stateCache) {
    return stateCache;
  }

  if (areLegacyStateBlobsDisabled()) {
    stateCache = cloneState(EMPTY_STATE);
    return stateCache;
  }

  const filePath = getStoreFilePath(DEFAULT_STORE_FILE);

  try {
    if (!fs.existsSync(filePath)) {
      stateCache = cloneState(EMPTY_STATE);
      return stateCache;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      stateCache = cloneState(EMPTY_STATE);
      return stateCache;
    }

    const parsed = JSON.parse(raw) as Partial<SaasStoreState>;
    stateCache = {
      usageByWorkspace: normalizeUsageMap(parsed.usageByWorkspace),
      usageByUser: normalizeUsageMap(parsed.usageByUser),
      billingHooksByWorkspace: normalizeBillingHookMap(parsed.billingHooksByWorkspace),
      billingHooksByUser: normalizeBillingHookMap(parsed.billingHooksByUser),
      usageEventsByWorkspace: normalizeUsageEventMap(parsed.usageEventsByWorkspace),
      userPlans: Object.fromEntries(
        Object.entries(parsed.userPlans ?? {}).filter(([, plan]) => plan === 'free' || plan === 'pro'),
      ) as Record<string, PlanId>,
    };
  } catch (error) {
    logLegacyStoreLoadFailure(error, filePath);
    stateCache = cloneState(EMPTY_STATE);
  }

  return stateCache;
}

async function persistState(state: SaasStoreState): Promise<void> {
  stateCache = cloneState(state);
  if (!areLegacyStateBlobsDisabled()) {
    const filePath = getStoreFilePath(DEFAULT_STORE_FILE);
    persistLegacyState(filePath, state);
  }
  // Postgres is the source of truth for billing — this write is blocking and must succeed.
  await saveWorkspaceSaasState({
    usageByWorkspace: state.usageByWorkspace,
    usageEventsByWorkspace: state.usageEventsByWorkspace,
    billingHooksByWorkspace: Object.fromEntries(
      Object.entries(state.billingHooksByWorkspace).map(([workspaceId, hooks]) => [
        workspaceId,
        hooks.map((hook, index) => ({
          id: `${workspaceId}_${hook.at}_${index}`.replace(/[^a-zA-Z0-9:_-]/g, '_'),
          workspaceId,
          userId: hook.userId,
          plan: hook.plan,
          event: hook.event,
          resource: hook.resource,
          amount: hook.amount,
          at: hook.at,
          metadata: hook.metadata,
        })),
      ]),
    ),
  });
  // Legacy JSON blob — best-effort backup only, not source of truth.
  if (!areLegacyStateBlobsDisabled()) {
    void saveJsonState(POSTGRES_STATE_KEY, state as unknown as Record<string, unknown>).catch((error) => {
      logger.warn({
        error,
        key: POSTGRES_STATE_KEY,
        workspaceCount: Object.keys(state.usageByWorkspace).length,
        userCount: Object.keys(state.usageByUser).length,
        billingHookWorkspaceCount: Object.keys(state.billingHooksByWorkspace).length,
        usageEventWorkspaceCount: Object.keys(state.usageEventsByWorkspace).length,
        fallback: 'saas-legacy-json-backup-failed',
      }, 'Failed to persist legacy SaaS blob to Postgres');
    });
  }
}

export function getUserPlan(userId: string): PlanId {
  return loadState().userPlans[userId] || 'free';
}

export async function setUserPlan(userId: string, plan: PlanId): Promise<void> {
  const state = loadState();
  await persistState({
    ...state,
    userPlans: {
      ...state.userPlans,
      [userId]: plan,
    },
  });
}

export function getWorkspacePlan(workspaceId: string): PlanId {
  return getWorkspace(workspaceId)?.plan || 'free';
}

export function getWorkspaceLimits(workspaceId: string): UsageSnapshot {
  const entitlements = getWorkspaceEntitlements(workspaceId);
  if (entitlements) {
    return {
      transactions: entitlements.limits.transactionsPerMonth,
      aiQueries: entitlements.limits.aiQueriesPerMonth,
      bankConnections: entitlements.limits.bankConnections,
    };
  }

  return PLAN_LIMITS[getWorkspacePlan(workspaceId)];
}

export function getUserUsage(userId: string): Record<string, UsageSnapshot> {
  const state = loadState();
  return Object.fromEntries(
    Object.entries(state.usageByUser[userId] ?? {}).map(([month, snapshot]) => [month, cloneUsageSnapshot(snapshot)]),
  );
}

export async function setUserUsage(userId: string, usage: Record<string, UsageSnapshot>): Promise<void> {
  const state = loadState();
  await persistState({
    ...state,
    usageByUser: setScopedUsage(state.usageByUser, userId, usage),
  });
}

export function getWorkspaceUsage(workspaceId: string): Record<string, UsageSnapshot> {
  const state = loadState();
  return Object.fromEntries(
    Object.entries(state.usageByWorkspace[workspaceId] ?? {}).map(([month, snapshot]) => [
      month,
      cloneUsageSnapshot(snapshot),
    ]),
  );
}

export async function setWorkspaceUsage(workspaceId: string, usage: Record<string, UsageSnapshot>): Promise<void> {
  const state = loadState();
  await persistState({
    ...state,
    usageByWorkspace: setScopedUsage(state.usageByWorkspace, workspaceId, usage),
  });
}

export function getMonthlyCount(userId: string, resource: ResourceKind): number {
  return getMonthlyUsage(loadState().usageByUser, userId, currentMonthKey())[resource];
}

export function getWorkspaceMonthlyCount(workspaceId: string, resource: ResourceKind): number {
  return getMonthlyUsage(loadState().usageByWorkspace, workspaceId, currentMonthKey())[resource];
}

export async function incrementMonthlyUsage(userId: string, resource: ResourceKind, amount = 1): Promise<number> {
  const state = loadState();
  const { nextUsageByScope, total } = incrementScopedUsage(state.usageByUser, userId, resource, amount);

  await persistState({
    ...state,
    usageByUser: nextUsageByScope,
  });

  return total;
}

export async function incrementWorkspaceMonthlyUsage(workspaceId: string, resource: ResourceKind, amount = 1): Promise<number> {
  const state = loadState();
  const { nextUsageByScope, total } = incrementScopedUsage(state.usageByWorkspace, workspaceId, resource, amount);
  const event: WorkspaceUsageEvent = {
    id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    workspaceId,
    resource,
    amount,
    at: new Date().toISOString(),
  };

  await persistState({
    ...state,
    usageByWorkspace: nextUsageByScope,
    usageEventsByWorkspace: {
      ...state.usageEventsByWorkspace,
      [workspaceId]: [...(state.usageEventsByWorkspace[workspaceId] ?? []), event].slice(-5000),
    },
  });

  return total;
}

export async function recordWorkspaceUsage(
  workspaceId: string,
  params: {
    resource: ResourceKind;
    amount?: number;
    userId?: string;
    at?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<number> {
  const amount = params.amount ?? 1;
  const state = loadState();
  const { nextUsageByScope, total } = incrementScopedUsage(state.usageByWorkspace, workspaceId, params.resource, amount);
  const event: WorkspaceUsageEvent = {
    id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    workspaceId,
    userId: params.userId,
    resource: params.resource,
    amount,
    at: params.at || new Date().toISOString(),
    metadata: params.metadata,
  };

  await persistState({
    ...state,
    usageByWorkspace: nextUsageByScope,
    usageEventsByWorkspace: {
      ...state.usageEventsByWorkspace,
      [workspaceId]: [...(state.usageEventsByWorkspace[workspaceId] ?? []), event].slice(-5000),
    },
  });

  return total;
}

export async function resetWorkspaceUsage(workspaceId: string, monthKey?: string): Promise<void> {
  const state = loadState();
  const nextUsageByWorkspace = { ...state.usageByWorkspace };

  if (!nextUsageByWorkspace[workspaceId]) {
    return;
  }

  if (monthKey) {
    const nextMonthUsage = { ...(nextUsageByWorkspace[workspaceId] || {}) };
    delete nextMonthUsage[monthKey];
    nextUsageByWorkspace[workspaceId] = nextMonthUsage;
  } else {
    delete nextUsageByWorkspace[workspaceId];
  }

  await persistState({
    ...state,
    usageByWorkspace: nextUsageByWorkspace,
  });
}

export function isWithinLimit(userId: string, resource: ResourceKind, amount = 1): boolean {
  const plan = getUserPlan(userId);
  const limit = PLAN_LIMITS[plan][resource];
  const current = getMonthlyCount(userId, resource);
  return current + amount <= limit;
}

export function isWorkspaceWithinLimit(workspaceId: string, resource: ResourceKind, amount = 1): boolean {
  const limit = getWorkspaceLimits(workspaceId)[resource];
  const current = getWorkspaceMonthlyCount(workspaceId, resource);
  return current + amount <= limit;
}

export function resetSaasStoreForTests(): void {
  stateCache = cloneState(EMPTY_STATE);

  const filePath = getStoreFilePath(DEFAULT_STORE_FILE);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

export async function appendBillingHook(userId: string, payload: BillingHookPayload): Promise<void> {
  const state = loadState();
  await persistState({
    ...state,
    billingHooksByUser: appendScopedBillingHook(state.billingHooksByUser, userId, payload),
  });
}

export async function appendWorkspaceBillingHook(workspaceId: string, payload: BillingHookPayload): Promise<void> {
  const state = loadState();
  await persistState({
    ...state,
    billingHooksByWorkspace: appendScopedBillingHook(state.billingHooksByWorkspace, workspaceId, payload),
  });
}

export function getBillingHookCount(userId: string): number {
  return (loadState().billingHooksByUser[userId] ?? []).length;
}

export function getWorkspaceBillingHookCount(workspaceId: string): number {
  return (loadState().billingHooksByWorkspace[workspaceId] ?? []).length;
}

export function getBillingHooksForUser(userId: string): BillingHookPayload[] {
  return (loadState().billingHooksByUser[userId] ?? []).map((hook) => ({ ...hook }));
}

export function getBillingHooksForWorkspace(workspaceId: string): BillingHookPayload[] {
  return (loadState().billingHooksByWorkspace[workspaceId] ?? []).map((hook) => ({ ...hook }));
}

export function getWorkspaceUsageEvents(
  workspaceId: string,
  filters: {
    from?: string;
    to?: string;
    resource?: ResourceKind;
    limit?: number;
  } = {},
): WorkspaceUsageEvent[] {
  let events = (loadState().usageEventsByWorkspace[workspaceId] ?? []).map((event) => ({ ...event }));

  if (filters.resource) {
    events = events.filter((event) => event.resource === filters.resource);
  }

  if (filters.from) {
    const from = new Date(filters.from).getTime();
    events = events.filter((event) => new Date(event.at).getTime() >= from);
  }

  if (filters.to) {
    const to = new Date(filters.to).getTime();
    events = events.filter((event) => new Date(event.at).getTime() <= to);
  }

  const reversed = [...events].reverse();
  return filters.limit ? reversed.slice(0, filters.limit) : reversed;
}

export function getWorkspaceMeteringSummary(
  workspaceId: string,
  filters: {
    from?: string;
    to?: string;
    resource?: ResourceKind;
  } = {},
): {
  totals: UsageSnapshot;
  months: Record<string, UsageSnapshot>;
} {
  const usageByMonth = getWorkspaceUsage(workspaceId);
  const months = Object.fromEntries(
    Object.entries(usageByMonth).filter(([monthKey]) => {
      const monthDate = new Date(`${monthKey}-01T00:00:00.000Z`).getTime();
      if (filters.from && monthDate < new Date(filters.from).getTime()) {
        return false;
      }
      if (filters.to && monthDate > new Date(filters.to).getTime()) {
        return false;
      }
      return true;
    }),
  );

  const totals = Object.values(months).reduce<UsageSnapshot>(
    (acc, snapshot) => ({
      transactions: acc.transactions + (filters.resource === 'transactions' || !filters.resource ? snapshot.transactions : 0),
      aiQueries: acc.aiQueries + (filters.resource === 'aiQueries' || !filters.resource ? snapshot.aiQueries : 0),
      bankConnections: acc.bankConnections + (filters.resource === 'bankConnections' || !filters.resource ? snapshot.bankConnections : 0),
    }),
    { transactions: 0, aiQueries: 0, bankConnections: 0 },
  );

  return { totals, months };
}

export async function initializeSaasStorePersistence(): Promise<void> {
  const normalized = await loadWorkspaceSaasState();
  if (normalized) {
    const persisted = areLegacyStateBlobsDisabled()
      ? null
      : await loadJsonState<SaasStoreState>(POSTGRES_STATE_KEY);
    stateCache = {
      usageByWorkspace: normalizeUsageMap(normalized.usageByWorkspace),
      usageByUser: normalizeUsageMap(persisted?.usageByUser),
      billingHooksByWorkspace: Object.fromEntries(
        Object.entries(normalized.billingHooksByWorkspace).map(([workspaceId, hooks]) => [
          workspaceId,
          hooks.map((hook) => ({
            userId: hook.userId,
            workspaceId: hook.workspaceId,
            plan: hook.plan,
            event: hook.event,
            resource: hook.resource,
            amount: hook.amount,
            at: hook.at,
            metadata: hook.metadata,
          })),
        ]),
      ),
      billingHooksByUser: normalizeBillingHookMap(persisted?.billingHooksByUser),
      usageEventsByWorkspace: normalizeUsageEventMap(normalized.usageEventsByWorkspace),
      userPlans: Object.fromEntries(
        Object.entries(persisted?.userPlans ?? {}).filter(([, plan]) => plan === 'free' || plan === 'pro'),
      ) as Record<string, PlanId>,
    };
    return;
  }

  if (areLegacyStateBlobsDisabled()) {
    return;
  }

  const persisted = await loadJsonState<SaasStoreState>(POSTGRES_STATE_KEY);
  if (!persisted) {
    return;
  }

  stateCache = {
    usageByWorkspace: normalizeUsageMap(persisted.usageByWorkspace),
    usageByUser: normalizeUsageMap(persisted.usageByUser),
    billingHooksByWorkspace: normalizeBillingHookMap(persisted.billingHooksByWorkspace),
    billingHooksByUser: normalizeBillingHookMap(persisted.billingHooksByUser),
    usageEventsByWorkspace: normalizeUsageEventMap(persisted.usageEventsByWorkspace),
    userPlans: Object.fromEntries(
      Object.entries(persisted.userPlans ?? {}).filter(([, plan]) => plan === 'free' || plan === 'pro'),
    ) as Record<string, PlanId>,
  };

  void saveWorkspaceSaasState({
    usageByWorkspace: stateCache.usageByWorkspace,
    usageEventsByWorkspace: stateCache.usageEventsByWorkspace,
    billingHooksByWorkspace: Object.fromEntries(
      Object.entries(stateCache.billingHooksByWorkspace).map(([workspaceId, hooks]) => [
        workspaceId,
        hooks.map((hook, index) => ({
          id: `${workspaceId}_${hook.at}_${index}`.replace(/[^a-zA-Z0-9:_-]/g, '_'),
          workspaceId,
          userId: hook.userId,
          plan: hook.plan,
          event: hook.event,
          resource: hook.resource,
          amount: hook.amount,
          at: hook.at,
          metadata: hook.metadata,
        })),
      ]),
    ),
  }).catch((error) => {
    logger.warn({
      error,
      key: POSTGRES_STATE_KEY,
      workspaceCount: Object.keys(stateCache?.usageByWorkspace ?? {}).length,
      billingHookWorkspaceCount: Object.keys(stateCache?.billingHooksByWorkspace ?? {}).length,
      usageEventWorkspaceCount: Object.keys(stateCache?.usageEventsByWorkspace ?? {}).length,
      fallback: 'saas-backfill-to-postgres-failed',
    }, 'Failed to backfill normalized SaaS store to Postgres');
  });
}
