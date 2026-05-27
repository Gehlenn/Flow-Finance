import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Reminder } from '../types';
import { isSyncPermissionError, shouldDisplaySyncConnectionError } from '../src/utils/syncError';
import {
  replaceSyncEntityCollection,
} from '../src/services/sync/cloudSyncClient';
import {
  saveUserProfile,
  subscribeToUserProfile,
} from '../src/services/firestoreWorkspaceStore';
import {
  createEmptyWorkspaceSyncEntities,
  mapPulledWorkspaceSyncEntities,
  WorkspaceSyncEntities,
} from '../src/services/sync/workspaceSyncEntities';
import {
  createDemoProfileState,
  createDemoWorkspaceEntities,
} from '../src/demo/demoBootstrap';
import { logWarn } from '../src/utils/logger';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export type SyncProfileState = {
  name: string | null;
  theme: 'light' | 'dark';
  alerts: Alert[];
  reminders: Reminder[];
};

export type SyncEntityState = WorkspaceSyncEntities;

export type SyncEntityIdMap = Record<string, string>;

export type SyncEntitiesResult = {
  entities: SyncEntityState;
  idMaps: Partial<Record<keyof SyncEntityState, SyncEntityIdMap>>;
};

interface UseSyncEngineOptions {
  userId: string | null;
  activeTenantId: string | null;
  activeWorkspaceId: string | null;
  isE2EBootstrapActive: boolean;
  isDemoBootstrapActive: boolean;
  cloudSyncEnabled: boolean;
  backendSyncEnabled: boolean;
  onDisableCloudSync: () => void;
  onDisableBackendSync: () => void;
}

const DEFAULT_PROFILE: SyncProfileState = {
  name: null,
  theme: 'light',
  alerts: [],
  reminders: [],
};

function applyIdMapToCollection<TItem extends { id: string }>(
  items: TItem[],
  idMap?: SyncEntityIdMap,
): TItem[] {
  if (!idMap || Object.keys(idMap).length === 0) {
    return items;
  }

  return items.map((item) => {
    const nextId = idMap[item.id];
    return nextId ? { ...item, id: nextId } : item;
  });
}

