import { Account } from '../../models/Account';
import { Goal, Transaction, Alert, Reminder, Receivable } from '../../types';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type WorkspaceSummary = {
  workspaceId: string;
  tenantId: string;
  name: string;
  tenantName?: string;
  plan: 'free' | 'pro';
  role: WorkspaceRole;
  isDefault: boolean;
};

export type TenantDocument = {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  createdAt: string;
  updatedAt: string;
  ownerUserId: string;
};

export type WorkspaceDocument = {
  id: string;
  tenantId: string;
  tenantName?: string;
  name: string;
  plan: 'free' | 'pro';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMemberDocument = {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: 'active' | 'invited' | 'disabled';
  createdAt: string;
  updatedAt: string;
};

export type TenantMemberDocument = {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
};

export type AuditLogDocument = {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogCursor = {
  createdAt: string;
  id: string;
};

export type WorkspaceInsightDocument = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  severity?: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WorkspaceImportDocument = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  user_id: string;
  source: string;
  status: 'pending' | 'completed' | 'failed';
  imported_count?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WorkspaceSubscriptionDocument = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  merchant?: string;
  amount: number;
  cycle: 'monthly' | 'weekly' | 'annual' | 'unknown';
  status: 'active' | 'paused' | 'cancelled';
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserIdentity = {
  userId: string;
  name?: string | null;
  email?: string | null;
};

export type SyncEntity = 'accounts' | 'transactions' | 'goals' | 'reminders' | 'receivables';
export type WorkspaceScopedEntity = SyncEntity | 'insights' | 'imports' | 'subscriptions';

export type ProfileState = {
  name: string | null;
  theme: 'light' | 'dark';
  alerts: Alert[];
  reminders: Reminder[];
};

export type EntityState = {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  reminders: Reminder[];
  receivables: Receivable[];
};

export type SyncEntityIdMap = Record<string, string>;
