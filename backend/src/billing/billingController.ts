import { Request, Response } from 'express';
import { billingService } from './billingService';
import { AppError, asyncHandler } from '../middleware/errorHandler';

export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;
  const { plan, billingEmail } = req.body as { plan?: 'free' | 'pro'; billingEmail?: string };

  if (!workspaceId) {
    throw new AppError(400, 'Workspace context is required');
  }

  if (plan !== 'free' && plan !== 'pro') {
    throw new AppError(400, 'Valid plan is required');
  }

  const workspace = await billingService.createSubscription({
    workspaceId,
    plan,
    actorUserId: req.userId!,
    billingEmail,
  });

  res.status(201).json({
    workspaceId: workspace.workspaceId,
    subscription: workspace.subscription,
    entitlements: workspace.entitlements,
    plan: workspace.plan,
  });
});

export const exportData = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;

  if (!workspaceId) {
    throw new AppError(400, 'Workspace context is required');
  }

  const result = await billingService.exportWorkspaceData({ workspaceId });
  res.json(result);
});
