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

const EMPTY_USAGE: UsageSnapshot = {
  transactions: 0,
  aiQueries: 0,
  bankConnections: 0,
};

const EMPTY_STATE: SaasStoreState = {
  usageByWorkspace: {},
  usageByUser: {},
  billingHooksByWorkspace: {},
  billingHooksByUser: {},
  usageEventsByWorkspace: {},
  userPlans: {},
};

const DEFAULT_STORE_FILE = path.resolve(__dirname, '../../data/saas-store.json');
const POSTGRES_STATE_KEY = 'saas_store_state';

let stateCache: SaasStoreState | null = null;

function areLegacyStateBlobsDisabled(): boolean {
  return String(process.env.DISABLE_LEGACY_STATE_BLOBS || '').toLowerCase() === 'true';
}

export const PLAN_LIMITS: Record<PlanId, UsageSnapshot> = {
  free: { transactions: 500, aiQueries: 100, bankConnections: 1 },
  pro: { transactions: 10000, aiQueries: 5000, bankConnections: 20 },
};

function cloneUsageSnapshot(snapshot?: Partial<UsageSnapshot>): UsageSnapshot {
  return {
    transactions: snapshot?.transactions ?? 0,
    aiQueries: snapshot?.aiQueries ?? 0,
    bankConnections: snapshot?.bankConnections ?? 0,
  };
}

function cloneUsageMap(input: ScopedUsageMap): ScopedUsageMap {
  return Object.fromEntries(
    Object.entries(input).map(([scopeId, usageByMonth]) => [
      scopeId,
      Object.fromEntries(
        Object.entries(usageByMonth).map(([month, snapshot]) => [month, cloneUsageSnapshot(snapshot)]),
      ),
    ]),
  );
}

function cloneBillingHookMap(input: ScopedBillingHookMap): ScopedBillingHookMap {
  return Object.fromEntries(
    Object.entries(input).map(([scopeId, hooks]) => [
      scopeId,
      hooks.map((hook) => ({ ...hook, metadata: hook.metadata ? { ...hook.metadata } : undefined })),
    ]),
  );
}

function cloneState(state: SaasStoreState): SaasStoreState {
  return {
    usageByWorkspace: cloneUsageMap(state.usageByWorkspace),
    usageByUser: cloneUsageMap(state.usageByUser),
    billingHooksByWorkspace: cloneBillingHookMap(state.billingHooksByWorkspace),
    billingHooksByUser: cloneBillingHookMap(state.billingHooksByUser),
    usageEventsByWorkspace: Object.fromEntries(
      Object.entries(state.usageEventsByWorkspace).map(([workspaceId, events]) => [
        workspaceId,
        events.map((event) => ({ ...event, metadata: event.metadata ? { ...event.metadata } : undefined })),
      ]),
    ),
    userPlans: { ...state.userPlans },
  };
}

function getStoreFilePath(): string {
  return process.env.SAAS_STORE_FILE || DEFAULT_STORE_FILE;
}