export function useSyncEngine(options: UseSyncEngineOptions) {
  const {
    userId,
    activeTenantId,
    activeWorkspaceId,
    isE2EBootstrapActive,
    isDemoBootstrapActive,
    cloudSyncEnabled,
    backendSyncEnabled,
    onDisableCloudSync,
    onDisableBackendSync,
  } = options;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [profile, setProfile] = useState<SyncProfileState>(DEFAULT_PROFILE);
  const [entities, setEntities] = useState<SyncEntityState>(() => createEmptyWorkspaceSyncEntities());
  const [isProfileReady, setIsProfileReady] = useState(false);
  const [hasLoadedEntities, setHasLoadedEntities] = useState(false);

  const entityRef = useRef<SyncEntityState>(createEmptyWorkspaceSyncEntities());
  const bootstrapContext = useMemo(() => ({
    userId,
    tenantId: activeTenantId,
    workspaceId: activeWorkspaceId,
  }), [activeTenantId, activeWorkspaceId, userId]);

  useEffect(() => {
    entityRef.current = entities;
  }, [entities]);

  useEffect(() => {
    if (isE2EBootstrapActive) {
      const emptyEntities = createEmptyWorkspaceSyncEntities();
      entityRef.current = emptyEntities;
      setEntities(emptyEntities);
      setHasLoadedEntities(true);
      setSyncStatus('idle');
      return;
    }

    if (isDemoBootstrapActive) {
      const demoEntities = createDemoWorkspaceEntities({
        userId: bootstrapContext.userId || 'demo-user',
        tenantId: bootstrapContext.tenantId || 'tenant-demo-flow-finance',
        workspaceId: bootstrapContext.workspaceId || 'ws-demo-flow-finance',
      });
      entityRef.current = demoEntities;
      setEntities(demoEntities);
      setHasLoadedEntities(true);
      setSyncStatus('idle');
      return;
    }

    if (!userId || !activeWorkspaceId) {
      const emptyEntities = createEmptyWorkspaceSyncEntities();
      entityRef.current = emptyEntities;
      setEntities(emptyEntities);
      setHasLoadedEntities(false);
      return;
    }

    const loadEntities = async () => {
      try {
        if (cloudSyncEnabled || backendSyncEnabled) {
          const nextEntities = await mapPulledWorkspaceSyncEntities(activeWorkspaceId);
          entityRef.current = nextEntities;
          setEntities(nextEntities);
          setHasLoadedEntities(true);
        }
      } catch (error) {
        logWarn('[useSyncEngine] Failed to load synced entities', {
          error,
          fallback: 'use-sync-engine-load-entities-failed',
        });
        if (cloudSyncEnabled) {
          onDisableCloudSync();
        } else {
          onDisableBackendSync();
        }
      }
    };

    void loadEntities();
  }, [
    activeWorkspaceId,
    activeTenantId,
    backendSyncEnabled,
    bootstrapContext,
    cloudSyncEnabled,
    isDemoBootstrapActive,
    isE2EBootstrapActive,
    onDisableBackendSync,
    onDisableCloudSync,
    userId,
  ]);

  useEffect(() => {
    if (isE2EBootstrapActive) {
      setIsProfileReady(true);
      return;
    }

    if (isDemoBootstrapActive) {
      setProfile(createDemoProfileState());
      setIsProfileReady(true);
      return;
    }

    if (!userId) {
      setProfile(DEFAULT_PROFILE);
      setIsProfileReady(false);
      return;
    }

    const unsubscribe = subscribeToUserProfile(
      userId,
      (nextProfile) => {
        setProfile(nextProfile);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 2000);
        setIsProfileReady(true);
      },
      (error) => {
        if (isSyncPermissionError(error)) {
          logWarn('[useSyncEngine] Firestore permission denied while subscribing to user profile', {
            error,
            fallback: 'use-sync-engine-firestore-permission-denied',
          });
          onDisableCloudSync();
        } else {
          logWarn('[useSyncEngine] Firestore connection error while subscribing to user profile', {
            error,
            fallback: 'use-sync-engine-firestore-connection-error',
          });
        }

        if (shouldDisplaySyncConnectionError(error)) {
          setSyncStatus('error');
        } else {
          setSyncStatus('idle');
        }

        setIsProfileReady(true);
      },
    );

    return () => unsubscribe();
  }, [isDemoBootstrapActive, isE2EBootstrapActive, onDisableCloudSync, userId]);

  const syncProfile = useCallback(async (
    updates: Partial<{ name: string; theme: 'light' | 'dark'; alerts: Alert[]; reminders: Reminder[] }>,
  ) => {
    if (!userId) {
      return;
    }

    setSyncStatus('syncing');
    try {
      if (cloudSyncEnabled && Object.keys(updates).length > 0 && !isDemoBootstrapActive && !isE2EBootstrapActive) {
        await saveUserProfile(userId, updates);
      }

      setProfile((current) => ({
        ...current,
        ...updates,
      }));
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      logWarn('[useSyncEngine] Failed to sync profile', {
        error,
        fallback: 'use-sync-engine-profile-sync-failed',
      });
      if (isSyncPermissionError(error)) {
        onDisableCloudSync();
      }
      if (shouldDisplaySyncConnectionError(error)) {
        setSyncStatus('error');
      } else {
        setSyncStatus('idle');
      }
    }
  }, [cloudSyncEnabled, isDemoBootstrapActive, isE2EBootstrapActive, onDisableCloudSync, userId]);

  const syncEntities = useCallback(async (
    updates: Partial<SyncEntityState>,
    previous?: Partial<SyncEntityState>,
  ): Promise<SyncEntitiesResult> => {
    const nextLocalEntities: SyncEntityState = {
      accounts: updates.accounts || entityRef.current.accounts,
      transactions: updates.transactions || entityRef.current.transactions,
      goals: updates.goals || entityRef.current.goals,
      reminders: updates.reminders || entityRef.current.reminders,
      receivables: updates.receivables || entityRef.current.receivables,
    };

    if (isE2EBootstrapActive || isDemoBootstrapActive || !userId || !activeWorkspaceId || !activeTenantId) {
      entityRef.current = nextLocalEntities;
      setEntities(nextLocalEntities);
      setHasLoadedEntities(true);
      setSyncStatus('idle');
      return {
        entities: nextLocalEntities,
        idMaps: {},
      };
    }

    setSyncStatus('syncing');
    try {
      const idMaps: Partial<Record<keyof SyncEntityState, SyncEntityIdMap>> = {};

      if (Array.isArray(updates.accounts)) {
        const result = await replaceSyncEntityCollection(
          'accounts',
          updates.accounts,
          previous?.accounts || entityRef.current.accounts,
          { userId, tenantId: activeTenantId, workspaceId: activeWorkspaceId },
        );
        idMaps.accounts = Object.fromEntries(result.reconciledIds.map((entry) => [entry.clientId, entry.serverId]));
      }

      if (Array.isArray(updates.transactions)) {
        const result = await replaceSyncEntityCollection(
          'transactions',
          updates.transactions,
          previous?.transactions || entityRef.current.transactions,
          { userId, tenantId: activeTenantId, workspaceId: activeWorkspaceId },
        );
        idMaps.transactions = Object.fromEntries(result.reconciledIds.map((entry) => [entry.clientId, entry.serverId]));
      }

      if (Array.isArray(updates.goals)) {
        const result = await replaceSyncEntityCollection(
          'goals',
          updates.goals,
          previous?.goals || entityRef.current.goals,
          { userId, tenantId: activeTenantId, workspaceId: activeWorkspaceId },
        );
        idMaps.goals = Object.fromEntries(result.reconciledIds.map((entry) => [entry.clientId, entry.serverId]));
      }

      if (Array.isArray(updates.reminders)) {
        const result = await replaceSyncEntityCollection(
          'reminders',
          updates.reminders,
          previous?.reminders || entityRef.current.reminders,
          { userId, tenantId: activeTenantId, workspaceId: activeWorkspaceId },
        );
        idMaps.reminders = Object.fromEntries(result.reconciledIds.map((entry) => [entry.clientId, entry.serverId]));
      }

      if (Array.isArray(updates.receivables)) {
        const result = await replaceSyncEntityCollection(
          'receivables',
          updates.receivables,
          previous?.receivables || entityRef.current.receivables,
          { userId, tenantId: activeTenantId, workspaceId: activeWorkspaceId },
        );
        idMaps.receivables = Object.fromEntries(result.reconciledIds.map((entry) => [entry.clientId, entry.serverId]));
      }

      const nextEntities = {
        accounts: Array.isArray(updates.accounts)
          ? applyIdMapToCollection(updates.accounts, idMaps.accounts)
          : entityRef.current.accounts,
        transactions: Array.isArray(updates.transactions)
          ? applyIdMapToCollection(updates.transactions, idMaps.transactions)
          : entityRef.current.transactions,
        goals: Array.isArray(updates.goals)
          ? applyIdMapToCollection(updates.goals, idMaps.goals)
          : entityRef.current.goals,
        reminders: Array.isArray(updates.reminders)
          ? applyIdMapToCollection(updates.reminders, idMaps.reminders)
          : entityRef.current.reminders,
        receivables: Array.isArray(updates.receivables)
          ? applyIdMapToCollection(updates.receivables, idMaps.receivables)
          : entityRef.current.receivables,
      };

      entityRef.current = nextEntities;
      setEntities(nextEntities);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return { entities: nextEntities, idMaps };
    } catch (error) {
      logWarn('[useSyncEngine] Failed to sync entities', {
        error,
        fallback: 'use-sync-engine-entities-sync-failed',
      });
      if (cloudSyncEnabled) {
        onDisableCloudSync();
      } else {
        onDisableBackendSync();
      }
      if (shouldDisplaySyncConnectionError(error)) {
        setSyncStatus('error');
      } else {
        setSyncStatus('idle');
      }
      throw error;
    }
  }, [
    activeTenantId,
    activeWorkspaceId,
    cloudSyncEnabled,
    isDemoBootstrapActive,
    isE2EBootstrapActive,
    onDisableBackendSync,
    onDisableCloudSync,
    userId,
  ]);

  const resetEntityState = useCallback(() => {
    const emptyEntities = createEmptyWorkspaceSyncEntities();
    entityRef.current = emptyEntities;
    setEntities(emptyEntities);
    setHasLoadedEntities(false);
    setSyncStatus('idle');
  }, []);

  return useMemo(() => ({
    syncStatus,
    cloudSyncEnabled,
    backendSyncEnabled,
    profile,
    entities,
    isProfileReady,
    hasLoadedEntities,
    syncProfile,
    syncEntities,
    resetEntityState,
  }), [
    backendSyncEnabled,
    cloudSyncEnabled,
    entities,
    hasLoadedEntities,
    isProfileReady,
    profile,
    resetEntityState,
    syncEntities,
    syncProfile,
    syncStatus,
  ]);
}
