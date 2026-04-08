import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncEngine } from '../../hooks/useSyncEngine';

const syncEngineMocks = vi.hoisted(() => ({
  mockPullSyncEntities: vi.fn(),
  mockReplaceSyncEntityCollection: vi.fn().mockResolvedValue({
    success: true,
    upserted: 1,
    deleted: 0,
    latestServerUpdatedAt: '2026-04-01T12:00:00.000Z',
    reconciledIds: [],
  }),
  mockSubscribeToUserProfile: vi.fn(),
  mockSaveUserProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/sync/cloudSyncClient', () => ({
  pullSyncEntities: syncEngineMocks.mockPullSyncEntities,
  replaceSyncEntityCollection: syncEngineMocks.mockReplaceSyncEntityCollection,
  extractSyncPayloads: (items: Array<{ payload?: unknown; deleted?: boolean }>) =>
    items.filter((item) => !item.deleted && item.payload).map((item) => item.payload),
}));

vi.mock('../../src/services/firestoreWorkspaceStore', () => ({
  subscribeToUserProfile: syncEngineMocks.mockSubscribeToUserProfile,
  saveUserProfile: syncEngineMocks.mockSaveUserProfile,
}));

describe('useSyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncEngineMocks.mockSubscribeToUserProfile.mockImplementation((_userId, onNext) => {
      onNext({
        name: 'Flow User',
        theme: 'dark',
        alerts: [{ id: 'a1', category: 'Geral', threshold: 100, timeframe: 'mensal' }],
        reminders: [{ id: 'r1', title: 'Pagar', date: '2026-04-01', type: 'Pessoal', completed: false, priority: 'media' }],
      });
      return () => undefined;
    });
    syncEngineMocks.mockPullSyncEntities.mockResolvedValue({
      entities: {
        accounts: [{ id: 'acc-1', payload: { id: 'acc-1', name: 'Carteira', type: 'cash', balance: 0, currency: 'BRL', user_id: 'user-1', workspace_id: 'ws-1', tenant_id: 'tenant-1', created_at: '2026-04-01' } }],
        transactions: [{ id: 'tx-1', payload: { id: 'tx-1', amount: 20, description: 'Cafe', type: 'Despesa', category: 'Pessoal', workspace_id: 'ws-1', tenant_id: 'tenant-1', date: '2026-04-01' } }],
        goals: [{ id: 'goal-1', payload: { id: 'goal-1', title: 'Reserva', targetAmount: 100, currentAmount: 10, category: 'Investimento', workspace_id: 'ws-1', tenant_id: 'tenant-1' } }],
        reminders: [{ id: 'rem-1', payload: { id: 'rem-1', title: 'Recebimento clinica', date: '2026-04-10', type: 'Negócio', completed: false, priority: 'media', amount: 180 } }],
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carrega perfil do Firestore e entidades do Firestore workspace sync', async () => {
    const onDisableCloudSync = vi.fn();
    const onDisableBackendSync = vi.fn();

    const { result } = renderHook(() => useSyncEngine({
      userId: 'user-1',
      activeTenantId: 'tenant-1',
      activeWorkspaceId: 'ws-1',
      isE2EBootstrapActive: false,
      cloudSyncEnabled: true,
      backendSyncEnabled: false,
      onDisableCloudSync,
      onDisableBackendSync,
    }));

    await waitFor(() => {
      expect(result.current.isProfileReady).toBe(true);
      expect(result.current.hasLoadedEntities).toBe(true);
    });

    expect(result.current.profile.name).toBe('Flow User');
    expect(result.current.profile.theme).toBe('dark');
    expect(result.current.entities.accounts[0].id).toBe('acc-1');
    expect(result.current.entities.transactions[0].id).toBe('tx-1');
    expect(result.current.entities.reminders[0].id).toBe('rem-1');
    expect(syncEngineMocks.mockPullSyncEntities).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
  });

  it('sincroniza perfil e entidades pelo Firestore helpers', async () => {
    const onDisableCloudSync = vi.fn();
    const onDisableBackendSync = vi.fn();

    const { result } = renderHook(() => useSyncEngine({
      userId: 'user-1',
      activeTenantId: 'tenant-1',
      activeWorkspaceId: 'ws-1',
      isE2EBootstrapActive: false,
      cloudSyncEnabled: true,
      backendSyncEnabled: false,
      onDisableCloudSync,
      onDisableBackendSync,
    }));

    await waitFor(() => {
      expect(result.current.isProfileReady).toBe(true);
    });

    await act(async () => {
      await result.current.syncProfile({ name: 'Novo Nome' });
      await result.current.syncEntities({
        accounts: [{ id: 'acc-2', name: 'Banco', type: 'bank', balance: 10, currency: 'BRL', user_id: 'user-1', workspace_id: 'ws-1', tenant_id: 'tenant-1', created_at: '2026-04-01' }],
      });
    });

    expect(syncEngineMocks.mockSaveUserProfile).toHaveBeenCalledWith('user-1', { name: 'Novo Nome' });
    expect(result.current.profile.name).toBe('Novo Nome');
    expect(syncEngineMocks.mockReplaceSyncEntityCollection).toHaveBeenCalledWith(
      'accounts',
      expect.any(Array),
      expect.any(Array),
      { userId: 'user-1', tenantId: 'tenant-1', workspaceId: 'ws-1' },
    );
  });

  it('reconcilia temp ids com ids oficiais retornados pelo Firestore sync layer', async () => {
    syncEngineMocks.mockReplaceSyncEntityCollection.mockResolvedValueOnce({
      success: true,
      upserted: 1,
      deleted: 0,
      latestServerUpdatedAt: '2026-04-01T12:00:00.000Z',
      reconciledIds: [{ clientId: 'tmp_acc-1', serverId: 'acc-official-1' }],
    });

    const onDisableCloudSync = vi.fn();
    const onDisableBackendSync = vi.fn();

    const { result } = renderHook(() => useSyncEngine({
      userId: 'user-1',
      activeTenantId: 'tenant-1',
      activeWorkspaceId: 'ws-1',
      isE2EBootstrapActive: false,
      cloudSyncEnabled: true,
      backendSyncEnabled: false,
      onDisableCloudSync,
      onDisableBackendSync,
    }));

    await waitFor(() => {
      expect(result.current.hasLoadedEntities).toBe(true);
    });

    let syncResult;
    await act(async () => {
      syncResult = await result.current.syncEntities({
        accounts: [{ id: 'tmp_acc-1', name: 'Banco', type: 'bank', balance: 10, currency: 'BRL', user_id: 'user-1', workspace_id: 'ws-1', tenant_id: 'tenant-1', created_at: '2026-04-01' }],
      });
    });

    expect(syncResult?.idMaps.accounts).toEqual({ 'tmp_acc-1': 'acc-official-1' });
    expect(result.current.entities.accounts[0].id).toBe('acc-official-1');
  });
});
