import { beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceStoreMocks = vi.hoisted(() => ({
  getWorkspaceAsync: vi.fn(),
  getTenantAsync: vi.fn(),
  getWorkspaceUsersAsync: vi.fn(),
  listTenantsForUserAsync: vi.fn(),
  listWorkspaceSummariesForUserAsync: vi.fn(),
  listWorkspacesForUserAsync: vi.fn(),
}));

const auditLogMocks = vi.hoisted(() => ({
  getAuditEvents: vi.fn(),
}));

vi.mock('../services/admin/workspaceStore', () => ({
  getWorkspaceAsync: workspaceStoreMocks.getWorkspaceAsync,
  getTenantAsync: workspaceStoreMocks.getTenantAsync,
  getWorkspaceUsersAsync: workspaceStoreMocks.getWorkspaceUsersAsync,
  listTenantsForUserAsync: workspaceStoreMocks.listTenantsForUserAsync,
  listWorkspaceSummariesForUserAsync: workspaceStoreMocks.listWorkspaceSummariesForUserAsync,
  listWorkspacesForUserAsync: workspaceStoreMocks.listWorkspacesForUserAsync,
}));

vi.mock('../services/admin/auditLog', () => ({
  getAuditEvents: auditLogMocks.getAuditEvents,
}));

describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expõe consultas administrativas básicas', async () => {
    const { AdminPanel } = await import('./adminPanel');
    const panel = new AdminPanel();

    workspaceStoreMocks.getWorkspaceAsync.mockResolvedValueOnce({ workspaceId: 'ws-1' } as never);
    workspaceStoreMocks.getTenantAsync.mockResolvedValueOnce({ tenantId: 'tenant-1' } as never);
    workspaceStoreMocks.listWorkspacesForUserAsync.mockResolvedValueOnce([{ workspaceId: 'ws-1' } as never]);
    workspaceStoreMocks.listWorkspaceSummariesForUserAsync.mockResolvedValueOnce([{ workspaceId: 'ws-1', tenantId: 'tenant-1' } as never]);
    workspaceStoreMocks.listTenantsForUserAsync.mockResolvedValueOnce([{ tenantId: 'tenant-1' } as never]);
    workspaceStoreMocks.getWorkspaceUsersAsync.mockResolvedValueOnce([{ userId: 'user-1', workspaceId: 'ws-1' } as never]);
    auditLogMocks.getAuditEvents.mockReturnValueOnce([{ id: 'evt-1' } as never]);

    await expect(panel.getWorkspace('ws-1')).resolves.toEqual({ workspaceId: 'ws-1' } as never);
    await expect(panel.getTenant('tenant-1')).resolves.toEqual({ tenantId: 'tenant-1' } as never);
    await expect(panel.listWorkspacesForUser('user-1')).resolves.toEqual([{ workspaceId: 'ws-1' } as never]);
    await expect(panel.listWorkspaceSummariesForUser('user-1')).resolves.toEqual([{ workspaceId: 'ws-1', tenantId: 'tenant-1' } as never]);
    await expect(panel.listTenantsForUser('user-1')).resolves.toEqual([{ tenantId: 'tenant-1' } as never]);
    await expect(panel.listWorkspaceUsers('ws-1')).resolves.toEqual([{ userId: 'user-1', workspaceId: 'ws-1' } as never]);
    expect(panel.listAuditEvents({ workspaceId: 'ws-1' })).toEqual([{ id: 'evt-1' } as never]);
  });
});
