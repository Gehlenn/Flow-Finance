import fs from 'fs';
import path from 'path';
import {
  Tenant,
  Workspace,
  WorkspaceEntitlements,
  WorkspacePlan,
  WorkspaceUser,
  WorkspaceUserPreference,
} from '../../types';

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
