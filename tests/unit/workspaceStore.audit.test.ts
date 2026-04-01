import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorkspace,
  addUserToWorkspace,
  getWorkspaceStoreSnapshotForTests,
  updateWorkspaceBilling,
  resetWorkspaceStoreForTests,
} from '../../backend/src/services/admin/workspaceStore';
import { getAuditEvents, resetAuditLogForTests } from '../../backend/src/services/admin/auditLog';

describe('WorkspaceStore - Audit Log', () => {
  beforeEach(() => {
    resetAuditLogForTests();
    resetWorkspaceStoreForTests();
  });

  it('registra evento de auditoria ao adicionar usuário', () => {
    const ws = createWorkspace('Empresa Teste', 'adminTest');
    addUserToWorkspace(ws.workspaceId, 'userNovo', 'user', 'adminTest');
    const logs = getAuditEvents({ action: 'workspace.addUser', userId: 'adminTest' });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].metadata.addedUserId).toBe('userNovo');
    expect(logs[0].resource).toBe(ws.workspaceId);
  });

  it('persiste o workspace criado em store duravel', () => {
    const ws = createWorkspace('Empresa Persistida', 'owner-1');
    const snapshot = getWorkspaceStoreSnapshotForTests();

    expect(snapshot.workspaces.some((workspace) => workspace.workspaceId === ws.workspaceId)).toBe(true);
    expect(snapshot.workspaceUsers.some((membership) => membership.workspaceId === ws.workspaceId && membership.userId === 'owner-1')).toBe(true);
  });

  it('persiste plano, subscription e entitlements do workspace', () => {
    const ws = createWorkspace('Empresa SaaS', 'owner-2');

    updateWorkspaceBilling(ws.workspaceId, {
      plan: 'pro',
      billingEmail: 'billing@empresa.test',
      subscription: {
        subscriptionId: 'sub_test_1',
        provider: 'internal',
        status: 'active',
        plan: 'pro',
        startedAt: new Date().toISOString(),
      },
    });

    const snapshot = getWorkspaceStoreSnapshotForTests();
    const updated = snapshot.workspaces.find((workspace) => workspace.workspaceId === ws.workspaceId);

    expect(updated?.plan).toBe('pro');
    expect(updated?.subscription?.subscriptionId).toBe('sub_test_1');
    expect(updated?.entitlements?.features).toContain('billingManagement');
  });
});
