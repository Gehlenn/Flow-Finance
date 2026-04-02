import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from './errorHandler';
import { getTenantAsync, getWorkspaceAsync, isUserInWorkspaceAsync } from '../services/admin/workspaceStore';

/**
 * Middleware que injeta o contexto de workspace na request.
 * Espera o header `x-workspace-id` ou param `workspaceId`.
 * Garante que o usuario autenticado pertence ao workspace.
 */
export const workspaceContextMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const workspaceId =
    req.header('x-workspace-id') ||
    req.params.workspaceId ||
    req.query.workspaceId ||
    req.body?.workspaceId;

  if (!workspaceId || typeof workspaceId !== 'string') {
    res.status(400).json({ error: 'WorkspaceId obrigatorio', statusCode: 400 });
    return;
  }

  const workspace = await getWorkspaceAsync(workspaceId);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace nao encontrado', statusCode: 404 });
    return;
  }

  if (!req.userId || !await isUserInWorkspaceAsync(req.userId, workspaceId)) {
    res.status(403).json({ error: 'Acesso negado ao workspace', statusCode: 403 });
    return;
  }

  const tenant = await getTenantAsync(workspace.tenantId);
  req.tenantId = workspace.tenantId;
  req.workspaceId = workspaceId;
  req.workspace = workspace;
  req.tenantContext = {
    tenantId: workspace.tenantId,
    plan: tenant?.plan || workspace.plan,
    features: workspace.entitlements?.features || [],
    limits: {
      transactionsPerMonth: workspace.entitlements?.limits.transactionsPerMonth || 0,
      aiQueriesPerMonth: workspace.entitlements?.limits.aiQueriesPerMonth || 0,
      bankConnections: workspace.entitlements?.limits.bankConnections || 0,
    },
  };
  next();
});
