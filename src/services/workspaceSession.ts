import { auth } from '../../services/firebase';
import { API_ENDPOINTS, getAuthHeaders, getStoredWorkspaceId, setStoredWorkspaceId } from '../config/api.config';
import {
  buildDemoWorkspaceSummary,
  canUseDemoWorkspaceFallback,
  getDemoBootstrapIdentity,
} from '../demo/demoBootstrap';
import {
  addWorkspaceMember,
  createPersonalWorkspace as createPersonalWorkspaceInFirestore,
  ensureActiveWorkspaceForUser,
  listWorkspaceAuditEvents,
  listWorkspaceAuditEventsPage,
  listWorkspaceMembers,
  listUserWorkspaceSummaries,
  removeWorkspaceMember,
  type AuditLogDocument,
  type AuditLogCursor,
  type UserIdentity,
  type WorkspaceMemberDocument,
  type WorkspaceImportDocument,
  type WorkspaceInsightDocument,
  type WorkspaceSubscriptionDocument,
  type WorkspaceSummary,
} from './firestoreWorkspaceStore';
import {
  listWorkspaceCollectionDocuments,
  upsertWorkspaceCollectionDocument,
} from './firestoreWorkspaceEntityStore';
import {
  buildE2EWorkspaceSummary,
  canUseE2EWorkspaceFallback,
  getE2EBootstrapIdentity,
} from './workspaceSessionE2E';
import { logWarn } from '../utils/logger';

export {
  addWorkspaceMember,
  listWorkspaceAuditEvents,
  listWorkspaceAuditEventsPage,
  listWorkspaceCollectionDocuments,
  listWorkspaceMembers,
  removeWorkspaceMember,
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
} from './firestoreWorkspaceStore';

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

async function createBackendWorkspace(identity: UserIdentity): Promise<WorkspaceSummary> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API unavailable for backend workspace creation');
  }

  const response = await fetch(API_ENDPOINTS.WORKSPACE.ROOT, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ includeWorkspace: false }),
    body: JSON.stringify({
      name: buildDefaultWorkspaceName(identity),
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

async function ensureActiveWorkspaceFromBackend(identity: UserIdentity): Promise<WorkspaceSummary> {
  const workspaces = await fetchBackendWorkspaceSummaries();
  const storedWorkspaceId = getStoredWorkspaceId();
  const selectedWorkspace = (storedWorkspaceId
    ? workspaces.find((workspace) => workspace.workspaceId === storedWorkspaceId)
    : undefined)
    || workspaces[0]
    || await createBackendWorkspace(identity);

  setActiveWorkspaceId(selectedWorkspace.workspaceId);
  return selectedWorkspace;
}

export function setActiveWorkspaceId(workspaceId: string | null): void {
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

  return listUserWorkspaceSummaries(userId);
}

export async function createPersonalWorkspace(identity?: UserIdentity, name?: string): Promise<WorkspaceSummary> {
  const workspace = await createPersonalWorkspaceInFirestore(resolveIdentity(identity), name);
  setActiveWorkspaceId(workspace.workspaceId);
  return workspace;
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
    logWarn('[WorkspaceSession] Backend workspace bootstrap failed; falling back to Firestore bootstrap', {
      endpoint: API_ENDPOINTS.WORKSPACE.ROOT,
      error,
      fallback: 'workspace-bootstrap-backend-to-firestore',
    });
  }

  const storedWorkspaceId = getStoredWorkspaceId();
  const workspaces = await listUserWorkspaces(resolvedIdentity.userId);

  const storedWorkspace = storedWorkspaceId
    ? workspaces.find((workspace) => workspace.workspaceId === storedWorkspaceId)
    : undefined;

  if (storedWorkspace) {
    return storedWorkspace;
  }

  const selectedWorkspace = workspaces[0] || await ensureActiveWorkspaceForUser(resolvedIdentity);
  setActiveWorkspaceId(selectedWorkspace.workspaceId);
  return selectedWorkspace;
}
