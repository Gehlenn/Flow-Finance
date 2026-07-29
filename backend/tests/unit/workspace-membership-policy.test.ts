import { describe, expect, it } from 'vitest';
import { assertCanAssignWorkspaceRole, assertCanRemoveWorkspaceMember } from '../../src/services/admin/workspaceMembershipPolicy';

describe('workspace membership policy', () => {
  it('rejects invalid roles and prevents admins from granting owner', () => {
    expect(() => assertCanAssignWorkspaceRole('admin', 'invalid')).toThrow(/invalida/i);
    expect(() => assertCanAssignWorkspaceRole('admin', 'owner')).toThrow(/Apenas o owner/i);
    expect(() => assertCanAssignWorkspaceRole('owner', 'owner')).not.toThrow();
  });

  it('requires an owner to remove an owner and preserves the final owner', () => {
    const owner = {
      userId: 'owner-1', workspaceId: 'ws-1', tenantId: 'tenant-1', role: 'owner' as const,
      joinedAt: '2026-07-29T00:00:00.000Z', status: 'active' as const,
    };

    expect(() => assertCanRemoveWorkspaceMember('admin', owner, 2)).toThrow(/Apenas o owner/i);
    expect(() => assertCanRemoveWorkspaceMember('owner', owner, 1)).toThrow(/ultimo owner/i);
    expect(() => assertCanRemoveWorkspaceMember('owner', owner, 2)).not.toThrow();
  });
});
