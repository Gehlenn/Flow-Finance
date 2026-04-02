import { Request, Response } from 'express';
import { AppError } from '../shared/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { TenantService } from './tenantService';
import { getLastWorkspaceForUserAsync } from '../services/admin/workspaceStore';

const tenantService = new TenantService();

export const createTenant = (req: Request, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name : '';
  const ownerUserId = req.userId || req.body?.ownerUserId;

  if (!ownerUserId || typeof ownerUserId !== 'string') {
    throw new AppError(400, 'ownerUserId is required');
  }

  const { tenant, workspace } = tenantService.createTenant(name, ownerUserId);
  res.status(201).json({
    tenantId: tenant.tenantId,
    tenant,
    workspaceId: workspace.workspaceId,
    workspace,
  });
};

export const selectTenant = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : '';
  const userId = req.userId || req.body?.userId;
  if (!tenantId) {
    throw new AppError(400, 'tenantId is required');
  }

  const tenant = await tenantService.selectTenant(tenantId, userId);
  const workspace = userId ? await getLastWorkspaceForUserAsync(userId) : undefined;

  res.json({
    ...tenant,
    tenantId: tenant.tenantId,
    workspaceId: workspace?.workspaceId || null,
    workspace,
  });
});
