import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  Tenant,
  Workspace,
  WorkspaceSummary,
  WorkspaceUser,
  Role,
  WorkspacePlan,
  WorkspaceSubscription,
  WorkspaceEntitlements,
} from '../../types';
import { recordAuditEvent } from './auditLog';
import logger from '../../config/logger';
import {
  buildEntitlements,
  buildWorkspaceAuditEvent,
  buildWorkspaceSummaries,
  buildWorkspaceStoreState,
  cloneState,
  getActiveTenantIdsForUser,
  getActiveWorkspaceIdsForUser,
  ensureWorkspaceTenants,
  ensureStoreDirExists,
  getWorkspaceStoreFilePath,
  normalizeTenant,
  normalizeWorkspace,
  normalizeWorkspaceStoreState,
  readThroughWorkspaceStore,
  replaceUserPreference,
  type WorkspaceStoreState,
} from './workspaceStoreHelpers';
import {
  loadJsonState,
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

function loadState(): WorkspaceStoreState {
  if (stateCache) {
    return stateCache;
  }

  if (areLegacyStateBlobsDisabled()) {
    stateCache = cloneState(EMPTY_STATE);
    return stateCache;
  }

  const filePath = getWorkspaceStoreFilePath();

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
    stateCache = cloneState(normalizeWorkspaceStoreState(parsed));
  } catch (error) {
    logger.warn({
      error,
      filePath,
      fallback: 'workspace-store-load-failed',
    }, 'Failed to load workspace store, starting with empty state');
    stateCache = cloneState(EMPTY_STATE);
  }

  return stateCache;
}

