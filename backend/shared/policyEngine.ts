import { AppError } from './AppError';
import {
  getPlanFeatures as getCatalogPlanFeatures,
  getPlanLimit as getCatalogPlanLimit,
  getPlanLimits as getCatalogPlanLimits,
  type FeatureKey,
  type PlanId,
  type PlanLimits,
  type ResourceKind,
} from './saasCatalog';

export type PlanName = PlanId;
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';
export type { FeatureKey, PlanLimits, ResourceKind } from './saasCatalog';
export interface SaaSContext {
  userId: string;
  role: UserRole;
  plan: PlanName;
}
const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  owner: new Set(['*']),
  viewer: new Set([
    'ai:use',
    'transactions:read',
    'accounts:read',
    'goals:read',
    'subscriptions:read',
    'bankConnections:read',
    'finance:read',
    'sync:read',
    'workspace:read',
  ]),
  member: new Set([
    'ai:use',
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
    'finance:read',
    'sync:read',
    'sync:write',
    'workspace:read',
  ]),
  admin: new Set([
    'workspace:read',
    'workspace:update',
    'workspace:members:read',
    'workspace:members:add',
    'workspace:members:remove',
    'transactions:delete',
    'goals:delete',
    'accounts:delete',
    'subscriptions:delete',
    'admin:read',
    'billing:read',
    'billing:manage',
  ]),
};

export function getPlanLimits(plan: PlanName): PlanLimits {
  return getCatalogPlanLimits(plan);
}

export function canPerform(context: SaaSContext, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[context.role];
  if (!permissions) {
    return false;
  }
  if (permissions.has('*') || permissions.has(permission)) {
    return true;
  }
  if (context.role === 'admin') {
    return ROLE_PERMISSIONS.member.has(permission) || ROLE_PERMISSIONS.viewer.has(permission);
  }
  if (context.role === 'member') {
    return ROLE_PERMISSIONS.viewer.has(permission);
  }
  return false;
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

export function getPlanFeatures(plan: string): FeatureKey[] {
  return getCatalogPlanFeatures(plan);
}

export function hasFeature(context: SaaSContext, feature: FeatureKey): boolean {
  if (context.role === 'admin' || context.role === 'owner') {
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
  return getCatalogPlanLimit(plan, resource);
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
