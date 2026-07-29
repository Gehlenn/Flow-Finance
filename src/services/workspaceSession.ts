import { auth } from '../../services/firebase';
import { API_ENDPOINTS, getAuthHeaders, getStoredWorkspaceId, setStoredWorkspaceId } from '../config/api.config';
import {
  buildDemoWorkspaceSummary,
  canUseDemoWorkspaceFallback,
  getDemoBootstrapIdentity,
} from '../demo/demoBootstrap';
import { trackProductEventOnce } from '../app/productAnalytics';
import {
  listWorkspaceAuditEvents,
  listWorkspaceAuditEventsPage,
} from './firestoreWorkspaceAuditStore';
import {
  listWorkspaceCollectionDocuments,
  upsertWorkspaceCollectionDocument,
} from './firestoreWorkspaceEntityStore';
import type {
  AuditLogCursor,
  AuditLogDocument,
  UserIdentity,
  WorkspaceImportDocument,
  WorkspaceInsightDocument,
  WorkspaceMemberDocument,
  WorkspaceRole,
  WorkspaceSubscriptionDocument,
  WorkspaceSummary,
} from './firestoreWorkspaceTypes';
import {
  buildE2EWorkspaceSummary,
  canUseE2EWorkspaceFallback,
  getE2EBootstrapIdentity,
} from './workspaceSessionE2E';
import { logWarn } from '../utils/logger';

export {
  listWorkspaceAuditEvents,
  listWorkspaceAuditEventsPage,
  listWorkspaceCollectionDocuments,
  upsertWorkspaceCollectionDocument,
};
export type {
  AuditLogCursor,
  AuditLogDocument,
  WorkspaceImportDocument,
  WorkspaceInsightDocument,
  WorkspaceMemberDocument,
  WorkspaceRole,
  WorkspaceSubscriptionDocument,
  WorkspaceSummary,
} from './firestoreWorkspaceTypes';

export const WORKSPACE_CHANGED_EVENT = 'flow:workspace-changed';
const DEFAULT_WORKSPACE_NAME = 'Workspace Pessoal';

export function getCurrentWorkspaceIdentity(): UserIdentity | undefined {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    const demoIdentity = getDemoBootstrapIdentity();
    if (demoIdentity?.userId) {
      return demoIdentity;
    }

    return getE2EBootstrapIdentity();
  }

  return {
    userId: currentUser.uid,
    name: currentUser.displayName,
    email: currentUser.email,
  };
}

function resolveIdentity(identity?: UserIdentity): UserIdentity {
  const currentIdentity = identity || getCurrentWorkspaceIdentity();
  if (!currentIdentity?.userId) {
    throw new Error('Cannot resolve workspace without an authenticated user');
  }

  return currentIdentity;
}

function buildDefaultWorkspaceName(identity: UserIdentity): string {
  const trimmed = identity.name?.trim();
  return trimmed && trimmed.length > 0 ? `Workspace de ${trimmed}` : DEFAULT_WORKSPACE_NAME;
}

function buildDefaultTenantName(identity: UserIdentity): string {
  const trimmed = identity.name?.trim();
  return trimmed && trimmed.length > 0 ? `Tenant de ${trimmed}` : 'Tenant Pessoal';
}

type BackendWorkspaceListResponse = {
  workspaces?: WorkspaceSummary[];
};

type BackendWorkspaceMembersResponse = {
  users?: BackendWorkspaceMember[];
};

type BackendWorkspaceMember = {
  userId?: string;
  workspaceId?: string;
  tenantId?: string;
  role?: WorkspaceRole;
  joinedAt?: string;
  status?: 'active' | 'invited' | 'removed';
};

function normalizeWorkspaceSummary(input: Partial<WorkspaceSummary> | null | undefined): WorkspaceSummary | null {
  if (!input || typeof input.workspaceId !== 'string' || typeof input.tenantId !== 'string' || typeof input.name !== 'string') {
    return null;
  }

  return {
    workspaceId: input.workspaceId,
    tenantId: input.tenantId,
    name: input.name,
    tenantName: typeof input.tenantName === 'string' && input.tenantName.trim() ? input.tenantName : input.name,
    plan: input.plan === 'pro' ? 'pro' : 'free',
    role: input.role === 'owner' || input.role === 'admin' || input.role === 'member' || input.role === 'viewer'
      ? input.role
      : 'member',
    isDefault: Boolean(input.isDefault),
  };
}

