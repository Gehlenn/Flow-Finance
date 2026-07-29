import type {
  BillingHookEvent as CatalogBillingHookEvent,
  PlanId as CatalogPlanId,
  ResourceKind as CatalogResourceKind,
} from '../../shared/saasCatalog';

export type ResourceKind = CatalogResourceKind;

export type UsageSnapshot = {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
};

export type PlanId = CatalogPlanId;

export type BillingHookEvent = CatalogBillingHookEvent;

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
