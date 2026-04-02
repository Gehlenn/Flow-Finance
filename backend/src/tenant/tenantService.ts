import { Tenant, Workspace } from '../types';
import { AppError } from '../shared/AppError';
import {
  createTenant,
  getLastWorkspaceForUserAsync,
  getTenantAsync,
  getWorkspaceAsync,
  isUserInWorkspaceAsync,
  listTenantsForUserAsync,
  listWorkspacesForUserAsync,
  setLastWorkspaceForUser,
} from '../services/admin/workspaceStore';

export class TenantService {
  createTenant(name: string, ownerUserId: string): { tenant: Tenant; workspace: Workspace } {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new AppError(400, 'Tenant name is required');
    }

    return createTenant(normalizedName, ownerUserId);
  }

  async selectTenant(tenantId: string, userId?: string): Promise<Tenant> {
    let tenant = await getTenantAsync(tenantId);
    let targetWorkspaceId: string | undefined;

    if (!tenant) {
      const workspace = await getWorkspaceAsync(tenantId);
      if (!workspace) {
        throw new AppError(404, 'Tenant not found');
      }

      tenant = await getTenantAsync(workspace.tenantId);
      targetWorkspaceId = workspace.workspaceId;
      if (!tenant) {
        throw new AppError(404, 'Tenant not found');
      }
    }

    if (userId) {
      const workspaces = await listWorkspacesForUserAsync(userId);
      const defaultWorkspace = workspaces.find((workspace) => workspace.workspaceId === targetWorkspaceId)
        || workspaces.find((workspace) => workspace.tenantId === tenant!.tenantId && workspace.isDefault)
        || workspaces.find((workspace) => workspace.tenantId === tenant!.tenantId);

      if (!defaultWorkspace || !await isUserInWorkspaceAsync(userId, defaultWorkspace.workspaceId)) {
        throw new AppError(403, 'User does not belong to the requested tenant');
      }

      setLastWorkspaceForUser(userId, defaultWorkspace.workspaceId);
    }

    return tenant;
  }

  async listTenantsForUser(userId: string): Promise<Tenant[]> {
    return await listTenantsForUserAsync(userId);
  }

  async getLastTenantForUser(userId: string): Promise<Tenant | undefined> {
    const workspace = await getLastWorkspaceForUserAsync(userId);
    if (!workspace) {
      return undefined;
    }

    return await getTenantAsync(workspace.tenantId);
  }

  async getTenantWorkspace(tenantId: string, workspaceId: string, userId?: string): Promise<Workspace> {
    const workspace = await getWorkspaceAsync(workspaceId);
    if (!workspace || workspace.tenantId !== tenantId) {
      throw new AppError(404, 'Workspace not found for tenant');
    }

    if (userId && !await isUserInWorkspaceAsync(userId, workspaceId)) {
      throw new AppError(403, 'User does not belong to the requested workspace');
    }

    return workspace;
  }
}
