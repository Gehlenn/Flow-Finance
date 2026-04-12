import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthAndWorkspace } from '../../hooks/useAuthAndWorkspace';
import { clearEphemeralAccessToken, getEphemeralAccessToken } from '../../src/services/authSessionStore';

const authWorkspaceMocks = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockBootstrapBackendSessionFromFirebase: vi.fn(),
  mockBootstrapBackendSessionWithPasswordLogin: vi.fn(),
  mockEnsureActiveWorkspace: vi.fn(),
  mockGetE2EAuthBootstrap: vi.fn(),
  mockSetUser: vi.fn(),
  mockClearUser: vi.fn(),
  mockAddBreadcrumb: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  isFirebaseConfigured: true,
}));

vi.mock('../../services/firebase', () => ({
  auth: { signOut: authWorkspaceMocks.mockSignOut },
  onAuthStateChanged: authWorkspaceMocks.mockOnAuthStateChanged,
  get isFirebaseConfigured() {
    return authWorkspaceMocks.isFirebaseConfigured;
  },
}));

vi.mock('../../src/services/backendSession', () => ({
  bootstrapBackendSessionFromFirebase: authWorkspaceMocks.mockBootstrapBackendSessionFromFirebase,
  bootstrapBackendSessionWithPasswordLogin: authWorkspaceMocks.mockBootstrapBackendSessionWithPasswordLogin,
  deriveDevelopmentUserId: (email: string) => `local-${email.split('@')[0]}`,
}));

vi.mock('../../src/services/workspaceSession', () => ({
  WORKSPACE_CHANGED_EVENT: 'flow:workspace-changed',
  ensureActiveWorkspace: authWorkspaceMocks.mockEnsureActiveWorkspace,
  clearActiveWorkspace: vi.fn(),
}));

vi.mock('../../src/utils/e2eAuthBootstrap', () => ({
  getE2EAuthBootstrap: authWorkspaceMocks.mockGetE2EAuthBootstrap,
}));

vi.mock('../../src/config/sentry', () => ({
  setUser: authWorkspaceMocks.mockSetUser,
  clearUser: authWorkspaceMocks.mockClearUser,
  addBreadcrumb: authWorkspaceMocks.mockAddBreadcrumb,
}));

describe('useAuthAndWorkspace', () => {
  let authListener;

  beforeEach(() => {
    localStorage.clear();
    clearEphemeralAccessToken();
    vi.clearAllMocks();
    authWorkspaceMocks.isFirebaseConfigured = true;
    authWorkspaceMocks.mockGetE2EAuthBootstrap.mockReturnValue(null);
    authWorkspaceMocks.mockBootstrapBackendSessionFromFirebase.mockResolvedValue({ token: 'jwt-token' });
    authWorkspaceMocks.mockBootstrapBackendSessionWithPasswordLogin.mockResolvedValue({
      token: 'jwt-local-token',
      accessToken: 'jwt-local-token',
      user: {
        userId: 'local-user-1',
        email: 'local@flow.dev',
      },
    });
    authWorkspaceMocks.mockEnsureActiveWorkspace.mockResolvedValue({
      workspaceId: 'ws_1',
      tenantId: 'tenant_1',
      tenantName: 'Tenant Pessoal',
      name: 'Workspace Pessoal',
      plan: 'free',
      role: 'owner',
    });
    authWorkspaceMocks.mockOnAuthStateChanged.mockImplementation((_auth, listener) => {
      authListener = listener;
      return () => undefined;
    });
  });

  afterEach(() => {
    authListener = undefined;
  });

  it('faz bootstrap da sessao backend e resolve o workspace ativo apos login', async () => {
    const { result } = renderHook(() => useAuthAndWorkspace());

    act(() => {
      authListener?.({
        uid: 'user-1',
        email: 'user@test.dev',
        displayName: 'Flow User',
        getIdToken: vi.fn().mockResolvedValue('firebase-token'),
      });
    });

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.backendSyncEnabled).toBe(true);
    });

    expect(result.current.user.id).toBe('user-1');
    expect(result.current.activeWorkspace.workspaceId).toBe('ws_1');
    expect(result.current.activeWorkspace.tenantId).toBe('tenant_1');
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(getEphemeralAccessToken()).toBe('jwt-token');
    expect(authWorkspaceMocks.mockEnsureActiveWorkspace).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'user@test.dev',
      name: 'Flow User',
    });
    expect(authWorkspaceMocks.mockBootstrapBackendSessionFromFirebase).toHaveBeenCalledWith(expect.objectContaining({
      idToken: 'firebase-token',
      userId: 'user-1',
      email: 'user@test.dev',
    }));
  });

  it('expone logout pela camada de auth/workspace', async () => {
    const { result } = renderHook(() => useAuthAndWorkspace());
    await act(async () => {
      await result.current.handleLogout();
    });

    expect(authWorkspaceMocks.mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('permite bootstrap de login local sem Firebase e hidrata o workspace ativo', async () => {
    authWorkspaceMocks.isFirebaseConfigured = false;
    const { result } = renderHook(() => useAuthAndWorkspace());

    await act(async () => {
      await result.current.handleDevelopmentLogin({
        email: 'local@flow.dev',
        password: '123456',
      });
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.cloudSyncEnabled).toBe(false);
    expect(result.current.backendSyncEnabled).toBe(true);
    expect(result.current.user.id).toBe('local-user-1');
    expect(result.current.activeWorkspace.workspaceId).toBe('ws_1');
    expect(getEphemeralAccessToken()).toBe('jwt-local-token');
    expect(authWorkspaceMocks.mockBootstrapBackendSessionWithPasswordLogin).toHaveBeenCalledWith({
      email: 'local@flow.dev',
      password: '123456',
      userId: 'local-local',
      name: null,
    });
  });

  it('limpa sessao local no logout quando Firebase nao esta configurado', async () => {
    authWorkspaceMocks.isFirebaseConfigured = false;
    const { result } = renderHook(() => useAuthAndWorkspace());

    await act(async () => {
      await result.current.handleDevelopmentLogin({
        email: 'local@flow.dev',
        password: '123456',
      });
    });

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.activeWorkspace.workspaceId).toBeNull();
    expect(getEphemeralAccessToken()).toBeNull();
  });
});
