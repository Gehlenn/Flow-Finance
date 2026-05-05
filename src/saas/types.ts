export type PlanName = 'free' | 'pro';

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export type ResourceKind = 'transactions' | 'aiQueries' | 'bankConnections';

export type FeatureKey =
  | 'advancedInsights'
  | 'multiBankSync'
  | 'adminConsole'
  | 'prioritySupport'
  | 'billingManagement';

export interface SaaSContext {
  userId: string;
  role: UserRole;
  plan: PlanName;
}

export interface PlanLimits {
  transactionsPerMonth: number;
  aiQueriesPerMonth: number;
  bankConnections: number;
}

export interface BillingHookPayload {
  userId: string;
  workspaceId?: string;
  plan: PlanName;
  event: 'usage_recorded' | 'limit_reached' | 'upgrade_required' | 'plan_changed';
  resource: ResourceKind;
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
}
