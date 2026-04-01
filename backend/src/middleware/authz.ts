import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/AppError';
import { asyncHandler } from './errorHandler';
import { getUserRoleInWorkspaceAsync } from '../services/admin/workspaceStore';
import { assertCanPerform, assertFeatureEnabled, FeatureKey } from '../../shared/policyEngine';

type RequestWithWorkspace = Request & {
  workspaceId?: string;
  workspace?: {
    plan?: 'free' | 'pro';
  };
};

async function resolveAuthorizationContext(req: RequestWithWorkspace): Promise<{
  userId: string;
  workspaceId: string;
  role: 'admin' | 'member';
  plan: 'free' | 'pro';
}> {
  const userId = req.userId;
  const workspaceId = req.workspaceId;

  if (!userId || !workspaceId) {
    throw new AppError(401, 'Usuario ou workspace nao autenticado');
  }

  const role = await getUserRoleInWorkspaceAsync(userId, workspaceId);
  if (!role) {
    throw new AppError(403, 'Usuario nao pertence ao workspace');
  }

  return {
    userId,
    workspaceId,
    role: role === 'owner' ? 'admin' : (role as 'admin' | 'member'),
    plan: (req.workspace?.plan || 'free') as 'free' | 'pro',
  };
}

export function authz(permission: string) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await resolveAuthorizationContext(req as RequestWithWorkspace);
      assertCanPerform(context, permission);
      next();
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode || 403).json({
          error: err.message,
          details: err.details,
          statusCode: err.statusCode,
        });
        return;
      }

      res.status(403).json({ error: 'Acesso negado', statusCode: 403 });
    }
  });
}

export function requireFeature(feature: FeatureKey) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await resolveAuthorizationContext(req as RequestWithWorkspace);
      assertFeatureEnabled(context, feature);
      next();
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode || 402).json({
          error: err.message,
          details: err.details,
          statusCode: err.statusCode,
        });
        return;
      }

      res.status(403).json({ error: 'Feature indisponivel', statusCode: 403 });
    }
  });
}