function persistState(state: WorkspaceStoreState): void {
  stateCache = cloneState(state);
  if (!areLegacyStateBlobsDisabled()) {
    const filePath = getWorkspaceStoreFilePath();
    ensureStoreDirExists(filePath);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  }
  void saveWorkspaceStoreState(state).catch((error) => {
    logger.warn({
      error,
      tenantCount: state.tenants.length,
      workspaceCount: state.workspaces.length,
      workspaceUserCount: state.workspaceUsers.length,
      preferenceCount: state.userPreferences.length,
      fallback: 'workspace-store-postgres-save-failed',
    }, 'Failed to persist normalized workspace store to Postgres');
  });
  if (!areLegacyStateBlobsDisabled()) {
    void saveJsonState(POSTGRES_STATE_KEY, state as unknown as Record<string, unknown>).catch((error) => {
      logger.warn({
        error,
        tenantCount: state.tenants.length,
        workspaceCount: state.workspaces.length,
        workspaceUserCount: state.workspaceUsers.length,
        preferenceCount: state.userPreferences.length,
        fallback: 'workspace-store-json-save-failed',
      }, 'Failed to persist workspace store JSON blob');
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

  persistStateUpdate(state, {
    tenants: [...state.tenants, tenant],
    workspaces: [...state.workspaces, workspace],
    workspaceUsers: [...state.workspaceUsers, ownerMembership],
    userPreferences: replaceUserPreference(state.userPreferences, ownerUserId, workspaceId, createdAt),
  });

  recordAuditEvent(buildWorkspaceAuditEvent({
    tenantId,
    workspaceId,
    userId: ownerUserId,
    action: 'workspace.addUser',
    status: 'success',
    resourceType: 'workspace',
    resourceId: workspaceId,
    metadata: { created: true, isDefault: true, tenantName: normalizedName },
  }));

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

  persistStateUpdate(state, {
    tenants: state.tenants.map((item) => item.tenantId === tenantId ? { ...item, updatedAt: createdAt } : item),
    workspaces: [...state.workspaces, workspace],
    workspaceUsers: [...state.workspaceUsers, ownerMembership],
    userPreferences: replaceUserPreference(state.userPreferences, ownerUserId, workspaceId, createdAt),
  });

  recordAuditEvent(buildWorkspaceAuditEvent({
    tenantId,
    workspaceId,
    userId: ownerUserId,
    action: 'workspace.addUser',
    status: 'success',
    resourceType: 'workspace',
    resourceId: workspaceId,
    metadata: { created: true, isDefault: false, workspaceName: workspace.name },
  }));

  return workspace;
}

export function getWorkspace(workspaceId: string): Workspace | undefined {
  const workspace = loadState().workspaces.find((item) => item.workspaceId === workspaceId);
  return workspace ? normalizeWorkspace(workspace) : undefined;
}

export async function getWorkspaceAsync(workspaceId: string): Promise<Workspace | undefined> {
  return readThroughWorkspaceStore(
    async () => {
      const workspace = await queryWorkspaceById(workspaceId);
      return workspace ? normalizeWorkspace(workspace) : undefined;
    },
    () => getWorkspace(workspaceId),
  );
}

export function listWorkspacesForUser(userId: string): Workspace[] {
  const state = loadState();
  const workspaceIds = getActiveWorkspaceIdsForUser(state, userId);

  return state.workspaces
    .filter((workspace) => workspaceIds.has(workspace.workspaceId))
    .map((workspace) => normalizeWorkspace(workspace));
}

export async function listWorkspacesForUserAsync(userId: string): Promise<Workspace[]> {
  return readThroughWorkspaceStore(
    async () => {
      const workspaces = await queryWorkspacesForUser(userId);
      return workspaces.map((workspace) => normalizeWorkspace(workspace));
    },
    () => listWorkspacesForUser(userId),
  );
}

export function listTenantsForUser(userId: string): Tenant[] {
  const state = loadState();
  const tenantIds = getActiveTenantIdsForUser(state, userId);

  return state.tenants
    .filter((tenant) => tenantIds.has(tenant.tenantId))
    .map((tenant) => normalizeTenant(tenant));
}

export async function listTenantsForUserAsync(userId: string): Promise<Tenant[]> {
  return readThroughWorkspaceStore(
    async () => {
      const tenants = await queryTenantsForUser(userId);
      return tenants.map((tenant) => normalizeTenant(tenant));
    },
    () => listTenantsForUser(userId),
  );
}

export function getTenant(tenantId: string): Tenant | undefined {
  return loadState().tenants.find((item) => item.tenantId === tenantId);
}

export async function getTenantAsync(tenantId: string): Promise<Tenant | undefined> {
  return readThroughWorkspaceStore(
    async () => {
      const tenant = await queryTenantById(tenantId);
      return tenant ? normalizeTenant(tenant) : undefined;
    },
    () => getTenant(tenantId),
  );
}

export async function listWorkspaceSummariesForUserAsync(userId: string): Promise<WorkspaceSummary[]> {
  const workspaces = await listWorkspacesForUserAsync(userId);
  const tenants = await listTenantsForUserAsync(userId);
  return buildWorkspaceSummaries(workspaces, tenants, (workspaceId) => getUserRoleInWorkspaceAsync(userId, workspaceId));
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

  persistStateUpdate(state, {
    workspaceUsers: [...state.workspaceUsers, workspaceUser],
  });

  recordAuditEvent(buildWorkspaceAuditEvent({
    tenantId: workspace.tenantId,
    workspaceId,
    userId: invitedBy,
    action: 'workspace.addUser',
    status: 'success',
    resourceType: 'workspace_member',
    resourceId: userId,
    metadata: { addedUserId: userId, role },
  }));

  return workspaceUser;
}

export function getWorkspaceUsers(workspaceId: string): WorkspaceUser[] {
  return getWorkspaceUsersInternal(loadState(), workspaceId);
}

export async function getWorkspaceUsersAsync(workspaceId: string): Promise<WorkspaceUser[]> {
  return readThroughWorkspaceStore(
    async () => {
      const users = await queryWorkspaceUsers(workspaceId);
      return users;
    },
    () => getWorkspaceUsers(workspaceId),
  );
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

  persistStateUpdate(state, { workspaceUsers });

  if (workspace) {
    recordAuditEvent(buildWorkspaceAuditEvent({
      tenantId: workspace.tenantId,
      workspaceId,
      userId,
      action: 'workspace.removeUser',
      status: 'success',
      resourceType: 'workspace_member',
      resourceId: userId,
      metadata: { removedUserId: userId },
    }));
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

  persistStateUpdate(state, {
    tenants: state.tenants.map((tenant) => tenant.tenantId === updatedWorkspace?.tenantId ? {
      ...tenant,
      plan: updatedWorkspace?.plan || tenant.plan,
      updatedAt: new Date().toISOString(),
    } : tenant),
    workspaces,
  });

  recordAuditEvent(buildWorkspaceAuditEvent({
    tenantId: updatedWorkspace.tenantId,
    workspaceId,
    action: 'billing.plan_changed',
    status: 'success',
    resourceType: 'workspace',
    resourceId: workspaceId,
    metadata: {
      plan: updatedWorkspace.plan,
      billingEmail: updatedWorkspace.billingEmail,
      subscriptionId: updatedWorkspace.subscription?.subscriptionId,
    },
  }));

  return updatedWorkspace;
}
/**
 * Async variant of updateWorkspaceBilling.
 * When Postgres is enabled it reads the workspace from the DB instead of
 * relying on the in-memory cache — safe for serverless cold starts.
 */
export async function updateWorkspaceBillingAsync(
  workspaceId: string,
  input: {
    plan?: WorkspacePlan;
    billingEmail?: string;
    billingCustomerId?: string;
    subscription?: WorkspaceSubscription;
  },
): Promise<Workspace | undefined> {
  return readThroughWorkspaceStore(
    async () => {
      const workspace = await queryWorkspaceById(workspaceId);
      if (!workspace) {
        return undefined;
      }

      return updateWorkspaceBilling(workspaceId, input);
    },
    () => updateWorkspaceBilling(workspaceId, input),
  );
}

export function getWorkspaceEntitlements(workspaceId: string): WorkspaceEntitlements | undefined {
  return getWorkspace(workspaceId)?.entitlements;
}

export function findWorkspaceByBillingCustomerId(billingCustomerId: string): Workspace | undefined {
  const workspace = loadState().workspaces.find((item) => item.billingCustomerId === billingCustomerId);
  return workspace ? normalizeWorkspace(workspace) : undefined;
}

export async function findWorkspaceByBillingCustomerIdAsync(billingCustomerId: string): Promise<Workspace | undefined> {
  return readThroughWorkspaceStore(
    async () => {
      const workspace = await queryWorkspaceByBillingCustomerId(billingCustomerId);
      return workspace ? normalizeWorkspace(workspace) : undefined;
    },
    () => findWorkspaceByBillingCustomerId(billingCustomerId),
  );
}

export function setLastWorkspaceForUser(userId: string, workspaceId: string): void {
  const state = loadState();
  const updatedAt = new Date().toISOString();

  persistStateUpdate(state, {
    userPreferences: replaceUserPreference(state.userPreferences, userId, workspaceId, updatedAt),
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
  return readThroughWorkspaceStore(
    async () => {
      const workspace = await queryLastWorkspaceForUser(userId);
      return workspace ? normalizeWorkspace(workspace) : undefined;
    },
    () => getLastWorkspaceForUser(userId),
  );
}

export function resetWorkspaceStoreForTests(): void {
  stateCache = cloneState(EMPTY_STATE);

  const filePath = getWorkspaceStoreFilePath();
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

function persistStateUpdate(state: WorkspaceStoreState, updates: Partial<WorkspaceStoreState>): void {
  persistState(buildWorkspaceStoreState(state, updates));
}

export function getWorkspaceStoreSnapshotForTests(): WorkspaceStoreState {
  return cloneState(loadState());
}

export async function initializeWorkspaceStorePersistence(): Promise<void> {
  const normalized = await loadWorkspaceStoreState();
  if (normalized) {
    stateCache = ensureWorkspaceTenants(cloneState(normalizeWorkspaceStoreState(normalized)));
    return;
  }

  if (areLegacyStateBlobsDisabled()) {
    return;
  }

  const persisted = await loadJsonState<WorkspaceStoreState>(POSTGRES_STATE_KEY);
  if (!persisted) {
    return;
  }

  const backfillState = ensureWorkspaceTenants(cloneState(normalizeWorkspaceStoreState(persisted)));
  stateCache = backfillState;
  void saveWorkspaceStoreState(backfillState).catch((error) => {
    logger.warn({
      error,
      tenantCount: backfillState.tenants.length,
      workspaceCount: backfillState.workspaces.length,
      workspaceUserCount: backfillState.workspaceUsers.length,
      preferenceCount: backfillState.userPreferences.length,
      fallback: 'workspace-store-backfill-failed',
    }, 'Failed to backfill normalized workspace store to Postgres');
  });
}
