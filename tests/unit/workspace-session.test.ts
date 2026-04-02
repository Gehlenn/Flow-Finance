import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';

const firestoreWorkspaceMocks = vi.hoisted(() => ({
  listUserWorkspaceSummariesMock: vi.fn(),
  createPersonalWorkspaceMock: vi.fn(),
  ensureActiveWorkspaceForUserMock: vi.fn(),
}));

vi.mock('../../src/services/firestoreWorkspaceStore', () => ({
  listUserWorkspaceSummaries: firestoreWorkspaceMocks.listUserWorkspaceSummariesMock,
  createPersonalWorkspace: firestoreWorkspaceMocks.createPersonalWorkspaceMock,
  ensureActiveWorkspaceForUser: firestoreWorkspaceMocks.ensureActiveWorkspaceForUserMock,
}));

import {
  clearActiveWorkspace,
  ensureActiveWorkspace,
  setActiveWorkspaceId,
  WORKSPACE_CHANGED_EVENT,
} from '../../src/services/workspaceSession';

describe('workspaceSession', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearActiveWorkspace();
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
});
