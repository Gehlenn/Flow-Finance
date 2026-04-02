import { auth } from '../../services/firebase';
import { getStoredWorkspaceId, setStoredWorkspaceId } from '../config/api.config';
import {
  addWorkspaceMember,
  createPersonalWorkspace as createPersonalWorkspaceInFirestore,
  ensureActiveWorkspaceForUser,
  listWorkspaceAuditEvents,
  listWorkspaceMembers,
  listUserWorkspaceSummaries,
  removeWorkspaceMember,
  type AuditLogDocument,
  type WorkspaceMemberDocument,
  type UserIdentity,
  type WorkspaceSummary,
} from './firestoreWorkspaceStore';

export {
  addWorkspaceMember,
  listWorkspaceAuditEvents,
  listWorkspaceMembers,
  removeWorkspaceMember,
};
export type { AuditLogDocument, WorkspaceMemberDocument, WorkspaceRole, WorkspaceSummary } from './firestoreWorkspaceStore';

export const WORKSPACE_CHANGED_EVENT = 'flow:workspace-changed';

export function getCurrentWorkspaceIdentity(): UserIdentity | undefined {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    return undefined;
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
  return listUserWorkspaceSummaries(userId);
}

export async function createPersonalWorkspace(identity?: UserIdentity, name?: string): Promise<WorkspaceSummary> {
  const workspace = await createPersonalWorkspaceInFirestore(resolveIdentity(identity), name);
  setActiveWorkspaceId(workspace.workspaceId);
  return workspace;
}

export async function ensureActiveWorkspace(identity?: UserIdentity): Promise<WorkspaceSummary> {
  const resolvedIdentity = resolveIdentity(identity);
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
