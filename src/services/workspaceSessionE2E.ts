import { getStoredWorkspaceId } from '../config/api.config';
import type { UserIdentity, WorkspaceSummary } from './firestoreWorkspaceTypes';

export function getE2EBootstrapIdentity(): UserIdentity | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const isE2EAuth = window.localStorage.getItem('flow_e2e_auth') === '1';
  if (!isE2EAuth) {
    return undefined;
  }

  const userId = window.localStorage.getItem('flow_e2e_user_id');
  if (!userId) {
    return undefined;
  }

  return {
    userId,
    email: window.localStorage.getItem('flow_e2e_user_email'),
    name: window.localStorage.getItem('flow_e2e_user_name'),
  };
}

export function canUseE2EWorkspaceFallback(userId?: string | null): boolean {
  const e2eIdentity = getE2EBootstrapIdentity();
  if (!e2eIdentity?.userId) {
    return false;
  }

  return !userId || userId === e2eIdentity.userId;
}

export function buildE2EWorkspaceSummary(identity: UserIdentity): WorkspaceSummary {
  const workspaceId = getStoredWorkspaceId() || `ws-e2e-${identity.userId}`;

  return {
    workspaceId,
    tenantId: `tenant-e2e-${identity.userId}`,
    name: 'Workspace E2E',
    tenantName: 'Tenant E2E',
    plan: 'free',
    role: 'owner',
    isDefault: true,
  };
}
