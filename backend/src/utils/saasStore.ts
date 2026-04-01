type ResourceKind = 'transactions' | 'aiQueries' | 'bankConnections';

type UsageSnapshot = {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
};

type BillingHookPayload = {
  userId: string;
  plan: 'free' | 'pro';
  event: 'usage_recorded' | 'limit_reached' | 'upgrade_required';
  resource: ResourceKind;
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
};

const usageByUser = new Map<string, Record<string, UsageSnapshot>>();
const billingHooksByUser = new Map<string, BillingHookPayload[]>();

// ─── Plan limits ─────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<'free' | 'pro', UsageSnapshot> = {
  free: { transactions: 500, aiQueries: 100, bankConnections: 1 },
  pro:  { transactions: 10000, aiQueries: 5000, bankConnections: 20 },
};

// In-memory plan store (userId → plan). Pode ser substituído por DB futuramente.
const userPlans = new Map<string, 'free' | 'pro'>();

export function getUserPlan(userId: string): 'free' | 'pro' {
  return userPlans.get(userId) || 'free';
}

export function setUserPlan(userId: string, plan: 'free' | 'pro'): void {
  userPlans.set(userId, plan);
}

// ─── Monthly usage tracking ───────────────────────────────────────────────────

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthlyUsage(userId: string, monthKey: string): UsageSnapshot {
  const byMonth = usageByUser.get(userId) || {};
  return byMonth[monthKey] || { transactions: 0, aiQueries: 0, bankConnections: 0 };
}

export function getUserUsage(userId: string): Record<string, UsageSnapshot> {
  return usageByUser.get(userId) || {};
}

export function setUserUsage(userId: string, usage: Record<string, UsageSnapshot>): void {
  usageByUser.set(userId, usage);
}

/** Returns current monthly count for a resource. */
export function getMonthlyCount(userId: string, resource: ResourceKind): number {
  return getMonthlyUsage(userId, currentMonthKey())[resource];
}

/** Increments resource counter by `amount` and returns new total. */
export function incrementMonthlyUsage(userId: string, resource: ResourceKind, amount = 1): number {
  const monthKey = currentMonthKey();
  const byMonth = usageByUser.get(userId) || {};
  const snapshot = byMonth[monthKey] || { transactions: 0, aiQueries: 0, bankConnections: 0 };
  snapshot[resource] += amount;
  usageByUser.set(userId, { ...byMonth, [monthKey]: snapshot });
  return snapshot[resource];
}

/** Checks whether the user is within limits for a resource (before incrementing). */
export function isWithinLimit(userId: string, resource: ResourceKind, amount = 1): boolean {
  const plan = getUserPlan(userId);
  const limit = PLAN_LIMITS[plan][resource];
  const current = getMonthlyCount(userId, resource);
  return current + amount <= limit;
}

/** Resets entire store (for tests). */
export function resetSaasStoreForTests(): void {
  usageByUser.clear();
  billingHooksByUser.clear();
  userPlans.clear();
}

export function appendBillingHook(userId: string, payload: BillingHookPayload): void {
  const current = billingHooksByUser.get(userId) || [];
  current.push(payload);
  billingHooksByUser.set(userId, current.slice(-1000));
}

export function getBillingHookCount(userId: string): number {
  return (billingHooksByUser.get(userId) || []).length;
}
