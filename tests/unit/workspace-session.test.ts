import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';

const workspaceSessionApiMocks = vi.hoisted(() => ({
  getAuthHeadersMock: vi.fn((options?: { workspaceId?: string | null }) => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
    ...(options?.workspaceId ? { 'x-workspace-id': options.workspaceId } : {}),
  })),
}));

const workspaceSessionLoggerMocks = vi.hoisted(() => ({
  logWarnMock: vi.fn(),
}));

const workspaceSessionAnalyticsMocks = vi.hoisted(() => ({
  trackProductEventOnceMock: vi.fn(),
}));

vi.mock('../../src/config/api.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/api.config')>();
  return {
    ...actual,
    API_ENDPOINTS: {
      ...actual.API_ENDPOINTS,
      WORKSPACE: {
        ROOT: 'https://backend.flow.test/api/workspace',
      },
    },
    getAuthHeaders: workspaceSessionApiMocks.getAuthHeadersMock,
  };
});

vi.mock('../../src/utils/logger', () => ({
  logWarn: workspaceSessionLoggerMocks.logWarnMock,
}));

vi.mock('../../src/app/productAnalytics', () => ({
  trackProductEventOnce: workspaceSessionAnalyticsMocks.trackProductEventOnceMock,
}));

import {
  addWorkspaceMember,
  clearActiveWorkspace,
  createPersonalWorkspace,
  ensureActiveWorkspace,
  getCurrentWorkspaceIdentity,
  listUserWorkspaces,
  listWorkspaceMembers,
  removeWorkspaceMember,
  setActiveWorkspaceId,
  WORKSPACE_CHANGED_EVENT,
} from '../../src/services/workspaceSession';

