import type { BillingHookPayload, PlanName } from '../saas/types';
import type { UsageSnapshot } from '../saas/usageTracker';

export type WorkspaceUsageSnapshot = UsageSnapshot;

export interface WorkspaceBillingState {
  workspaceId: string;
  tenantId: string;
  plan: PlanName;
  status: 'active';
  updatedAt: string;
  updatedByUserId: string;
}

export interface WorkspaceBillingHookDocument extends BillingHookPayload {
  id: string;
  tenantId: string;
  workspaceId: string;
  createdAt: string;
}

export const DEFAULT_USAGE: WorkspaceUsageSnapshot = {
  transactions: 0,
  aiQueries: 0,
  bankConnections: 0,
};
