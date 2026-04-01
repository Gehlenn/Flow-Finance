import { Request, Response } from 'express';
import { AppError } from '../shared/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { TenantService } from './tenantService';

const tenantService = new TenantService();

export const createTenant = (req: Request, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name : '';
  const ownerUserId = req.userId || req.body?.ownerUserId;

  if (!ownerUserId || typeof ownerUserId !== 'string') {
    throw new AppError(400, 'ownerUserId is required');
  }

  const tenant = tenantService.createTenant(name, ownerUserId);
  res.status(201).json(tenant);
};

export const selectTenant = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : '';
  if (!tenantId) {
    throw new AppError(400, 'tenantId is required');
  }

  const tenant = await tenantService.selectTenant(tenantId, req.userId || req.body?.userId);
  res.json(tenant);
});
