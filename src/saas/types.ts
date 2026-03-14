export type PlanName = 'free' | 'pro';

export type UserRole = 'member' | 'admin';

export type ResourceKind = 'transactions' | 'aiQueries' | 'bankConnections';

export type FeatureKey =
  | 'advancedInsights'
  | 'multiBankSync'
  | 'adminConsole'
  | 'prioritySupport';

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
  plan: PlanName;
  event: 'usage_recorded' | 'limit_reached' | 'upgrade_required';
  resource: ResourceKind;
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
}