async function fetchBackendWorkspaceSummaries(): Promise<WorkspaceSummary[]> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API unavailable for backend workspace bootstrap');
  }

  const response = await fetch(API_ENDPOINTS.WORKSPACE.ROOT, {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders({ includeWorkspace: false }),
  });

  if (!response.ok) {
    throw new Error(`Backend workspace list failed: ${response.status}`);
  }

  const payload = await response.json() as BackendWorkspaceListResponse;
  if (!Array.isArray(payload.workspaces)) {
    throw new Error('Workspace bootstrap list returned an invalid payload');
  }

  const workspaces = payload.workspaces;
  return workspaces
    .map((workspace) => normalizeWorkspaceSummary(workspace))
    .filter((workspace): workspace is WorkspaceSummary => Boolean(workspace));
}

async function createBackendWorkspace(identity: UserIdentity, explicitName?: string): Promise<WorkspaceSummary> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API unavailable for backend workspace creation');
  }

  const response = await fetch(API_ENDPOINTS.WORKSPACE.ROOT, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ includeWorkspace: false }),
    body: JSON.stringify({
      name: explicitName?.trim() || buildDefaultWorkspaceName(identity),
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend workspace creation failed: ${response.status}`);
  }

  const payload = await response.json() as Partial<WorkspaceSummary>;
  const workspace = normalizeWorkspaceSummary(payload);
  if (!workspace) {
    throw new Error('Backend workspace creation returned an invalid payload');
  }

  return {
    ...workspace,
    role: 'owner',
    tenantName: buildDefaultTenantName(identity),
    isDefault: payload.isDefault ?? true,
  };
}

function getWorkspaceUsersEndpoint(workspaceId: string): string {
  return `${API_ENDPOINTS.WORKSPACE.ROOT}/${encodeURIComponent(workspaceId)}/users`;
}

function normalizeWorkspaceMember(input: BackendWorkspaceMember | null | undefined): WorkspaceMemberDocument | null {
  if (
    !input
    || typeof input.userId !== 'string'
    || typeof input.workspaceId !== 'string'
    || typeof input.tenantId !== 'string'
    || typeof input.joinedAt !== 'string'
    || !input.joinedAt.trim()
  ) {
    return null;
  }

  const role = input.role === 'owner' || input.role === 'admin' || input.role === 'member' || input.role === 'viewer'
    ? input.role
    : 'member';
  const createdAt = input.joinedAt;

  return {
    id: `${input.workspaceId}_${input.userId}`,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    role,
    status: input.status === 'invited' ? 'invited' : input.status === 'removed' ? 'disabled' : 'active',
    createdAt,
    updatedAt: createdAt,
  };
}

async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberDocument[]> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API unavailable for workspace member list');
  }

  const response = await fetch(getWorkspaceUsersEndpoint(workspaceId), {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders({ workspaceId }),
  });

  if (!response.ok) {
    throw new Error(`Workspace member list failed: ${response.status}`);
  }

  const payload = await response.json() as BackendWorkspaceMembersResponse;
  if (!Array.isArray(payload.users)) {
    throw new Error('Workspace member list returned an invalid payload');
  }

  return payload.users
    .map((member) => normalizeWorkspaceMember(member))
    .filter((member): member is WorkspaceMemberDocument => Boolean(member && member.status === 'active'));
}

async function ensureActiveWorkspaceFromBackend(identity: UserIdentity): Promise<WorkspaceSummary> {
  const workspaces = await fetchBackendWorkspaceSummaries();
  const storedWorkspaceId = getStoredWorkspaceId();
  const createdWorkspace = workspaces.length === 0;
  const selectedWorkspace = (storedWorkspaceId
    ? workspaces.find((workspace) => workspace.workspaceId === storedWorkspaceId)
    : undefined)
    || workspaces[0]
    || await createBackendWorkspace(identity);

  setActiveWorkspaceId(selectedWorkspace.workspaceId);
  if (createdWorkspace) {
    trackProductEventOnce('workspace_created', selectedWorkspace.workspaceId, {
      source: 'workspace_session',
      plan: selectedWorkspace.plan,
      provisioning: 'backend',
      is_default: selectedWorkspace.isDefault,
    });
  }
  return selectedWorkspace;
}

export function setActiveWorkspaceId(workspaceId: string | null): void {
  const currentWorkspaceId = getStoredWorkspaceId();
  if (currentWorkspaceId === workspaceId) {
    return;
  }

  setStoredWorkspaceId(workspaceId);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGED_EVENT, {
      detail: { workspaceId },
    }));
  }
}

export function clearActiveWorkspace(): void {
  setActiveWorkspaceId(null);
}

export async function listUserWorkspaces(userId?: string | null): Promise<WorkspaceSummary[]> {
  if (canUseDemoWorkspaceFallback(userId)) {
    const demoWorkspace = buildDemoWorkspaceSummary();
    if (demoWorkspace) {
      return [demoWorkspace];
    }
  }

  if (canUseE2EWorkspaceFallback(userId)) {
    const identity = getE2EBootstrapIdentity();
    if (identity?.userId) {
      return [buildE2EWorkspaceSummary(identity)];
    }
  }

  return fetchBackendWorkspaceSummaries();
}

export async function createPersonalWorkspace(identity?: UserIdentity, name?: string): Promise<WorkspaceSummary> {
  const workspace = await createBackendWorkspace(resolveIdentity(identity), name);
  setActiveWorkspaceId(workspace.workspaceId);
  trackProductEventOnce('workspace_created', workspace.workspaceId, {
    source: 'workspace_session',
    plan: workspace.plan,
    provisioning: 'backend',
    is_default: workspace.isDefault,
  });
  return workspace;
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberDocument[]> {
  return fetchWorkspaceMembers(workspaceId);
}

export async function addWorkspaceMember(input: {
  tenantId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  invitedByUserId: string;
}): Promise<WorkspaceMemberDocument> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API unavailable for workspace member creation');
  }

  const response = await fetch(getWorkspaceUsersEndpoint(input.workspaceId), {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ workspaceId: input.workspaceId }),
    body: JSON.stringify({ userId: input.userId, role: input.role }),
  });

  if (!response.ok) {
    throw new Error(`Workspace member creation failed: ${response.status}`);
  }

  const member = normalizeWorkspaceMember(await response.json() as BackendWorkspaceMember);
  if (!member) {
    throw new Error('Workspace member creation returned an invalid payload');
  }

  return member;
}

export async function removeWorkspaceMember(input: {
  tenantId: string;
  workspaceId: string;
  userId: string;
  removedByUserId: string;
}): Promise<void> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API unavailable for workspace member removal');
  }

  const response = await fetch(
    `${getWorkspaceUsersEndpoint(input.workspaceId)}/${encodeURIComponent(input.userId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders({ workspaceId: input.workspaceId }),
    },
  );

  if (!response.ok) {
    throw new Error(`Workspace member removal failed: ${response.status}`);
  }
}

export async function ensureActiveWorkspace(identity?: UserIdentity): Promise<WorkspaceSummary> {
  const resolvedIdentity = resolveIdentity(identity);

  if (canUseDemoWorkspaceFallback(resolvedIdentity.userId)) {
    const demoWorkspace = buildDemoWorkspaceSummary();
    if (demoWorkspace) {
      setActiveWorkspaceId(demoWorkspace.workspaceId);
      return demoWorkspace;
    }
  }

  if (canUseE2EWorkspaceFallback(resolvedIdentity.userId)) {
    const e2eWorkspace = buildE2EWorkspaceSummary(resolvedIdentity);
    setActiveWorkspaceId(e2eWorkspace.workspaceId);
    return e2eWorkspace;
  }

  try {
    return await ensureActiveWorkspaceFromBackend(resolvedIdentity);
  } catch (error) {
    logWarn('[WorkspaceSession] Backend workspace bootstrap failed', {
      endpoint: API_ENDPOINTS.WORKSPACE.ROOT,
      error,
      fallback: 'workspace-bootstrap-backend-failed',
    });
    throw error;
  }
}