describe('workspaceSession', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('backend offline')));
  });

  afterEach(() => {
    clearActiveWorkspace();
    vi.unstubAllGlobals();
  });

  it('prefers the backend workspace list when the published backend already knows the workspace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workspaces: [
          { workspaceId: 'ws_api_1', tenantId: 'tenant-api', name: 'Workspace API 1', tenantName: 'Tenant API', plan: 'free', role: 'member', isDefault: false },
          { workspaceId: 'ws_api_2', tenantId: 'tenant-api', name: 'Workspace API 2', tenantName: 'Tenant API', plan: 'pro', role: 'owner', isDefault: true },
        ],
      }),
    }) as unknown as typeof fetch);
    localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, 'ws_api_2');

    const workspace = await ensureActiveWorkspace({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });

    expect(workspace.workspaceId).toBe('ws_api_2');
    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws_api_2');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('creates a personal workspace through the backend when the backend list is empty', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workspaces: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workspaceId: 'ws_backend_new',
          tenantId: 'tenant-backend-new',
          name: 'Workspace de Flow User',
          tenantName: 'Tenant de Flow User',
          plan: 'free',
          role: 'owner',
          isDefault: true,
        }),
      });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const workspace = await ensureActiveWorkspace({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });

    expect(workspace.workspaceId).toBe('ws_backend_new');
    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws_backend_new');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://backend.flow.test/api/workspace',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Workspace de Flow User' }),
      }),
    );
    expect(workspaceSessionAnalyticsMocks.trackProductEventOnceMock).toHaveBeenCalledWith(
      'workspace_created',
      'ws_backend_new',
      expect.objectContaining({
        source: 'workspace_session',
        plan: 'free',
        provisioning: 'backend',
        is_default: true,
      }),
    );
  });

  it('fails closed when the backend bootstrap fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('backend down')) as unknown as typeof fetch);

    await expect(ensureActiveWorkspace({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' }))
      .rejects.toThrow('backend down');
    expect(workspaceSessionLoggerMocks.logWarnMock).toHaveBeenCalledWith(
      '[WorkspaceSession] Backend workspace bootstrap failed',
      expect.objectContaining({
        endpoint: 'https://backend.flow.test/api/workspace',
        error: expect.any(Error),
        fallback: 'workspace-bootstrap-backend-failed',
      }),
    );
  });

  it('reuses the stored workspace when it is still available', async () => {
    localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, 'ws_2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workspaces: [
          { workspaceId: 'ws_1', tenantId: 'tenant-1', name: 'Workspace 1', tenantName: 'Tenant 1', plan: 'free', role: 'member', isDefault: false },
          { workspaceId: 'ws_2', tenantId: 'tenant-1', name: 'Workspace 2', tenantName: 'Tenant 1', plan: 'pro', role: 'owner', isDefault: true },
        ],
      }),
    }) as unknown as typeof fetch);

    const workspace = await ensureActiveWorkspace({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });

    expect(workspace.workspaceId).toBe('ws_2');
  });

  it('lists real-user workspaces through the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workspaces: [{ workspaceId: 'ws_1', tenantId: 'tenant-1', name: 'Workspace 1', tenantName: 'Tenant 1', plan: 'free', role: 'member', isDefault: false }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(listUserWorkspaces('user-1')).resolves.toMatchObject([{ workspaceId: 'ws_1' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.flow.test/api/workspace',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('creates a personal workspace through the backend with an explicit name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workspaceId: 'ws_new',
        tenantId: 'tenant-new',
        name: 'Minha empresa',
        tenantName: 'Minha empresa',
        plan: 'free',
        role: 'owner',
        isDefault: true,
      }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const workspace = await createPersonalWorkspace(
      { userId: 'user-1', name: 'Flow User', email: 'user@test.dev' },
      'Minha empresa',
    );

    expect(workspace.workspaceId).toBe('ws_new');
    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws_new');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.flow.test/api/workspace',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Minha empresa' }),
      }),
    );
    expect(workspaceSessionAnalyticsMocks.trackProductEventOnceMock).toHaveBeenCalledWith(
      'workspace_created',
      'ws_new',
      expect.objectContaining({
        source: 'workspace_session',
        plan: 'free',
        provisioning: 'backend',
        is_default: true,
      }),
    );
  });

  it('manages workspace members through the backend routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [{ userId: 'member-1', workspaceId: 'ws-1', tenantId: 'tenant-1', role: 'member', joinedAt: '2026-07-29T00:00:00.000Z', status: 'active' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userId: 'member-2', workspaceId: 'ws-1', tenantId: 'tenant-1', role: 'admin', joinedAt: '2026-07-29T01:00:00.000Z', status: 'active' }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(listWorkspaceMembers('ws-1')).resolves.toMatchObject([{ userId: 'member-1', status: 'active' }]);
    await expect(addWorkspaceMember({
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'member-2',
      role: 'admin',
      invitedByUserId: 'owner-1',
    })).resolves.toMatchObject({ userId: 'member-2', role: 'admin' });
    await expect(removeWorkspaceMember({
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'member-2',
      removedByUserId: 'owner-1',
    })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://backend.flow.test/api/workspace/ws-1/users',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-workspace-id': 'ws-1',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://backend.flow.test/api/workspace/ws-1/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'member-2', role: 'admin' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://backend.flow.test/api/workspace/ws-1/users/member-2',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('persists active workspace changes and emits a browser event', () => {
    const listener = vi.fn();
    window.addEventListener(WORKSPACE_CHANGED_EVENT, listener as EventListener);

    setActiveWorkspaceId('ws_selected');

    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws_selected');
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(WORKSPACE_CHANGED_EVENT, listener as EventListener);
  });

  it('does not emit a browser event again when the workspace id stays the same', () => {
    const listener = vi.fn();
    window.addEventListener(WORKSPACE_CHANGED_EVENT, listener as EventListener);

    setActiveWorkspaceId('ws_selected');
    setActiveWorkspaceId('ws_selected');

    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws_selected');
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(WORKSPACE_CHANGED_EVENT, listener as EventListener);
  });

  it('returns deterministic owner workspace for demo data mode', async () => {
    window.history.pushState({}, '', '/?demoData=1');
    localStorage.setItem('flow_demo_data', '1');
    localStorage.setItem('flow_demo_user_id', 'demo-owner-1');
    localStorage.setItem('flow_demo_user_email', 'demo@flow.dev');
    localStorage.setItem('flow_demo_user_name', 'Demo QA');
    localStorage.setItem('flow_demo_workspace_id', 'ws-demo-owner-1');
    localStorage.setItem('flow_demo_workspace_name', 'Demo Workspace');
    localStorage.setItem('flow_demo_tenant_id', 'tenant-demo-owner-1');
    localStorage.setItem('flow_demo_tenant_name', 'Demo Tenant');

    const workspace = await ensureActiveWorkspace({ userId: 'demo-owner-1', email: 'demo@flow.dev', name: 'Demo QA' });

    expect(workspace.workspaceId).toBe('ws-demo-owner-1');
    expect(workspace.role).toBe('owner');
    expect(workspace.tenantId).toBe('tenant-demo-owner-1');
    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws-demo-owner-1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns deterministic owner workspace for E2E auth mode', async () => {
    localStorage.setItem('flow_e2e_auth', '1');
    localStorage.setItem('flow_e2e_user_id', 'e2e-owner-1');
    localStorage.setItem('flow_e2e_user_email', 'owner@flow.dev');
    localStorage.setItem('flow_e2e_user_name', 'Owner QA');

    const workspace = await ensureActiveWorkspace({ userId: 'e2e-owner-1', email: 'owner@flow.dev', name: 'Owner QA' });

    expect(workspace.workspaceId).toBe('ws-e2e-e2e-owner-1');
    expect(workspace.role).toBe('owner');
    expect(workspace.tenantId).toBe('tenant-e2e-e2e-owner-1');
    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws-e2e-e2e-owner-1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to demo bootstrap identity when firebase auth is unavailable', () => {
    window.history.pushState({}, '', '/?demoData=1');
    localStorage.setItem('flow_demo_data', '1');
    localStorage.setItem('flow_demo_user_id', 'demo-user-1');
    localStorage.setItem('flow_demo_user_email', 'demo@flow.dev');
    localStorage.setItem('flow_demo_user_name', 'Demo QA');

    expect(getCurrentWorkspaceIdentity()).toEqual({
      userId: 'demo-user-1',
      email: 'demo@flow.dev',
      name: 'Demo QA',
      plan: 'pro',
    });
  });

  it('falls back to E2E bootstrap identity when firebase auth is unavailable', () => {
    window.history.pushState({}, '', '/?e2eAuth=1');
    localStorage.setItem('flow_e2e_auth', '1');
    localStorage.setItem('flow_e2e_user_id', 'e2e-user-1');
    localStorage.setItem('flow_e2e_user_email', 'e2e@flow.dev');
    localStorage.setItem('flow_e2e_user_name', 'E2E QA');

    expect(getCurrentWorkspaceIdentity()).toEqual({
      userId: 'e2e-user-1',
      email: 'e2e@flow.dev',
      name: 'E2E QA',
    });
  });
});

