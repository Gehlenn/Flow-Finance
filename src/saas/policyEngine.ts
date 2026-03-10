import { PlanLimits, PlanName, ResourceKind, SaaSContext, UserRole } from './types';

const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
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

const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  member: new Set([
    'transactions:create',
    'transactions:update',
    'transactions:read',
    'accounts:create',
    'accounts:update',
    'accounts:read',
    'goals:create',
    'goals:update',
    'goals:read',
    'subscriptions:create',
    'subscriptions:update',
    'subscriptions:delete',
    'subscriptions:read',
    'bankConnections:create',
    'bankConnections:update',
    'bankConnections:delete',
    'bankConnections:read',
    'simulations:run',
  ]),
  admin: new Set(['*']),
};

export function getPlanLimits(plan: PlanName): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function canPerform(context: SaaSContext, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[context.role];
  if (!permissions) {
    return false;
  }

  return permissions.has('*') || permissions.has(permission);
}

export function assertCanPerform(context: SaaSContext, permission: string): void {
  if (!canPerform(context, permission)) {
    throw new Error(`Permission denied for ${permission}`);
  }
}

export function getPlanLimit(plan: PlanName, resource: ResourceKind): number {
  const limits = getPlanLimits(plan);

  if (resource === 'transactions') {
    return limits.transactionsPerMonth;
  }

  if (resource === 'aiQueries') {
    return limits.aiQueriesPerMonth;
  }

  return limits.bankConnections;
}

export function assertWithinPlanLimit(
  context: SaaSContext,
  resource: ResourceKind,
  currentUsage: number,
  increment = 1
): void {
  const limit = getPlanLimit(context.plan, resource);

  if (currentUsage + increment > limit) {
    throw new Error(`Plan limit reached for ${resource}. Limit: ${limit}`);
  }
}
