import fs from 'fs';
import path from 'path';
import {
  Tenant,
  Workspace,
  WorkspaceEntitlements,
  WorkspacePlan,
  WorkspaceSummary,
  WorkspaceUser,
  WorkspaceUserPreference,
  Role,
} from '../../types';
import type { AuditAction, AuditEvent, AuditStatus } from './auditLog';
import { isPostgresStateStoreEnabled } from '../persistence/postgresStateStore';

export interface WorkspaceStoreState {
  tenants: Tenant[];
  workspaces: Workspace[];
  workspaceUsers: WorkspaceUser[];
  userPreferences: WorkspaceUserPreference[];
}

export const DEFAULT_WORKSPACE_STORE_FILE = path.resolve(__dirname, '../../../data/workspaces.json');

export function buildEntitlements(plan: WorkspacePlan): WorkspaceEntitlements {
  if (plan === 'pro') {
    return {
      features: ['advancedInsights', 'multiBankSync', 'adminConsole', 'prioritySupport', 'billingManagement'],
      limits: {
        transactionsPerMonth: 10000,
        aiQueriesPerMonth: 5000,
        bankConnections: 20,
      },
    };
  }

  return {
    features: ['advancedInsights'],
    limits: {
      transactionsPerMonth: 500,
      aiQueriesPerMonth: 100,
      bankConnections: 1,
    },
  };
}

export function normalizeWorkspace(workspace: Workspace): Workspace {
  const plan = workspace.plan || 'free';
  return {
    ...workspace,
    tenantId: workspace.tenantId || workspace.workspaceId,
    isDefault: workspace.isDefault ?? true,
    plan,
    status: workspace.status || 'active',
    updatedAt: workspace.updatedAt || workspace.createdAt,
    entitlements: workspace.entitlements || buildEntitlements(plan),
  };
}

export function normalizeTenant(tenant: Tenant): Tenant {
  return {
    ...tenant,
    plan: tenant.plan || 'free',
    updatedAt: tenant.updatedAt || tenant.createdAt,
  };
}

export function cloneState(state: WorkspaceStoreState): WorkspaceStoreState {
  return {
    tenants: state.tenants.map((tenant) => normalizeTenant({ ...tenant })),
    workspaces: state.workspaces.map((workspace) => normalizeWorkspace({ ...workspace })),
    workspaceUsers: state.workspaceUsers.map((workspaceUser) => ({
      ...workspaceUser,
      tenantId: workspaceUser.tenantId || workspaceUser.workspaceId,
      role: (workspaceUser.role as string) === 'user' ? 'member' : workspaceUser.role,
    })),
    userPreferences: state.userPreferences.map((userPreference) => ({ ...userPreference })),
  };
}

export function getWorkspaceStoreFilePath(override?: string): string {
  return override || process.env.WORKSPACE_STORE_FILE || DEFAULT_WORKSPACE_STORE_FILE;
}

