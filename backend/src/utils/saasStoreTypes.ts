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
