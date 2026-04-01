import { getStoredWorkspaceId } from '../config/api.config';

export function getWorkspaceStorageScope(workspaceId?: string | null): string {
  const normalized = workspaceId?.trim();
  return normalized && normalized.length > 0 ? normalized : 'global';
}

export function getWorkspaceScopedStorageKey(baseKey: string, workspaceId?: string | null): string {
  return `${baseKey}:${getWorkspaceStorageScope(workspaceId)}`;
}

export function getActiveWorkspaceScopedStorageKey(baseKey: string): string {
  return getWorkspaceScopedStorageKey(baseKey, getStoredWorkspaceId());
}
