import {
  API_ENDPOINTS,
  getAuthHeaders,
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from '../config/api.config';

export type WorkspaceSummary = {
  workspaceId: string;
  name: string;
  plan: 'free' | 'pro';
};

export const WORKSPACE_CHANGED_EVENT = 'flow:workspace-changed';

function buildDefaultWorkspaceName(): string {
  return 'Workspace Pessoal';
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

export async function listUserWorkspaces(): Promise<WorkspaceSummary[]> {
  const response = await fetch(API_ENDPOINTS.WORKSPACE.ROOT, {
    method: 'GET',
    headers: getAuthHeaders({ includeWorkspace: false }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao listar workspaces (${response.status})`);
  }

  const body = await response.json() as { workspaces?: WorkspaceSummary[] };
  return body.workspaces || [];
}

export async function createPersonalWorkspace(name = buildDefaultWorkspaceName()): Promise<WorkspaceSummary> {
  const response = await fetch(API_ENDPOINTS.WORKSPACE.ROOT, {
    method: 'POST',
    headers: getAuthHeaders({ includeWorkspace: false }),
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao criar workspace (${response.status})`);
  }

  return await response.json() as WorkspaceSummary;
}

export async function ensureActiveWorkspace(): Promise<WorkspaceSummary> {
  const storedWorkspaceId = getStoredWorkspaceId();
  const workspaces = await listUserWorkspaces();

  const storedWorkspace = storedWorkspaceId
    ? workspaces.find((workspace) => workspace.workspaceId === storedWorkspaceId)
    : undefined;

  if (storedWorkspace) {
    return storedWorkspace;
  }

  const selectedWorkspace = workspaces[0] || await createPersonalWorkspace();
  setActiveWorkspaceId(selectedWorkspace.workspaceId);
  return selectedWorkspace;
}
