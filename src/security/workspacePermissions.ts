import type { WorkspaceRole } from '../services/workspaceSession';

export function canManageWorkspaceMembers(role?: WorkspaceRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageWorkspaceBilling(role?: WorkspaceRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function canViewWorkspaceAudit(role?: WorkspaceRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function canEditWorkspaceFinancialData(role?: WorkspaceRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

export function isWorkspaceViewer(role?: WorkspaceRole | null): boolean {
  return role === 'viewer';
}
