import type { Tenant, Workspace, WorkspaceUser, WorkspaceUserPreference } from '../../types';

export type PersistedAuditEventRow = {
  id: string;
  at: string;
  tenantId?: string;
  workspaceId?: string;
  userId?: string;
  email?: string;
  action: string;
  status: string;
  resourceType?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  metadata?: Record<string, unknown>;
};

export type PersistedWorkspaceStoreState = {
  tenants: Tenant[];
  workspaces: Workspace[];
  workspaceUsers: WorkspaceUser[];
  userPreferences: WorkspaceUserPreference[];
};

export type PersistedUsageSnapshot = {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
};

export type PersistedWorkspaceUsageEventRow = {
  id: string;
  workspaceId: string;
  userId?: string;
  resource: 'transactions' | 'aiQueries' | 'bankConnections';
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
};

export type PersistedWorkspaceBillingHookRow = {
  id: string;
  workspaceId: string;
  userId?: string;
  plan: 'free' | 'pro';
  event: 'usage_recorded' | 'limit_reached' | 'upgrade_required' | 'plan_changed';
  resource?: 'transactions' | 'aiQueries' | 'bankConnections';
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
};

export type PersistedWorkspaceSaasState = {
  usageByWorkspace: Record<string, Record<string, PersistedUsageSnapshot>>;
  billingHooksByWorkspace: Record<string, PersistedWorkspaceBillingHookRow[]>;
  usageEventsByWorkspace: Record<string, PersistedWorkspaceUsageEventRow[]>;
};

export type PersistedDomainEventRow = {
  id: string;
  workspaceId: string;
  tenantId?: string;
  userId?: string;
  aggregateId?: string;
  aggregateType?: string;
  type: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};
