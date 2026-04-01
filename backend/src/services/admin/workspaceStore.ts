import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  Workspace,
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
  queryWorkspaceByBillingCustomerId,
  queryWorkspaceById,
  queryWorkspacesForUser,
  queryWorkspaceUsers,
  loadWorkspaceStoreState,
  saveJsonState,
  saveWorkspaceStoreState,
} from '../persistence/postgresStateStore';

interface WorkspaceStoreState {
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
    plan,
    status: workspace.status || 'active',
    entitlements: workspace.entitlements || buildEntitlements(plan),
  };
}

const DEFAULT_STORE_FILE = path.resolve(__dirname, '../../../data/workspaces.json');
const POSTGRES_STATE_KEY = 'workspace_store_state';
const EMPTY_STATE: WorkspaceStoreState = {
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
    workspaces: state.workspaces.map((workspace) => normalizeWorkspace({ ...workspace })),
    workspaceUsers: state.workspaceUsers.map((workspaceUser) => ({ ...workspaceUser })),
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

export function createWorkspace(name: string, ownerUserId: string): Workspace {
  const state = loadState();
  const workspaceId = randomUUID();
  const createdAt = new Date().toISOString();

  const workspace: Workspace = {
    workspaceId,
    name: name.trim(),
    createdAt,
    plan: 'free',
    status: 'active',
    entitlements: buildEntitlements('free'),
  };

  const ownerMembership: WorkspaceUser = {
    userId: ownerUserId,
    workspaceId,
    role: 'owner',
    joinedAt: createdAt,
    status: 'active',
  };

  persistState({
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

export function addUserToWorkspace(
  workspaceId: string,
  userId: string,
  role: Role = 'user',
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
    role,
    joinedAt: new Date().toISOString(),
    invitedBy,
    status: 'active',
  };

  persistState({
    workspaces: state.workspaces,
    workspaceUsers: [...state.workspaceUsers, workspaceUser],
    userPreferences: state.userPreferences,
  });

  recordAuditEvent({
    userId: invitedBy,
    action: 'workspace.addUser',
    status: 'success',
    resource: workspaceId,
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
    workspaces: state.workspaces,
    workspaceUsers,
    userPreferences: state.userPreferences,
  });

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
    workspaces,
    workspaceUsers: state.workspaceUsers,
    userPreferences: state.userPreferences,
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
      workspaces: Array.isArray(normalized.workspaces) ? normalized.workspaces.map((workspace) => normalizeWorkspace(workspace)) : [],
      workspaceUsers: Array.isArray(normalized.workspaceUsers) ? normalized.workspaceUsers : [],
      userPreferences: Array.isArray(normalized.userPreferences) ? normalized.userPreferences : [],
    };
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
    workspaces: Array.isArray(persisted.workspaces) ? persisted.workspaces.map((workspace) => normalizeWorkspace(workspace)) : [],
    workspaceUsers: Array.isArray(persisted.workspaceUsers) ? persisted.workspaceUsers : [],
    userPreferences: Array.isArray(persisted.userPreferences) ? persisted.userPreferences : [],
  };

  void saveWorkspaceStoreState(stateCache).catch((error) => {
    logger.warn({ error }, 'Failed to backfill normalized workspace store to Postgres');
  });
}