export function ensureStoreDirExists(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function normalizeWorkspaceStoreState(state: Partial<WorkspaceStoreState>): WorkspaceStoreState {
  return {
    tenants: Array.isArray(state.tenants) ? state.tenants.map((tenant) => normalizeTenant(tenant)) : [],
    workspaces: Array.isArray(state.workspaces) ? state.workspaces.map((workspace) => normalizeWorkspace(workspace)) : [],
    workspaceUsers: Array.isArray(state.workspaceUsers) ? state.workspaceUsers : [],
    userPreferences: Array.isArray(state.userPreferences) ? state.userPreferences : [],
  };
}

export function ensureWorkspaceTenants(state: WorkspaceStoreState): WorkspaceStoreState {
  if (state.tenants.length === 0 && state.workspaces.length > 0) {
    return {
      ...state,
      tenants: state.workspaces.map((workspace) => ({
        tenantId: workspace.tenantId || workspace.workspaceId,
        name: workspace.name,
        plan: workspace.plan,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt || workspace.createdAt,
      })),
      workspaces: state.workspaces.map((workspace) => ({
        ...workspace,
        tenantId: workspace.tenantId || workspace.workspaceId,
        isDefault: workspace.isDefault ?? true,
      })),
      workspaceUsers: state.workspaceUsers.map((workspaceUser) => ({
        ...workspaceUser,
        tenantId: workspaceUser.tenantId || workspaceUser.workspaceId,
        role: (workspaceUser.role as string) === 'user' ? 'member' : workspaceUser.role,
      })),
    };
  }

  return state;
}

export function replaceUserPreference(
  preferences: WorkspaceUserPreference[],
  userId: string,
  workspaceId: string,
  updatedAt: string,
): WorkspaceUserPreference[] {
  return [
    ...preferences.filter((userPreference) => userPreference.userId !== userId),
    {
      userId,
      lastSelectedWorkspaceId: workspaceId,
      updatedAt,
    },
  ];
}

export function getWorkspaceUserInternal(
  state: WorkspaceStoreState,
  workspaceId: string,
  userId: string,
): WorkspaceUser | undefined {
  return state.workspaceUsers.find(
    (workspaceUser) => workspaceUser.workspaceId === workspaceId && workspaceUser.userId === userId,
  );
}

export function getActiveWorkspaceIdsForUser(state: WorkspaceStoreState, userId: string): Set<string> {
  return new Set(
    state.workspaceUsers
      .filter((workspaceUser) => workspaceUser.userId === userId && workspaceUser.status === 'active')
      .map((workspaceUser) => workspaceUser.workspaceId),
  );
}

export function getActiveTenantIdsForUser(state: WorkspaceStoreState, userId: string): Set<string> {
  return new Set(
    state.workspaceUsers
      .filter((workspaceUser) => workspaceUser.userId === userId && workspaceUser.status === 'active')
      .map((workspaceUser) => workspaceUser.tenantId),
  );
}

export function buildWorkspaceStoreState(
  state: WorkspaceStoreState,
  updates: Partial<WorkspaceStoreState>,
): WorkspaceStoreState {
  return {
    tenants: updates.tenants ?? state.tenants,
    workspaces: updates.workspaces ?? state.workspaces,
    workspaceUsers: updates.workspaceUsers ?? state.workspaceUsers,
    userPreferences: updates.userPreferences ?? state.userPreferences,
  };
}

export function buildWorkspaceAuditEvent(input: {
  tenantId?: string;
  workspaceId: string;
  userId?: string;
  action: AuditAction;
  status: AuditStatus;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}): Omit<AuditEvent, 'id' | 'at'> {
  return {
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    action: input.action,
    status: input.status,
    resource: input.workspaceId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata,
  };
}

export async function readThroughWorkspaceStore<T>(
  loader: () => Promise<T | null | undefined>,
  fallback: () => T,
): Promise<T> {
  if (!isPostgresStateStoreEnabled()) {
    return fallback();
  }

  const loaded = await loader();
  return loaded ?? fallback();
}

export async function buildWorkspaceSummaries(
  workspaces: Workspace[],
  tenants: Tenant[],
  getRole: (workspaceId: string) => Promise<Role | undefined>,
): Promise<WorkspaceSummary[]> {
  const tenantById = new Map(tenants.map((tenant) => [tenant.tenantId, tenant]));
  const memberships = await Promise.all(workspaces.map(async (workspace) => ({
    workspaceId: workspace.workspaceId,
    role: await getRole(workspace.workspaceId),
  })));

  const roleByWorkspaceId = new Map(memberships.map((membership) => [membership.workspaceId, membership.role]));

  return workspaces.map((workspace) => ({
    workspaceId: workspace.workspaceId,
    tenantId: workspace.tenantId,
    name: workspace.name,
    isDefault: workspace.isDefault,
    plan: workspace.plan,
    role: (roleByWorkspaceId.get(workspace.workspaceId) || 'viewer') as Role,
    tenantName: tenantById.get(workspace.tenantId)?.name,
  }));
}
