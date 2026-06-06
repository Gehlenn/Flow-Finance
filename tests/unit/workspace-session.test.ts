import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';

const firestoreWorkspaceMocks = vi.hoisted(() => ({
  listUserWorkspaceSummariesMock: vi.fn(),
  createPersonalWorkspaceMock: vi.fn(),
  ensureActiveWorkspaceForUserMock: vi.fn(),
}));

const workspaceSessionApiMocks = vi.hoisted(() => ({
  getAuthHeadersMock: vi.fn(() => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
  })),
}));

const workspaceSessionLoggerMocks = vi.hoisted(() => ({
  logWarnMock: vi.fn(),
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

vi.mock('../../src/services/firestoreWorkspaceStore', () => ({
  listUserWorkspaceSummaries: firestoreWorkspaceMocks.listUserWorkspaceSummariesMock,
  createPersonalWorkspace: firestoreWorkspaceMocks.createPersonalWorkspaceMock,
  ensureActiveWorkspaceForUser: firestoreWorkspaceMocks.ensureActiveWorkspaceForUserMock,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: workspaceSessionLoggerMocks.logWarnMock,
}));

import {
  clearActiveWorkspace,
  ensureActiveWorkspace,
  getCurrentWorkspaceIdentity,
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
    expect(firestoreWorkspaceMocks.listUserWorkspaceSummariesMock).not.toHaveBeenCalled();
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
    expect(firestoreWorkspaceMocks.ensureActiveWorkspaceForUserMock).not.toHaveBeenCalled();
  });

  it('falls back to the Firestore bootstrap path when the backend bootstrap fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('backend down')) as unknown as typeof fetch);
    firestoreWorkspaceMocks.listUserWorkspaceSummariesMock.mockResolvedValue([]);
    firestoreWorkspaceMocks.ensureActiveWorkspaceForUserMock.mockResolvedValue({
      workspaceId: 'ws_new',
      tenantId: 'tenant-new',
      name: 'Workspace Pessoal',
      tenantName: 'Tenant de Flow User',
      plan: 'free',
      role: 'owner',
      isDefault: true,
    });

    const workspace = await ensureActiveWorkspace({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });

    expect(workspace.workspaceId).toBe('ws_new');
    expect(firestoreWorkspaceMocks.ensureActiveWorkspaceForUserMock).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Flow User',
      email: 'user@test.dev',
    });
    expect(workspaceSessionLoggerMocks.logWarnMock).toHaveBeenCalledWith(
      '[WorkspaceSession] Backend workspace bootstrap failed; falling back to Firestore bootstrap',
      expect.objectContaining({
        endpoint: 'https://backend.flow.test/api/workspace',
        fallback: 'workspace-bootstrap-backend-to-firestore',
      }),
    );
  });

  it('reuses the stored workspace when it is still available', async () => {
    localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, 'ws_2');
    firestoreWorkspaceMocks.listUserWorkspaceSummariesMock.mockResolvedValue([
      { workspaceId: 'ws_1', tenantId: 'tenant-1', name: 'Workspace 1', tenantName: 'Tenant 1', plan: 'free', role: 'member', isDefault: false },
      { workspaceId: 'ws_2', tenantId: 'tenant-1', name: 'Workspace 2', tenantName: 'Tenant 1', plan: 'pro', role: 'owner', isDefault: true },
    ]);

    const workspace = await ensureActiveWorkspace({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });

    expect(workspace.workspaceId).toBe('ws_2');
    expect(firestoreWorkspaceMocks.listUserWorkspaceSummariesMock).toHaveBeenCalledWith('user-1');
  });

  it('creates a personal workspace when the user has none', async () => {
    firestoreWorkspaceMocks.listUserWorkspaceSummariesMock.mockResolvedValue([]);
    firestoreWorkspaceMocks.ensureActiveWorkspaceForUserMock.mockResolvedValue({
      workspaceId: 'ws_new',
      tenantId: 'tenant-new',
      name: 'Workspace Pessoal',
      tenantName: 'Tenant de Flow User',
      plan: 'free',
      role: 'owner',
      isDefault: true,
    });

    const workspace = await ensureActiveWorkspace({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' });

    expect(workspace.workspaceId).toBe('ws_new');
    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws_new');
    expect(firestoreWorkspaceMocks.ensureActiveWorkspaceForUserMock).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Flow User',
      email: 'user@test.dev',
    });
  });

  it('persists active workspace changes and emits a browser event', () => {
    const listener = vi.fn();
    window.addEventListener(WORKSPACE_CHANGED_EVENT, listener as EventListener);

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
    expect(firestoreWorkspaceMocks.listUserWorkspaceSummariesMock).not.toHaveBeenCalled();
    expect(firestoreWorkspaceMocks.ensureActiveWorkspaceForUserMock).not.toHaveBeenCalled();
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
    expect(firestoreWorkspaceMocks.listUserWorkspaceSummariesMock).not.toHaveBeenCalled();
    expect(firestoreWorkspaceMocks.ensureActiveWorkspaceForUserMock).not.toHaveBeenCalled();
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

