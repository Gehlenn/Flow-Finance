import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  Tenant,
  Workspace,
  WorkspaceSummary,
  WorkspaceUser,
  WorkspaceUserPreference,
  Role,
  WorkspacePlan,
  WorkspaceSubscription,
  WorkspaceEntitlements,
} from '../../types';
import { recordAuditEvent } from './auditLog';
import logger from '../../config/logger';
import {
  loadJsonState,
  isPostgresStateStoreEnabled,
  queryLastWorkspaceForUser,
  queryTenantById,
  queryTenantsForUser,
  queryWorkspaceByBillingCustomerId,
  queryWorkspaceById,
  queryWorkspacesForUser,
  queryWorkspaceUsers,
  loadWorkspaceStoreState,
  saveJsonState,
  saveWorkspaceStoreState,
} from '../persistence/postgresStateStore';

interface WorkspaceStoreState {
  tenants: Tenant[];
  workspaces: Workspace[];
  workspaceUsers: WorkspaceUser[];
  userPreferences: WorkspaceUserPreference[];
}

function buildEntitlements(plan: WorkspacePlan): WorkspaceEntitlements {
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

function normalizeWorkspace(workspace: Workspace): Workspace {
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

function normalizeTenant(tenant: Tenant): Tenant {
  return {
    ...tenant,
    plan: tenant.plan || 'free',
    updatedAt: tenant.updatedAt || tenant.createdAt,
  };
}

const DEFAULT_STORE_FILE = path.resolve(__dirname, '../../../data/workspaces.json');
const POSTGRES_STATE_KEY = 'workspace_store_state';
const EMPTY_STATE: WorkspaceStoreState = {
  tenants: [],
  workspaces: [],
  workspaceUsers: [],
  userPreferences: [],
};

let stateCache: WorkspaceStoreState | null = null;

function areLegacyStateBlobsDisabled(): boolean {
  return String(process.env.DISABLE_LEGACY_STATE_BLOBS || '').toLowerCase() === 'true';
}

function cloneState(state: WorkspaceStoreState): WorkspaceStoreState {
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

function getStoreFilePath(): string {
  return process.env.WORKSPACE_STORE_FILE || DEFAULT_STORE_FILE;
}

function ensureStoreDirExists(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadState(): WorkspaceStoreState {
  if (stateCache) {
    return stateCache;
  }

  if (areLegacyStateBlobsDisabled()) {
    stateCache = cloneState(EMPTY_STATE);
    return stateCache;
  }

  const filePath = getStoreFilePath();

  try {
    if (!fs.existsSync(filePath)) {
      ensureStoreDirExists(filePath);
      stateCache = cloneState(EMPTY_STATE);
      return stateCache;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      stateCache = cloneState(EMPTY_STATE);
      return stateCache;
    }

    const parsed = JSON.parse(raw) as Partial<WorkspaceStoreState>;
    stateCache = {
      tenants: Array.isArray(parsed.tenants) ? parsed.tenants.map((tenant) => normalizeTenant(tenant)) : [],
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces.map((workspace) => normalizeWorkspace(workspace)) : [],
      workspaceUsers: Array.isArray(parsed.workspaceUsers) ? parsed.workspaceUsers : [],
      userPreferences: Array.isArray(parsed.userPreferences) ? parsed.userPreferences : [],
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to load workspace store, starting with empty state');
    stateCache = cloneState(EMPTY_STATE);
  }

  return stateCache;
}

function persistState(state: WorkspaceStoreState): void {
  stateCache = cloneState(state);
  if (!areLegacyStateBlobsDisabled()) {
    const filePath = getStoreFilePath();
    ensureStoreDirExists(filePath);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  }
  void saveWorkspaceStoreState(state).catch((error) => {
    logger.warn({ error }, 'Failed to persist normalized workspace store to Postgres');
  });
  if (!areLegacyStateBlobsDisabled()) {
    void saveJsonState(POSTGRES_STATE_KEY, state as unknown as Record<string, unknown>).catch((error) => {
      logger.warn({ error }, 'Failed to persist workspace store to Postgres');
    });
  }
}

function getWorkspaceUsersInternal(state: WorkspaceStoreState, workspaceId: string): WorkspaceUser[] {
  return state.workspaceUsers.filter((workspaceUser) => workspaceUser.workspaceId === workspaceId);
}

function getWorkspaceUserInternal(
  state: WorkspaceStoreState,
  workspaceId: string,
  userId: string,
): WorkspaceUser | undefined {
  return state.workspaceUsers.find(
    (workspaceUser) => workspaceUser.workspaceId === workspaceId && workspaceUser.userId === userId,
  );
}

export function createTenant(name: string, ownerUserId: string): { tenant: Tenant; workspace: Workspace } {
  const state = loadState();
  const tenantId = randomUUID();
  const workspaceId = randomUUID();
  const createdAt = new Date().toISOString();
  const normalizedName = name.trim();

  const tenant: Tenant = {
    tenantId,
    name: normalizedName,
    plan: 'free',
    createdAt,
    updatedAt: createdAt,
  };

  const workspace: Workspace = {
    workspaceId,
    tenantId,
    name: normalizedName,
    isDefault: true,
    createdAt,
    updatedAt: createdAt,
    plan: 'free',
    status: 'active',
    entitlements: buildEntitlements('free'),
  };

  const ownerMembership: WorkspaceUser = {
    userId: ownerUserId,
    workspaceId,
    tenantId,
    role: 'owner',
    joinedAt: createdAt,
    status: 'active',
  };

  persistState({
    tenants: [...state.tenants, tenant],
    workspaces: [...state.workspaces, workspace],
    workspaceUsers: [...state.workspaceUsers, ownerMembership],
    userPreferences: [
      ...state.userPreferences.filter((userPreference) => userPreference.userId !== ownerUserId),
      {
        userId: ownerUserId,
        lastSelectedWorkspaceId: workspaceId,
        updatedAt: createdAt,
      },
    ],
  });

  recordAuditEvent({
    tenantId,
    workspaceId,
    userId: ownerUserId,
    action: 'workspace.addUser',
    status: 'success',
    resource: workspaceId,
    resourceType: 'workspace',
    resourceId: workspaceId,
    metadata: { created: true, isDefault: true, tenantName: normalizedName },
  });

  return { tenant, workspace };
}

export function createWorkspace(name: string, ownerUserId: string, tenantId?: string): Workspace {
  if (!tenantId) {
    return createTenant(name, ownerUserId).workspace;
  }

  const state = loadState();
  const tenant = state.tenants.find((item) => item.tenantId === tenantId);
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const workspaceId = randomUUID();
  const createdAt = new Date().toISOString();
  const workspace: Workspace = {
    workspaceId,
    tenantId,
    name: name.trim(),
    isDefault: false,
    createdAt,
    updatedAt: createdAt,
    plan: tenant.plan,
    status: 'active',
    entitlements: buildEntitlements(tenant.plan),
  };
  const ownerMembership: WorkspaceUser = {
    userId: ownerUserId,
    workspaceId,
    tenantId,
    role: 'owner',
    joinedAt: createdAt,
    status: 'active',
  };

  persistState({
    tenants: state.tenants.map((item) => item.tenantId === tenantId ? { ...item, updatedAt: createdAt } : item),
    workspaces: [...state.workspaces, workspace],
    workspaceUsers: [...state.workspaceUsers, ownerMembership],
    userPreferences: [
      ...state.userPreferences.filter((userPreference) => userPreference.userId !== ownerUserId),
      {
        userId: ownerUserId,
        lastSelectedWorkspaceId: workspaceId,
        updatedAt: createdAt,
      },
    ],
  });

  recordAuditEvent({
    tenantId,
    workspaceId,
    userId: ownerUserId,
    action: 'workspace.addUser',
    status: 'success',
    resource: workspaceId,
    resourceType: 'workspace',
    resourceId: workspaceId,
    metadata: { created: true, isDefault: false, workspaceName: workspace.name },
  });

  return workspace;
}

export function getWorkspace(workspaceId: string): Workspace | undefined {
  const workspace = loadState().workspaces.find((item) => item.workspaceId === workspaceId);
  return workspace ? normalizeWorkspace(workspace) : undefined;
}

export async function getWorkspaceAsync(workspaceId: string): Promise<Workspace | undefined> {
  if (isPostgresStateStoreEnabled()) {
    const workspace = await queryWorkspaceById(workspaceId);
    if (workspace) {
      return normalizeWorkspace(workspace);
    }
  }

  return getWorkspace(workspaceId);
}

export function listWorkspacesForUser(userId: string): Workspace[] {
  const state = loadState();
  const workspaceIds = new Set(
    state.workspaceUsers
      .filter((workspaceUser) => workspaceUser.userId === userId && workspaceUser.status === 'active')
      .map((workspaceUser) => workspaceUser.workspaceId),
  );

  return state.workspaces
    .filter((workspace) => workspaceIds.has(workspace.workspaceId))
    .map((workspace) => normalizeWorkspace(workspace));
}

export async function listWorkspacesForUserAsync(userId: string): Promise<Workspace[]> {
  if (isPostgresStateStoreEnabled()) {
    const workspaces = await queryWorkspacesForUser(userId);
    if (workspaces.length > 0) {
      return workspaces.map((workspace) => normalizeWorkspace(workspace));
    }
  }

  return listWorkspacesForUser(userId);
}

export function listTenantsForUser(userId: string): Tenant[] {
  const state = loadState();
  const tenantIds = new Set(
    state.workspaceUsers
      .filter((workspaceUser) => workspaceUser.userId === userId && workspaceUser.status === 'active')
      .map((workspaceUser) => workspaceUser.tenantId),
  );

  return state.tenants
    .filter((tenant) => tenantIds.has(tenant.tenantId))
    .map((tenant) => normalizeTenant(tenant));
}

export async function listTenantsForUserAsync(userId: string): Promise<Tenant[]> {
  if (isPostgresStateStoreEnabled()) {
    const tenants = await queryTenantsForUser(userId);
    if (tenants.length > 0) {
      return tenants.map((tenant) => normalizeTenant(tenant));
    }
  }

  return listTenantsForUser(userId);
}

export function getTenant(tenantId: string): Tenant | undefined {
  return loadState().tenants.find((item) => item.tenantId === tenantId);
}

export async function getTenantAsync(tenantId: string): Promise<Tenant | undefined> {
  if (isPostgresStateStoreEnabled()) {
    const tenant = await queryTenantById(tenantId);
    if (tenant) {
      return normalizeTenant(tenant);
    }
  }

  return getTenant(tenantId);
}

export async function listWorkspaceSummariesForUserAsync(userId: string): Promise<WorkspaceSummary[]> {
  const workspaces = await listWorkspacesForUserAsync(userId);
  const tenants = await listTenantsForUserAsync(userId);
  const tenantById = new Map(tenants.map((tenant) => [tenant.tenantId, tenant]));
  const memberships = await Promise.all(workspaces.map(async (workspace) => ({
    workspaceId: workspace.workspaceId,
    role: await getUserRoleInWorkspaceAsync(userId, workspace.workspaceId),
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

export function addUserToWorkspace(
  workspaceId: string,
  userId: string,
  role: Role = 'member',
  invitedBy?: string,
): WorkspaceUser | undefined {
  const state = loadState();
  const workspace = state.workspaces.find((item) => item.workspaceId === workspaceId);

  if (!workspace) {
    return undefined;
  }

  const existing = getWorkspaceUserInternal(state, workspaceId, userId);
  if (existing) {
    return existing;
  }

  const workspaceUser: WorkspaceUser = {
    userId,
    workspaceId,
    tenantId: workspace.tenantId,
    role,
    joinedAt: new Date().toISOString(),
    invitedBy,
    status: 'active',
  };

  persistState({
    tenants: state.tenants,
    workspaces: state.workspaces,
    workspaceUsers: [...state.workspaceUsers, workspaceUser],
    userPreferences: state.userPreferences,
  });

  recordAuditEvent({
    tenantId: workspace.tenantId,
    workspaceId,
    userId: invitedBy,
    action: 'workspace.addUser',
    status: 'success',
    resource: workspaceId,
    resourceType: 'workspace_member',
    resourceId: userId,
    metadata: { addedUserId: userId, role },
  });

  return workspaceUser;
}

export function getWorkspaceUsers(workspaceId: string): WorkspaceUser[] {
  return getWorkspaceUsersInternal(loadState(), workspaceId);
}

export async function getWorkspaceUsersAsync(workspaceId: string): Promise<WorkspaceUser[]> {
  if (isPostgresStateStoreEnabled()) {
    const users = await queryWorkspaceUsers(workspaceId);
    if (users.length > 0) {
      return users;
    }
  }

  return getWorkspaceUsers(workspaceId);
}

export function getUserRoleInWorkspace(userId: string, workspaceId: string): Role | undefined {
  return getWorkspaceUsers(workspaceId)
    .find((workspaceUser) => workspaceUser.userId === userId && workspaceUser.status === 'active')
    ?.role;
}

export async function getUserRoleInWorkspaceAsync(userId: string, workspaceId: string): Promise<Role | undefined> {
  const users = await getWorkspaceUsersAsync(workspaceId);
  return users.find((workspaceUser) => workspaceUser.userId === userId && workspaceUser.status === 'active')?.role;
}

export function isUserInWorkspace(userId: string, workspaceId: string): boolean {
  return Boolean(getUserRoleInWorkspace(userId, workspaceId));
}

export async function isUserInWorkspaceAsync(userId: string, workspaceId: string): Promise<boolean> {
  return Boolean(await getUserRoleInWorkspaceAsync(userId, workspaceId));
}

export function removeUserFromWorkspace(userId: string, workspaceId: string): boolean {
  const state = loadState();
  const workspace = state.workspaces.find((item) => item.workspaceId === workspaceId);
  let changed = false;

  const workspaceUsers = state.workspaceUsers.map((workspaceUser) => {
    if (workspaceUser.workspaceId === workspaceId && workspaceUser.userId === userId && workspaceUser.status !== 'removed') {
      changed = true;
      return { ...workspaceUser, status: 'removed' as const };
    }

    return workspaceUser;
  });

  if (!changed) {
    return false;
  }

  persistState({
    tenants: state.tenants,
    workspaces: state.workspaces,
    workspaceUsers,
    userPreferences: state.userPreferences,
  });

  if (workspace) {
    recordAuditEvent({
      tenantId: workspace.tenantId,
      workspaceId,
      userId,
      action: 'workspace.removeUser',
      status: 'success',
      resource: workspaceId,
      resourceType: 'workspace_member',
      resourceId: userId,
      metadata: { removedUserId: userId },
    });
  }

  return true;
}

export function updateWorkspaceBilling(
  workspaceId: string,
  input: {
    plan?: WorkspacePlan;
    billingEmail?: string;
    billingCustomerId?: string;
    subscription?: WorkspaceSubscription;
  },
): Workspace | undefined {
  const state = loadState();
  let updatedWorkspace: Workspace | undefined;

  const workspaces = state.workspaces.map((workspace) => {
    if (workspace.workspaceId !== workspaceId) {
      return workspace;
    }

    updatedWorkspace = normalizeWorkspace({
      ...workspace,
      plan: input.plan || workspace.plan,
      billingEmail: input.billingEmail || workspace.billingEmail,
      billingCustomerId: input.billingCustomerId || workspace.billingCustomerId,
      subscription: input.subscription || workspace.subscription,
      entitlements: buildEntitlements(input.plan || workspace.plan),
      status: 'active',
    });

    return updatedWorkspace;
  });

  if (!updatedWorkspace) {
    return undefined;
  }

  persistState({
    tenants: state.tenants.map((tenant) => tenant.tenantId === updatedWorkspace?.tenantId ? {
      ...tenant,
      plan: updatedWorkspace?.plan || tenant.plan,
      updatedAt: new Date().toISOString(),
    } : tenant),
    workspaces,
    workspaceUsers: state.workspaceUsers,
    userPreferences: state.userPreferences,
  });

  recordAuditEvent({
    tenantId: updatedWorkspace.tenantId,
    workspaceId,
    action: 'billing.plan_changed',
    status: 'success',
    resource: workspaceId,
    resourceType: 'workspace',
    resourceId: workspaceId,
    metadata: {
      plan: updatedWorkspace.plan,
      billingEmail: updatedWorkspace.billingEmail,
      subscriptionId: updatedWorkspace.subscription?.subscriptionId,
    },
  });

  return updatedWorkspace;
}

export function getWorkspaceEntitlements(workspaceId: string): WorkspaceEntitlements | undefined {
  return getWorkspace(workspaceId)?.entitlements;
}

export function findWorkspaceByBillingCustomerId(billingCustomerId: string): Workspace | undefined {
  const workspace = loadState().workspaces.find((item) => item.billingCustomerId === billingCustomerId);
  return workspace ? normalizeWorkspace(workspace) : undefined;
}

export async function findWorkspaceByBillingCustomerIdAsync(billingCustomerId: string): Promise<Workspace | undefined> {
  if (isPostgresStateStoreEnabled()) {
    const workspace = await queryWorkspaceByBillingCustomerId(billingCustomerId);
    if (workspace) {
      return normalizeWorkspace(workspace);
    }
  }

  return findWorkspaceByBillingCustomerId(billingCustomerId);
}

export function setLastWorkspaceForUser(userId: string, workspaceId: string): void {
  const state = loadState();
  const updatedAt = new Date().toISOString();

  persistState({
    tenants: state.tenants,
    workspaces: state.workspaces,
    workspaceUsers: state.workspaceUsers,
    userPreferences: [
      ...state.userPreferences.filter((userPreference) => userPreference.userId !== userId),
      {
        userId,
        lastSelectedWorkspaceId: workspaceId,
        updatedAt,
      },
    ],
  });
}

export function getLastWorkspaceForUser(userId: string): Workspace | undefined {
  const preference = loadState().userPreferences.find((userPreference) => userPreference.userId === userId);
  if (!preference?.lastSelectedWorkspaceId) {
    return undefined;
  }

  return getWorkspace(preference.lastSelectedWorkspaceId);
}

export async function getLastWorkspaceForUserAsync(userId: string): Promise<Workspace | undefined> {
  if (isPostgresStateStoreEnabled()) {
    const workspace = await queryLastWorkspaceForUser(userId);
    if (workspace) {
      return normalizeWorkspace(workspace);
    }
  }

  return getLastWorkspaceForUser(userId);
}

export function resetWorkspaceStoreForTests(): void {
  stateCache = cloneState(EMPTY_STATE);

  const filePath = getStoreFilePath();
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

export function getWorkspaceStoreSnapshotForTests(): WorkspaceStoreState {
  return cloneState(loadState());
}

export async function initializeWorkspaceStorePersistence(): Promise<void> {
  const normalized = await loadWorkspaceStoreState();
  if (normalized) {
    stateCache = {
      tenants: Array.isArray(normalized.tenants) ? normalized.tenants.map((tenant) => normalizeTenant(tenant)) : [],
      workspaces: Array.isArray(normalized.workspaces) ? normalized.workspaces.map((workspace) => normalizeWorkspace(workspace)) : [],
      workspaceUsers: Array.isArray(normalized.workspaceUsers) ? normalized.workspaceUsers : [],
      userPreferences: Array.isArray(normalized.userPreferences) ? normalized.userPreferences : [],
    };
    if (stateCache.tenants.length === 0 && stateCache.workspaces.length > 0) {
      stateCache.tenants = stateCache.workspaces.map((workspace) => ({
        tenantId: workspace.tenantId,
        name: workspace.name,
        plan: workspace.plan,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt || workspace.createdAt,
      }));
    }
    return;
  }

  if (areLegacyStateBlobsDisabled()) {
    return;
  }

  const persisted = await loadJsonState<WorkspaceStoreState>(POSTGRES_STATE_KEY);
  if (!persisted) {
    return;
  }

  stateCache = {
    tenants: Array.isArray(persisted.tenants) ? persisted.tenants.map((tenant) => normalizeTenant(tenant)) : [],
    workspaces: Array.isArray(persisted.workspaces) ? persisted.workspaces.map((workspace) => normalizeWorkspace(workspace)) : [],
    workspaceUsers: Array.isArray(persisted.workspaceUsers) ? persisted.workspaceUsers : [],
    userPreferences: Array.isArray(persisted.userPreferences) ? persisted.userPreferences : [],
  };

  if (stateCache.tenants.length === 0 && stateCache.workspaces.length > 0) {
    stateCache.tenants = stateCache.workspaces.map((workspace) => ({
      tenantId: workspace.tenantId || workspace.workspaceId,
      name: workspace.name,
      plan: workspace.plan,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt || workspace.createdAt,
    }));
    stateCache.workspaces = stateCache.workspaces.map((workspace) => ({
      ...workspace,
      tenantId: workspace.tenantId || workspace.workspaceId,
      isDefault: workspace.isDefault ?? true,
    }));
    stateCache.workspaceUsers = stateCache.workspaceUsers.map((workspaceUser) => ({
      ...workspaceUser,
      tenantId: workspaceUser.tenantId || workspaceUser.workspaceId,
      role: (workspaceUser.role as string) === 'user' ? 'member' : workspaceUser.role,
    }));
  }

  void saveWorkspaceStoreState(stateCache).catch((error) => {
    logger.warn({ error }, 'Failed to backfill normalized workspace store to Postgres');
  });
}
