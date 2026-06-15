import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import { workspaceLimiterByUser } from '../middleware/rateLimit';
import {
  createWorkspaceAsync,
  listWorkspaceSummariesForUserAsync,
  addUserToWorkspaceAsync,
  getWorkspaceUsersAsync,
  removeUserFromWorkspaceAsync,
} from '../services/admin/workspaceStore';
import { authz } from '../middleware/authz';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);
router.use(workspaceLimiterByUser);

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeRole(value: unknown): 'owner' | 'admin' | 'member' | 'viewer' {
  return value === 'owner' || value === 'admin' || value === 'member' || value === 'viewer' ? value : 'member';
}

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, tenantId } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Nome do workspace obrigatorio' });
    return;
  }

  if (typeof tenantId === 'string' && tenantId.length > 0) {
    const workspaces = await listWorkspaceSummariesForUserAsync(req.userId!);
    const canManageTenant = workspaces.some((workspace) => (
      workspace.tenantId === tenantId && (workspace.role === 'owner' || workspace.role === 'admin')
    ));

    if (!canManageTenant) {
      res.status(403).json({ error: 'Acesso negado para criar workspace neste tenant' });
      return;
    }
  }

  const workspace = await createWorkspaceAsync(name, req.userId!, typeof tenantId === 'string' ? tenantId : undefined);
  res.status(201).json(workspace);
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const workspaces = await listWorkspaceSummariesForUserAsync(req.userId!);
  res.json({ workspaces });
}));

router.post(
  '/:workspaceId/users',
  workspaceContextMiddleware,
  authz('workspace:members:add'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, role } = req.body;
    const workspaceId = normalizeParam(req.params.workspaceId);

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId obrigatorio' });
      return;
    }

    if (!workspaceId) {
      res.status(400).json({ error: 'workspaceId obrigatorio' });
      return;
    }

    const membership = await addUserToWorkspaceAsync(workspaceId, userId, normalizeRole(role), req.userId!);
    if (!membership) {
      res.status(404).json({ error: 'Workspace nao encontrado' });
      return;
    }

    res.status(201).json(membership);
  }),
);

router.get('/:workspaceId/users', workspaceContextMiddleware, authz('workspace:members:read'), asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = normalizeParam(req.params.workspaceId);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId obrigatorio' });
    return;
  }

  const users = await getWorkspaceUsersAsync(workspaceId);
  res.json({ users });
}));

router.delete('/:workspaceId/users/:userId', workspaceContextMiddleware, authz('workspace:members:remove'), asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = normalizeParam(req.params.workspaceId);
  const userId = normalizeParam(req.params.userId);

  if (!workspaceId || !userId) {
    res.status(400).json({ error: 'workspaceId e userId obrigatorios' });
    return;
  }

  const removed = await removeUserFromWorkspaceAsync(userId, workspaceId);
  if (!removed) {
    res.status(404).json({ error: 'Membro nao encontrado' });
    return;
  }

  res.status(204).send();
}));

export default router;
