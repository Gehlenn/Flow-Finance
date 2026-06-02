import { Tenant, Workspace, WorkspaceUser, WorkspaceUserPreference } from '../../types';

export function mapTenantRow(row: Record<string, unknown>): Tenant {
  return {
    tenantId: String(row.tenant_id),
    name: String(row.name),
    plan: String(row.plan) as Tenant['plan'],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at || row.created_at)).toISOString(),
  };
}

export function mapWorkspaceRow(row: Record<string, unknown>): Workspace {
  const workspaceId = String(row.workspace_id);
  return {
    workspaceId,
    tenantId: typeof row.tenant_id === 'string' && row.tenant_id.length > 0 ? row.tenant_id : workspaceId,
    name: String(row.name),
    isDefault: typeof row.is_default === 'boolean' ? row.is_default : true,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at || row.created_at)).toISOString(),
    plan: String(row.plan) as Workspace['plan'],
    status: String(row.status || 'active') as Workspace['status'],
    billingEmail: typeof row.billing_email === 'string' ? row.billing_email : undefined,
    billingCustomerId: typeof row.billing_customer_id === 'string' ? row.billing_customer_id : undefined,
    subscription: typeof row.subscription === 'object' && row.subscription !== null
      ? row.subscription as Workspace['subscription']
      : undefined,
    entitlements: typeof row.entitlements === 'object' && row.entitlements !== null
      ? row.entitlements as Workspace['entitlements']
      : undefined,
  };
}

export function mapWorkspaceUserRow(row: Record<string, unknown>): WorkspaceUser {
  return {
    workspaceId: String(row.workspace_id),
    tenantId: typeof row.tenant_id === 'string' && row.tenant_id.length > 0 ? row.tenant_id : String(row.workspace_id),
    userId: String(row.user_id),
    role: String(row.role) as WorkspaceUser['role'],
    joinedAt: new Date(String(row.joined_at)).toISOString(),
    invitedBy: typeof row.invited_by === 'string' ? row.invited_by : undefined,
    status: String(row.status || 'active') as WorkspaceUser['status'],
  };
}

export function mapWorkspaceUserPreferenceRow(row: Record<string, unknown>): WorkspaceUserPreference {
  return {
    userId: String(row.user_id),
    lastSelectedWorkspaceId: typeof row.last_selected_workspace_id === 'string'
      ? row.last_selected_workspace_id
      : undefined,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}
