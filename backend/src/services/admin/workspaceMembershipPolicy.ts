import { Role, WorkspaceUser } from '../../types';
import { AppError } from '../../shared/AppError';

export function isWorkspaceRole(value: unknown): value is Role {
  return value === 'owner' || value === 'admin' || value === 'member' || value === 'viewer';
}

export function assertCanAssignWorkspaceRole(actorRole: Role | undefined, requestedRole: unknown): asserts requestedRole is Role {
  if (!isWorkspaceRole(requestedRole)) {
    throw new AppError(400, 'Role de membro invalida');
  }

  if (requestedRole === 'owner' && actorRole !== 'owner') {
    throw new AppError(403, 'Apenas o owner pode conceder role owner');
  }

  if (!actorRole || !['owner', 'admin'].includes(actorRole)) {
    throw new AppError(403, 'Acesso negado para gerenciar membros');
  }
}

export function assertCanRemoveWorkspaceMember(
  actorRole: Role | undefined,
  targetMembership: WorkspaceUser,
  activeOwnerCount: number,
): void {
  if (!actorRole || !['owner', 'admin'].includes(actorRole)) {
    throw new AppError(403, 'Acesso negado para gerenciar membros');
  }

  if (targetMembership.role !== 'owner') {
    return;
  }

  if (actorRole !== 'owner') {
    throw new AppError(403, 'Apenas o owner pode remover outro owner');
  }

  if (activeOwnerCount <= 1) {
    throw new AppError(409, 'Nao e permitido remover o ultimo owner do workspace');
  }
}
