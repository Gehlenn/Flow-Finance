import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Account } from '../models/Account';
import { Goal, Alert, Reminder, Transaction } from '../types';
import { isSyncPermissionError, shouldDisplaySyncConnectionError } from '../src/utils/syncError';
import {
  extractSyncPayloads,
  pullSyncEntities,
  replaceSyncEntityCollection,
} from '../src/services/sync/cloudSyncClient';
import {
  saveUserProfile,
  subscribeToUserProfile,
} from '../src/services/firestoreWorkspaceStore';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export type SyncProfileState = {
  name: string | null;
  theme: 'light' | 'dark';
  alerts: Alert[];
  reminders: Reminder[];
};

export type SyncEntityState = {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  reminders: Reminder[];
};

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

const DEFAULT_ENTITIES: SyncEntityState = {
  accounts: [],
  transactions: [],
  goals: [],
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
    cloudSyncEnabled,
    backendSyncEnabled,
    onDisableCloudSync,
    onDisableBackendSync,
  } = options;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [profile, setProfile] = useState<SyncProfileState>(DEFAULT_PROFILE);
  const [entities, setEntities] = useState<SyncEntityState>(DEFAULT_ENTITIES);
  const [isProfileReady, setIsProfileReady] = useState(false);
  const [hasLoadedEntities, setHasLoadedEntities] = useState(false);

  const entityRef = useRef<SyncEntityState>(DEFAULT_ENTITIES);

  useEffect(() => {
    entityRef.current = entities;
  }, [entities]);

  useEffect(() => {
    if (!userId || !activeWorkspaceId) {
      entityRef.current = DEFAULT_ENTITIES;
      setEntities(DEFAULT_ENTITIES);
      setHasLoadedEntities(false);
      return;
    }

    const loadEntities = async () => {
      try {
        if (cloudSyncEnabled) {
          const syncData = await pullSyncEntities({ workspaceId: activeWorkspaceId });
          const syncedAccounts = extractSyncPayloads(syncData.entities.accounts) as unknown as Account[];
          const syncedTransactions = extractSyncPayloads(syncData.entities.transactions) as unknown as Transaction[];
          const syncedGoals = extractSyncPayloads(syncData.entities.goals) as unknown as Goal[];
          const syncedReminders = extractSyncPayloads(syncData.entities.reminders) as unknown as Reminder[];

          const nextEntities = {
            accounts: syncedAccounts,
            transactions: syncedTransactions,
            goals: syncedGoals,
            reminders: syncedReminders,
          };

          entityRef.current = nextEntities;
          setEntities(nextEntities);
          setHasLoadedEntities(true);
          return;
        }

        if (backendSyncEnabled) {
          const syncData = await pullSyncEntities({ workspaceId: activeWorkspaceId });
          const syncedAccounts = extractSyncPayloads(syncData.entities.accounts) as unknown as Account[];
          const syncedTransactions = extractSyncPayloads(syncData.entities.transactions) as unknown as Transaction[];
          const syncedGoals = extractSyncPayloads(syncData.entities.goals) as unknown as Goal[];
          const syncedReminders = extractSyncPayloads(syncData.entities.reminders) as unknown as Reminder[];

          const nextEntities = {
            accounts: syncedAccounts,
            transactions: syncedTransactions,
            goals: syncedGoals,
            reminders: syncedReminders,
          };

          entityRef.current = nextEntities;
          setEntities(nextEntities);
          setHasLoadedEntities(true);
        }
      } catch (error) {
        console.error('Falha ao carregar dados sincronizados:', error);
        if (cloudSyncEnabled) {
          onDisableCloudSync();
        } else {
          onDisableBackendSync();
        }
      }
    };

    void loadEntities();
  }, [activeWorkspaceId, backendSyncEnabled, cloudSyncEnabled, onDisableBackendSync, onDisableCloudSync, userId]);

  useEffect(() => {
    if (isE2EBootstrapActive) {
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
          console.warn('Permissao/autenticacao insuficiente no Firestore:', error);
          onDisableCloudSync();
        } else {
          console.error('Erro na conexao com Firestore:', error);
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
  }, [isE2EBootstrapActive, onDisableCloudSync, userId]);

  const syncProfile = useCallback(async (
    updates: Partial<{ name: string; theme: 'light' | 'dark'; alerts: Alert[]; reminders: Reminder[] }>,
  ) => {
    if (!userId) {
      return;
    }

    setSyncStatus('syncing');
    try {
      if (cloudSyncEnabled && Object.keys(updates).length > 0) {
        await saveUserProfile(userId, updates);
      }

      setProfile((current) => ({
        ...current,
        ...updates,
      }));
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('Erro ao sincronizar perfil:', error);
      if (isSyncPermissionError(error)) {
        onDisableCloudSync();
      }
      if (shouldDisplaySyncConnectionError(error)) {
        setSyncStatus('error');
      } else {
        setSyncStatus('idle');
      }
    }
  }, [cloudSyncEnabled, onDisableCloudSync, userId]);

  const syncEntities = useCallback(async (
    updates: Partial<SyncEntityState>,
    previous?: Partial<SyncEntityState>,
  ): Promise<SyncEntitiesResult> => {
    if (!userId || !activeWorkspaceId || !activeTenantId) {
      return {
        entities: {
          accounts: updates.accounts || entityRef.current.accounts,
          transactions: updates.transactions || entityRef.current.transactions,
          goals: updates.goals || entityRef.current.goals,
          reminders: updates.reminders || entityRef.current.reminders,
        },
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
      };

      entityRef.current = nextEntities;
      setEntities(nextEntities);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return { entities: nextEntities, idMaps };
    } catch (error) {
      console.error('Erro ao sincronizar entidades:', error);
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
  }, [activeTenantId, activeWorkspaceId, cloudSyncEnabled, onDisableBackendSync, onDisableCloudSync, userId]);

  const resetEntityState = useCallback(() => {
    entityRef.current = DEFAULT_ENTITIES;
    setEntities(DEFAULT_ENTITIES);
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
