import { Workspace } from '../types';
import { AppError } from '../shared/AppError';
import {
  createWorkspace,
  getLastWorkspaceForUserAsync,
  getWorkspaceAsync,
  isUserInWorkspaceAsync,
  listWorkspacesForUserAsync,
  setLastWorkspaceForUser,
} from '../services/admin/workspaceStore';

export class TenantService {
  createTenant(name: string, ownerUserId: string): Workspace {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new AppError(400, 'Tenant name is required');
    }

    return createWorkspace(normalizedName, ownerUserId);
  }

  async selectTenant(tenantId: string, userId?: string): Promise<Workspace> {
    const tenant = await getWorkspaceAsync(tenantId);
    if (!tenant) {
      throw new AppError(404, 'Tenant not found');
    }

    if (userId && !await isUserInWorkspaceAsync(userId, tenantId)) {
      throw new AppError(403, 'User does not belong to the requested tenant');
    }

    if (userId) {
      setLastWorkspaceForUser(userId, tenantId);
    }

    return tenant;
  }

  async listTenantsForUser(userId: string): Promise<Workspace[]> {
    return await listWorkspacesForUserAsync(userId);
  }

  async getLastTenantForUser(userId: string): Promise<Workspace | undefined> {
    return await getLastWorkspaceForUserAsync(userId);
  }
}
