import { beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceStoreMocks = vi.hoisted(() => ({
  getWorkspaceAsync: vi.fn(),
  getTenantAsync: vi.fn(),
  isUserInWorkspaceAsync: vi.fn(),
  getUserRoleInWorkspaceAsync: vi.fn(),
}));

vi.mock('../../backend/src/services/admin/workspaceStore', () => workspaceStoreMocks);

async function loadWorkspaceContextModule() {
  vi.resetModules();
  return import('../../backend/src/middleware/workspaceContext');
}

async function loadAuthzModule() {
  vi.resetModules();
  return import('../../backend/src/middleware/authz');
}

function makeResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as any;
  res.status.mockReturnValue(res);
  return res;
}

describe('async workspace authorization middlewares', () => {
  beforeEach(() => {
    workspaceStoreMocks.getWorkspaceAsync.mockReset();
    workspaceStoreMocks.getTenantAsync.mockReset();
    workspaceStoreMocks.isUserInWorkspaceAsync.mockReset();
    workspaceStoreMocks.getUserRoleInWorkspaceAsync.mockReset();
  });

  it('workspaceContextMiddleware uses async workspace lookup and injects workspace context', async () => {
    const { workspaceContextMiddleware } = await loadWorkspaceContextModule();
    workspaceStoreMocks.getWorkspaceAsync.mockResolvedValue({
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      name: 'Workspace 1',
      isDefault: true,
      plan: 'pro',
      entitlements: {
        features: ['adminConsole'],
        limits: {
          transactionsPerMonth: 100,
          aiQueriesPerMonth: 10,
          bankConnections: 1,
        },
      },
    });
    workspaceStoreMocks.getTenantAsync.mockResolvedValue({
      tenantId: 'tenant-1',
      plan: 'pro',
    });
    workspaceStoreMocks.isUserInWorkspaceAsync.mockResolvedValue(true);

    const req = {
      userId: 'owner-1',
      header: vi.fn().mockImplementation((name: string) => name === 'x-workspace-id' ? 'ws-1' : undefined),
      params: {},
      query: {},
      body: {},
    } as any;
    const res = makeResponse();
    const next = vi.fn();

    workspaceContextMiddleware(req, res, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(workspaceStoreMocks.getWorkspaceAsync).toHaveBeenCalledWith('ws-1');
    expect(workspaceStoreMocks.getTenantAsync).toHaveBeenCalledWith('tenant-1');
    expect(workspaceStoreMocks.isUserInWorkspaceAsync).toHaveBeenCalledWith('owner-1', 'ws-1');
    expect(req.workspaceId).toBe('ws-1');
    expect(req.tenantId).toBe('tenant-1');
    expect(req.workspace).toMatchObject({ workspaceId: 'ws-1', tenantId: 'tenant-1', plan: 'pro' });
    expect(next).toHaveBeenCalled();
  });

  it('authz uses async role lookup before evaluating permissions', async () => {
    const { authz } = await loadAuthzModule();
    workspaceStoreMocks.getUserRoleInWorkspaceAsync.mockResolvedValue('owner');

    const req = {
      userId: 'owner-1',
      workspaceId: 'ws-1',
      workspace: { plan: 'pro' },
    } as any;
    const res = makeResponse();
    const next = vi.fn();

    authz('billing:manage')(req, res, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(workspaceStoreMocks.getUserRoleInWorkspaceAsync).toHaveBeenCalledWith('owner-1', 'ws-1');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
