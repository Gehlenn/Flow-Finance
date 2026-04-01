import { beforeEach, describe, expect, it } from 'vitest';
import {
  addUserToWorkspace,
  createWorkspace,
  getUserRoleInWorkspace,
  isUserInWorkspace,
  listWorkspacesForUser,
  removeUserFromWorkspace,
  resetWorkspaceStoreForTests,
} from '../../backend/src/services/admin/workspaceStore';
import { getAuditEvents, resetAuditLogForTests } from '../../backend/src/services/admin/auditLog';

describe('Multi-tenant Workspace Isolation', () => {
  beforeEach(() => {
    resetWorkspaceStoreForTests();
    resetAuditLogForTests();
  });

  it('nao permite que usuario acesse workspace de outro', () => {
    createWorkspace('Empresa A', 'userA');
    const ws2 = createWorkspace('Empresa B', 'userB');

    expect(isUserInWorkspace('userA', ws2.workspaceId)).toBe(false);
  });

  it('owner/admin pode adicionar usuario ao seu workspace', () => {
    const ws = createWorkspace('Empresa C', 'adminUser');
    const membership = addUserToWorkspace(ws.workspaceId, 'userNovo', 'user', 'adminUser');

    expect(membership?.userId).toBe('userNovo');
    expect(getUserRoleInWorkspace('userNovo', ws.workspaceId)).toBe('user');
  });

  it('owner pode remover usuario e acesso e bloqueado imediatamente', () => {
    const ws = createWorkspace('Empresa D', 'ownerD');
    addUserToWorkspace(ws.workspaceId, 'userRemovido', 'user', 'ownerD');

    expect(isUserInWorkspace('userRemovido', ws.workspaceId)).toBe(true);
    expect(removeUserFromWorkspace('userRemovido', ws.workspaceId)).toBe(true);
    expect(isUserInWorkspace('userRemovido', ws.workspaceId)).toBe(false);
  });

  it('usuario em multiplos workspaces so lista os workspaces em que pertence', () => {
    const ws1 = createWorkspace('Empresa E', 'multiUser');
    const ws2 = createWorkspace('Empresa F', 'adminF');
    addUserToWorkspace(ws2.workspaceId, 'multiUser', 'user', 'adminF');

    const workspaces = listWorkspacesForUser('multiUser');
    expect(workspaces.map((workspace) => workspace.workspaceId).sort()).toEqual(
      [ws1.workspaceId, ws2.workspaceId].sort(),
    );
  });

  it('toda acao sensivel gera log de auditoria', () => {
    const ws = createWorkspace('Empresa G', 'ownerG');
    addUserToWorkspace(ws.workspaceId, 'userAudit', 'user', 'ownerG');

    const logs = getAuditEvents({ action: 'workspace.addUser', userId: 'ownerG' });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].resource).toBe(ws.workspaceId);
  });
});
