import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import {
  createWorkspace,
  listWorkspaceSummariesForUserAsync,
  addUserToWorkspace,
  getWorkspaceUsersAsync,
  removeUserFromWorkspace,
} from '../services/admin/workspaceStore';
import { authz } from '../middleware/authz';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

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

  const workspace = createWorkspace(name, req.userId!, typeof tenantId === 'string' ? tenantId : undefined);
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
  (req: Request, res: Response) => {
    const { userId, role } = req.body;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId obrigatorio' });
    }

    const membership = addUserToWorkspace(req.params.workspaceId, userId, role || 'member', req.userId!);
    if (!membership) {
      return res.status(404).json({ error: 'Workspace nao encontrado' });
    }

    return res.status(201).json(membership);
  },
);

router.get('/:workspaceId/users', workspaceContextMiddleware, authz('workspace:members:read'), asyncHandler(async (req: Request, res: Response) => {
  const users = await getWorkspaceUsersAsync(req.params.workspaceId);
  res.json({ users });
}));

router.delete('/:workspaceId/users/:userId', workspaceContextMiddleware, authz('workspace:members:remove'), (req: Request, res: Response) => {
  const removed = removeUserFromWorkspace(req.params.userId, req.params.workspaceId);
  if (!removed) {
    return res.status(404).json({ error: 'Membro nao encontrado' });
  }

  return res.status(204).send();
});

export default router;