function ensureStoreDirExists(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeUsageMap(input?: ScopedUsageMap): ScopedUsageMap {
  return Object.fromEntries(
    Object.entries(input ?? {}).map(([scopeId, usageByMonth]) => [
      scopeId,
      Object.fromEntries(
        Object.entries(usageByMonth ?? {}).map(([month, snapshot]) => [month, cloneUsageSnapshot(snapshot)]),
      ),
    ]),
  );
}

function normalizeBillingHookMap(input?: ScopedBillingHookMap): ScopedBillingHookMap {
  return Object.fromEntries(
    Object.entries(input ?? {}).map(([scopeId, hooks]) => [
      scopeId,
      Array.isArray(hooks) ? hooks.map((hook) => ({ ...hook })) : [],
    ]),
  );
}

function normalizeUsageEventMap(input?: Record<string, WorkspaceUsageEvent[]>): Record<string, WorkspaceUsageEvent[]> {
  return Object.fromEntries(
    Object.entries(input ?? {}).map(([workspaceId, events]) => [
      workspaceId,
      Array.isArray(events) ? events.map((event) => ({ ...event })) : [],
    ]),
  );
}

function loadState(): SaasStoreState {
  if (stateCache) {
    return stateCache;
  }

  if (areLegacyStateBlobsDisabled()) {
    stateCache = cloneState(EMPTY_STATE);
    return stateCache;
  }

  const filePath = getStoreFilePath();

  try {
    if (!fs.existsSync(filePath)) {
      ensureStoreDirExists(filePath);
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
  } catch {
    stateCache = cloneState(EMPTY_STATE);
  }

  return stateCache;
}

function persistState(state: SaasStoreState): void {
  stateCache = cloneState(state);
  if (!areLegacyStateBlobsDisabled()) {
    const filePath = getStoreFilePath();
    ensureStoreDirExists(filePath);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  }
  void saveWorkspaceSaasState({
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
  }).catch((error) => {
    logger.warn({ error }, 'Failed to persist normalized SaaS store to Postgres');
  });
  if (!areLegacyStateBlobsDisabled()) {
    void saveJsonState(POSTGRES_STATE_KEY, state as unknown as Record<string, unknown>).catch((error) => {
      logger.warn({ error }, 'Failed to persist SaaS store to Postgres');
    });
  }
}

function currentMonthKey(): string {
  const currentDate = new Date();
  return `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthlyUsage(scopedUsage: ScopedUsageMap, scopeId: string, monthKey: string): UsageSnapshot {
  return cloneUsageSnapshot(scopedUsage[scopeId]?.[monthKey] ?? EMPTY_USAGE);
}

function setScopedUsage(scopedUsage: ScopedUsageMap, scopeId: string, usage: Record<string, UsageSnapshot>): ScopedUsageMap {
  return {
    ...scopedUsage,
    [scopeId]: Object.fromEntries(
      Object.entries(usage).map(([month, snapshot]) => [month, cloneUsageSnapshot(snapshot)]),
    ),
  };
}

function incrementScopedUsage(scopedUsage: ScopedUsageMap, scopeId: string, resource: ResourceKind, amount = 1): {
  nextUsageByScope: ScopedUsageMap;
  total: number;
} {
  const monthKey = currentMonthKey();
  const existingUsage = scopedUsage[scopeId] ?? {};
  const nextSnapshot = cloneUsageSnapshot(existingUsage[monthKey] ?? EMPTY_USAGE);
  nextSnapshot[resource] += amount;

  return {
    nextUsageByScope: {
      ...scopedUsage,
      [scopeId]: {
        ...existingUsage,
        [monthKey]: nextSnapshot,
      },
    },
    total: nextSnapshot[resource],
  };
}

function appendScopedBillingHook(scopedHooks: ScopedBillingHookMap, scopeId: string, payload: BillingHookPayload): ScopedBillingHookMap {
  const currentHooks = scopedHooks[scopeId] ?? [];
  return {
    ...scopedHooks,
    [scopeId]: [...currentHooks, payload].slice(-1000),
  };
}

export function getUserPlan(userId: string): PlanId {
  return loadState().userPlans[userId] || 'free';
}

export function setUserPlan(userId: string, plan: PlanId): void {
  const state = loadState();
  persistState({
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

export function setUserUsage(userId: string, usage: Record<string, UsageSnapshot>): void {
  const state = loadState();
  persistState({
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

export function setWorkspaceUsage(workspaceId: string, usage: Record<string, UsageSnapshot>): void {
  const state = loadState();
  persistState({
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

export function incrementMonthlyUsage(userId: string, resource: ResourceKind, amount = 1): number {
  const state = loadState();
  const { nextUsageByScope, total } = incrementScopedUsage(state.usageByUser, userId, resource, amount);

  persistState({
    ...state,
    usageByUser: nextUsageByScope,
  });

  return total;
}

export function incrementWorkspaceMonthlyUsage(workspaceId: string, resource: ResourceKind, amount = 1): number {
  const state = loadState();
  const { nextUsageByScope, total } = incrementScopedUsage(state.usageByWorkspace, workspaceId, resource, amount);
  const event: WorkspaceUsageEvent = {
    id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    workspaceId,
    resource,
    amount,
    at: new Date().toISOString(),
  };

  persistState({
    ...state,
    usageByWorkspace: nextUsageByScope,
    usageEventsByWorkspace: {
      ...state.usageEventsByWorkspace,
      [workspaceId]: [...(state.usageEventsByWorkspace[workspaceId] ?? []), event].slice(-5000),
    },
  });

  return total;
}

export function recordWorkspaceUsage(
  workspaceId: string,
  params: {
    resource: ResourceKind;
    amount?: number;
    userId?: string;
    at?: string;
    metadata?: Record<string, unknown>;
  },
): number {
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

  persistState({
    ...state,
    usageByWorkspace: nextUsageByScope,
    usageEventsByWorkspace: {
      ...state.usageEventsByWorkspace,
      [workspaceId]: [...(state.usageEventsByWorkspace[workspaceId] ?? []), event].slice(-5000),
    },
  });

  return total;
}

export function resetWorkspaceUsage(workspaceId: string, monthKey?: string): void {
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

  persistState({
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

  const filePath = getStoreFilePath();
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

export function appendBillingHook(userId: string, payload: BillingHookPayload): void {
  const state = loadState();
  persistState({
    ...state,
    billingHooksByUser: appendScopedBillingHook(state.billingHooksByUser, userId, payload),
  });
}

export function appendWorkspaceBillingHook(workspaceId: string, payload: BillingHookPayload): void {
  const state = loadState();
  persistState({
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
    logger.warn({ error }, 'Failed to backfill normalized SaaS store to Postgres');
  });
}
