import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import {
  createWorkspace,
  listWorkspacesForUserAsync,
  addUserToWorkspace,
  getWorkspaceUsersAsync,
} from '../services/admin/workspaceStore';
import { authz } from '../middleware/authz';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

// Criar novo workspace (owner = usuário autenticado)
router.post('/', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Nome do workspace obrigatório' });
  }
  const ws = createWorkspace(name, req.userId!);
  return res.status(201).json(ws);
});

// Listar workspaces do usuário autenticado
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const workspaces = await listWorkspacesForUserAsync(req.userId!);
  res.json({ workspaces });
}));

// Adicionar usuário ao workspace (apenas owner/admin)
// Apenas owner/admin pode adicionar usuários
router.post(
  '/:workspaceId/users',
  workspaceContextMiddleware,
  authz('workspace:members:add'),
  (req: Request, res: Response) => {
    const { userId, role } = req.body;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId obrigatório' });
    }
    const wu = addUserToWorkspace(req.params.workspaceId, userId, role || 'user', req.userId!);
    if (!wu) return res.status(404).json({ error: 'Workspace não encontrado' });
    return res.status(201).json(wu);
  }
);

// Listar usuários do workspace
router.get('/:workspaceId/users', workspaceContextMiddleware, authz('workspace:members:read'), asyncHandler(async (req: Request, res: Response) => {
  const users = await getWorkspaceUsersAsync(req.params.workspaceId);
  res.json({ users });
}));

export default router;
