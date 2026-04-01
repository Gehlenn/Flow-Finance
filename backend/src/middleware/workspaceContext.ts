import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from './errorHandler';
import { getWorkspaceAsync, isUserInWorkspaceAsync } from '../services/admin/workspaceStore';

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

  (req as Request & { workspaceId?: string; workspace?: unknown }).workspaceId = workspaceId;
  (req as Request & { workspaceId?: string; workspace?: unknown }).workspace = workspace;
  next();
});
