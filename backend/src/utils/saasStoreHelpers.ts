import fs from 'fs';
import path from 'path';
import logger from '../config/logger';
import type { BillingHookPayload, PlanId, ResourceKind, UsageSnapshot, WorkspaceUsageEvent } from './saasStoreTypes';

export const EMPTY_USAGE: UsageSnapshot = {
  transactions: 0,
  aiQueries: 0,
  bankConnections: 0,
};

export const EMPTY_STATE = {
  usageByWorkspace: {},
  usageByUser: {},
  billingHooksByWorkspace: {},
  billingHooksByUser: {},
  usageEventsByWorkspace: {},
  userPlans: {},
};

export function areLegacyStateBlobsDisabled(): boolean {
  return String(process.env.DISABLE_LEGACY_STATE_BLOBS || '').toLowerCase() === 'true';
}

export function cloneUsageSnapshot(snapshot?: Partial<UsageSnapshot>): UsageSnapshot {
  return {
    transactions: snapshot?.transactions ?? 0,
    aiQueries: snapshot?.aiQueries ?? 0,
    bankConnections: snapshot?.bankConnections ?? 0,
  };
}

export function cloneUsageMap(input: Record<string, Record<string, UsageSnapshot>>): Record<string, Record<string, UsageSnapshot>> {
  return Object.fromEntries(
    Object.entries(input).map(([scopeId, usageByMonth]) => [
      scopeId,
      Object.fromEntries(
        Object.entries(usageByMonth).map(([month, snapshot]) => [month, cloneUsageSnapshot(snapshot)]),
      ),
    ]),
  );
}

export function cloneBillingHookMap(input: Record<string, BillingHookPayload[]>): Record<string, BillingHookPayload[]> {
  return Object.fromEntries(
    Object.entries(input).map(([scopeId, hooks]) => [
      scopeId,
      hooks.map((hook) => ({ ...hook, metadata: hook.metadata ? { ...hook.metadata } : undefined })),
    ]),
  );
}

export function cloneUsageEventMap(input: Record<string, WorkspaceUsageEvent[]>): Record<string, WorkspaceUsageEvent[]> {
  return Object.fromEntries(
    Object.entries(input).map(([workspaceId, events]) => [
      workspaceId,
      events.map((event) => ({ ...event, metadata: event.metadata ? { ...event.metadata } : undefined })),
    ]),
  );
}

export function cloneState(state: {
  usageByWorkspace: Record<string, Record<string, UsageSnapshot>>;
  usageByUser: Record<string, Record<string, UsageSnapshot>>;
  billingHooksByWorkspace: Record<string, BillingHookPayload[]>;
  billingHooksByUser: Record<string, BillingHookPayload[]>;
  usageEventsByWorkspace: Record<string, WorkspaceUsageEvent[]>;
  userPlans: Record<string, PlanId>;
}) {
  return {
    usageByWorkspace: cloneUsageMap(state.usageByWorkspace),
    usageByUser: cloneUsageMap(state.usageByUser),
    billingHooksByWorkspace: cloneBillingHookMap(state.billingHooksByWorkspace),
    billingHooksByUser: cloneBillingHookMap(state.billingHooksByUser),
    usageEventsByWorkspace: cloneUsageEventMap(state.usageEventsByWorkspace),
    userPlans: { ...state.userPlans },
  };
}

export function getStoreFilePath(defaultStoreFile: string): string {
  return process.env.SAAS_STORE_FILE || defaultStoreFile;
}

export function ensureStoreDirExists(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function normalizeUsageMap(input?: Record<string, Record<string, UsageSnapshot>>): Record<string, Record<string, UsageSnapshot>> {
  return Object.fromEntries(
    Object.entries(input ?? {}).map(([scopeId, usageByMonth]) => [
      scopeId,
      Object.fromEntries(
        Object.entries(usageByMonth ?? {}).map(([month, snapshot]) => [month, cloneUsageSnapshot(snapshot)]),
      ),
    ]),
  );
}

export function normalizeBillingHookMap(input?: Record<string, BillingHookPayload[]>): Record<string, BillingHookPayload[]> {
  return Object.fromEntries(
    Object.entries(input ?? {}).map(([scopeId, hooks]) => [
      scopeId,
      Array.isArray(hooks) ? hooks.map((hook) => ({ ...hook })) : [],
    ]),
  );
}

export function normalizeUsageEventMap(input?: Record<string, WorkspaceUsageEvent[]>): Record<string, WorkspaceUsageEvent[]> {
  return Object.fromEntries(
    Object.entries(input ?? {}).map(([workspaceId, events]) => [
      workspaceId,
      Array.isArray(events) ? events.map((event) => ({ ...event })) : [],
    ]),
  );
}

export function currentMonthKey(): string {
  const currentDate = new Date();
  return `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getMonthlyUsage(scopedUsage: Record<string, Record<string, UsageSnapshot>>, scopeId: string, monthKey: string): UsageSnapshot {
  return cloneUsageSnapshot(scopedUsage[scopeId]?.[monthKey] ?? EMPTY_USAGE);
}

export function setScopedUsage(
  scopedUsage: Record<string, Record<string, UsageSnapshot>>,
  scopeId: string,
  usage: Record<string, UsageSnapshot>,
): Record<string, Record<string, UsageSnapshot>> {
  return {
    ...scopedUsage,
    [scopeId]: Object.fromEntries(
      Object.entries(usage).map(([month, snapshot]) => [month, cloneUsageSnapshot(snapshot)]),
    ),
  };
}

export function incrementScopedUsage(
  scopedUsage: Record<string, Record<string, UsageSnapshot>>,
  scopeId: string,
  resource: ResourceKind,
  amount = 1,
): {
  nextUsageByScope: Record<string, Record<string, UsageSnapshot>>;
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

export function appendScopedBillingHook(
  scopedHooks: Record<string, BillingHookPayload[]>,
  scopeId: string,
  payload: BillingHookPayload,
): Record<string, BillingHookPayload[]> {
  const currentHooks = scopedHooks[scopeId] ?? [];
  return {
    ...scopedHooks,
    [scopeId]: [...currentHooks, payload].slice(-1000),
  };
}

export function persistLegacyState(filePath: string, state: unknown): void {
  ensureStoreDirExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

export function logLegacyStoreLoadFailure(error: unknown, filePath: string): void {
  logger.warn({ error, filePath }, 'Failed to load legacy SaaS store; falling back to empty state');
}
