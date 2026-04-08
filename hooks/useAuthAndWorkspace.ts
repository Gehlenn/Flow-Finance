import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auth, onAuthStateChanged } from '../services/firebase';
import { addBreadcrumb, clearUser, setUser } from '../src/config/sentry';
import { getStoredWorkspaceId, setStoredWorkspaceId } from '../src/config/api.config';
import { getE2EAuthBootstrap } from '../src/utils/e2eAuthBootstrap';
import { bootstrapBackendSessionFromFirebase } from '../src/services/backendSession';
import { clearEphemeralAccessToken, setEphemeralAccessToken } from '../src/services/authSessionStore';
import {
  clearActiveWorkspace,
  ensureActiveWorkspace,
  WORKSPACE_CHANGED_EVENT,
  WorkspaceSummary,
} from '../src/services/workspaceSession';
import { hydrateGoalsFromCloud } from '../src/services/localSyncService';

const IS_DEV = import.meta.env.DEV;
const INITIAL_LOADING_TIMEOUT_MS = 4000;

export type AuthenticatedUser = {
  id: string | null;
  email: string | null;
  name: string | null;
};

export type ActiveWorkspaceState = {
  workspaceId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  name: string | null;
  plan: WorkspaceSummary['plan'] | null;
  role: WorkspaceSummary['role'] | null;
};

export function useAuthAndWorkspace() {
  const e2eSearch = typeof window === 'undefined' ? '' : window.location.search;
  const e2eBootstrap = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return getE2EAuthBootstrap(window.location.search, window.localStorage, IS_DEV);
  }, [e2eSearch]);
  const isE2EBootstrapActive = Boolean(e2eBootstrap);

  const [user, setCurrentUser] = useState<AuthenticatedUser>({
    id: null,
    email: null,
    name: null,
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [backendSyncEnabled, setBackendSyncEnabled] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspaceState>({
    workspaceId: getStoredWorkspaceId(),
    tenantId: null,
    tenantName: null,
    name: null,
    plan: null,
    role: null,
  });
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const hydrateWorkspace = useCallback(async (userIdentity: AuthenticatedUser) => {
    if (!userIdentity.id) {
      throw new Error('Cannot resolve workspace without an authenticated user');
    }

    const workspace = await ensureActiveWorkspace({
      userId: userIdentity.id,
      name: userIdentity.name,
      email: userIdentity.email,
    });
    setActiveWorkspace({
      workspaceId: workspace.workspaceId,
      tenantId: workspace.tenantId,
      tenantName: workspace.tenantName || workspace.name,
      name: workspace.name,
      plan: workspace.plan,
      role: workspace.role,
    });

    // Hidrata dados locais com a nuvem após o workspace estar pronto (fire-and-forget)
    hydrateGoalsFromCloud().catch(() => {/* falha silenciosa — localStorage permanece */});

    return workspace;
  }, []);

  const refreshWorkspace = useCallback(async () => hydrateWorkspace(userRef.current), [hydrateWorkspace]);

  const setUserName = useCallback((name: string | null) => {
    setCurrentUser((current) => ({ ...current, name }));
  }, []);

  const handleLogin = useCallback((email: string) => {
    setCurrentUser((current) => ({ ...current, email }));
  }, []);

  const handleLogout = useCallback(async () => {
    await auth.signOut();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleWorkspaceChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ workspaceId?: string | null }>;
      const workspaceId = customEvent.detail?.workspaceId || getStoredWorkspaceId();

      setActiveWorkspace({
        workspaceId: workspaceId || null,
        tenantId: null,
        tenantName: null,
        name: null,
        plan: null,
        role: null,
      });

      if (workspaceId && !isE2EBootstrapActive) {
        void refreshWorkspace().catch((error) => {
          console.warn('[Workspace] Failed to refresh workspace context:', error);
        });
      }
    };

    window.addEventListener(WORKSPACE_CHANGED_EVENT, handleWorkspaceChanged as EventListener);
    return () => window.removeEventListener(WORKSPACE_CHANGED_EVENT, handleWorkspaceChanged as EventListener);
  }, [isE2EBootstrapActive, refreshWorkspace]);

  useEffect(() => {
    if (isE2EBootstrapActive && e2eBootstrap) {
      const e2eWorkspaceId = getStoredWorkspaceId() || `ws-e2e-${e2eBootstrap.userId}`;
      setCloudSyncEnabled(false);
      setBackendSyncEnabled(true);
      setCurrentUser({
        id: e2eBootstrap.userId,
        email: e2eBootstrap.userEmail,
        name: e2eBootstrap.userName,
      });
      setStoredWorkspaceId(e2eWorkspaceId);
      setActiveWorkspace({
        workspaceId: e2eWorkspaceId,
        tenantId: 'tenant-e2e',
        tenantName: 'Tenant E2E',
        name: 'Workspace E2E',
        plan: 'free',
        role: 'owner',
      });
      setEphemeralAccessToken(e2eBootstrap.token);
      addBreadcrumb(`E2E auth bootstrap enabled for ${e2eBootstrap.userEmail}`, 'auth', 'info');
      setIsInitialLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setCloudSyncEnabled(true);
        setBackendSyncEnabled(false);
        setCurrentUser({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
        });

        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || undefined,
        });
        addBreadcrumb(`User logged in: ${firebaseUser.email}`, 'auth', 'info');

        if (firebaseUser.email) {
          void firebaseUser.getIdToken()
            .then((idToken) => bootstrapBackendSessionFromFirebase({
              idToken,
              userId: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              isDevelopment: IS_DEV,
              allowLegacyDevelopmentFallback: IS_DEV,
            }))
            .then((payload) => {
              if (!payload?.token) {
                return;
              }

              setEphemeralAccessToken(payload.accessToken || payload.token || null);
              setBackendSyncEnabled(true);
              return hydrateWorkspace({
                id: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName,
              });
            })
            .catch((error) => {
              console.warn('[Auth] Failed to bootstrap backend token:', error);
              setBackendSyncEnabled(false);
            })
            .finally(() => {
              setIsInitialLoading(false);
            });
        } else {
          setIsInitialLoading(false);
        }
      } else {
        setCurrentUser({ id: null, email: null, name: null });
        clearEphemeralAccessToken();
        clearActiveWorkspace();
        setBackendSyncEnabled(false);
        setActiveWorkspace({ workspaceId: null, tenantId: null, tenantName: null, name: null, plan: null, role: null });
        clearUser();
        addBreadcrumb('User logged out', 'auth', 'info');
        setIsInitialLoading(false);
      }
    });

    return () => unsubscribe();
  }, [e2eBootstrap, hydrateWorkspace, isE2EBootstrapActive]);

  useEffect(() => {
    if (!isInitialLoading || isE2EBootstrapActive || typeof window === 'undefined') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      addBreadcrumb('Initial loading timeout fallback triggered', 'app', 'warning');
      setIsInitialLoading(false);
    }, INITIAL_LOADING_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isInitialLoading, isE2EBootstrapActive]);

  const isLoggedIn = useMemo(() => Boolean(user.id), [user.id]);

  return {
    user,
    isLoggedIn,
    isInitialLoading,
    isE2EBootstrapActive,
    cloudSyncEnabled,
    backendSyncEnabled,
    activeWorkspace,
    refreshWorkspace,
    handleLogin,
    handleLogout,
    setUserName,
    setCloudSyncEnabled,
    setBackendSyncEnabled,
  };
}
