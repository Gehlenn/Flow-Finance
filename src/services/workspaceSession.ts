import { auth } from '../../services/firebase';
import { getStoredWorkspaceId, setStoredWorkspaceId } from '../config/api.config';
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

export function getCurrentWorkspaceIdentity(): UserIdentity | undefined {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
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

  if (canUseE2EWorkspaceFallback(resolvedIdentity.userId)) {
    const e2eWorkspace = buildE2EWorkspaceSummary(resolvedIdentity);
    setActiveWorkspaceId(e2eWorkspace.workspaceId);
    return e2eWorkspace;
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
