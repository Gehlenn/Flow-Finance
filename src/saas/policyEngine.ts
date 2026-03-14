import { AppError } from '../errors/AppError';
import { FeatureKey, PlanLimits, PlanName, ResourceKind, SaaSContext, UserRole } from './types';

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

const PLAN_FEATURES: Record<PlanName, FeatureKey[]> = {
  free: ['advancedInsights'],
  pro: ['advancedInsights', 'multiBankSync', 'adminConsole', 'prioritySupport'],
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
    throw new AppError('Permission denied', 403, {
      permission,
      role: context.role,
      plan: context.plan,
    });
  }
}

export function getPlanFeatures(plan: PlanName): FeatureKey[] {
  return PLAN_FEATURES[plan] || [];
}

export function hasFeature(context: SaaSContext, feature: FeatureKey): boolean {
  if (context.role === 'admin') {
    return true;
  }

  return getPlanFeatures(context.plan).includes(feature);
}

export function assertFeatureEnabled(context: SaaSContext, feature: FeatureKey): void {
  if (!hasFeature(context, feature)) {
    throw new AppError('Feature unavailable for current plan', 402, {
      feature,
      plan: context.plan,
    });
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
    throw new AppError('Plan limit reached', 429, {
      resource,
      limit,
      currentUsage,
      increment,
      plan: context.plan,
    });
  }
}
