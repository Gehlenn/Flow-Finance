export const PLAN_IDS = ['free', 'pro'] as const;
export type PlanId = typeof PLAN_IDS[number];
export type PlanName = PlanId;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && PLAN_IDS.some((plan) => plan === value);
}

export const RESOURCE_KINDS = ['transactions', 'aiQueries', 'bankConnections'] as const;
export type ResourceKind = typeof RESOURCE_KINDS[number];

export function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === 'string' && RESOURCE_KINDS.some((resource) => resource === value);
}

export const FEATURE_KEYS = [
  'advancedInsights',
  'multiBankSync',
  'adminConsole',
  'prioritySupport',
  'billingManagement',
] as const;
export type FeatureKey = typeof FEATURE_KEYS[number];

export const BILLING_HOOK_EVENTS = [
  'usage_recorded',
  'limit_reached',
  'upgrade_required',
  'plan_changed',
] as const;
export type BillingHookEvent = typeof BILLING_HOOK_EVENTS[number];

export interface PlanLimits {
  transactionsPerMonth: number;
  aiQueriesPerMonth: number;
  bankConnections: number;
}

export type UsageSnapshot = Record<ResourceKind, number>;

export interface PlanEntitlements {
  features: FeatureKey[];
  limits: PlanLimits;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    transactionsPerMonth: 500,
    aiQueriesPerMonth: 100,
    bankConnections: 1,
  },
  pro: {
    transactionsPerMonth: 10000,
    aiQueriesPerMonth: 5000,
    bankConnections: 20,
  },
};

export const PLAN_FEATURES: Record<PlanId, FeatureKey[]> = {
  free: ['advancedInsights'],
  pro: ['advancedInsights', 'multiBankSync', 'adminConsole', 'prioritySupport', 'billingManagement'],
};

function toUsageSnapshot(limits: PlanLimits): UsageSnapshot {
  return {
    transactions: limits.transactionsPerMonth,
    aiQueries: limits.aiQueriesPerMonth,
    bankConnections: limits.bankConnections,
  };
}

export const PLAN_USAGE_LIMITS = {
  free: toUsageSnapshot(PLAN_LIMITS.free),
  pro: toUsageSnapshot(PLAN_LIMITS.pro),
} satisfies Record<PlanId, UsageSnapshot>;

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function getPlanFeatures(plan: string): FeatureKey[] {
  return isPlanId(plan) ? PLAN_FEATURES[plan] : [];
}

export function getPlanEntitlements(plan: PlanId): PlanEntitlements {
  return {
    features: [...getPlanFeatures(plan)],
    limits: { ...getPlanLimits(plan) },
  };
}

export function getPlanUsageLimits(plan: PlanId): UsageSnapshot {
  return PLAN_USAGE_LIMITS[plan];
}

export function getPlanLimit(plan: PlanId, resource: ResourceKind): number {
  return getPlanUsageLimits(plan)[resource];
}
