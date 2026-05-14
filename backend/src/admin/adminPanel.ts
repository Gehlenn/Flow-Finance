// Painel de administração: gestão de usuários, planos, auditoria
// v0.9.x SaaS foundation

import { AuditAction, AuditEvent, AuditStatus, getAuditEvents } from '../services/admin/auditLog';
import {
  getTenantAsync,
  getWorkspaceAsync,
  getWorkspaceUsersAsync,
  listTenantsForUserAsync,
  listWorkspaceSummariesForUserAsync,
  listWorkspacesForUserAsync,
} from '../services/admin/workspaceStore';
import { Workspace, Tenant, WorkspaceSummary, WorkspaceUser } from '../types';

export interface AdminAuditFilters {
  tenantId?: string;
  workspaceId?: string;
  userId?: string;
  action?: AuditAction;
  status?: AuditStatus;
  resourceType?: string;
  resourceId?: string;
  resource?: string;
  limit?: number;
  since?: string;
  until?: string;
}

export class AdminPanel {
  async getWorkspace(workspaceId: string): Promise<Workspace | undefined> {
    return getWorkspaceAsync(workspaceId);
  }

  async getTenant(tenantId: string): Promise<Tenant | undefined> {
    return getTenantAsync(tenantId);
  }

  async listWorkspacesForUser(userId: string): Promise<Workspace[]> {
    return listWorkspacesForUserAsync(userId);
  }

  async listWorkspaceSummariesForUser(userId: string): Promise<WorkspaceSummary[]> {
    return listWorkspaceSummariesForUserAsync(userId);
  }

  async listTenantsForUser(userId: string): Promise<Tenant[]> {
    return listTenantsForUserAsync(userId);
  }

  async listWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]> {
    return getWorkspaceUsersAsync(workspaceId);
  }

  listAuditEvents(filters: AdminAuditFilters = {}): AuditEvent[] {
    return getAuditEvents(filters);
  }
}
