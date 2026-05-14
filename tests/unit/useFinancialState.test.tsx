import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFinancialState } from '../../hooks/useFinancialState';

const financialStateMocks = vi.hoisted(() => {
  const mocks = {
    logWarn: vi.fn(),
    runAdaptiveLearning: vi.fn(),
    initEventListeners: vi.fn(),
    capturedEventStateGetter: null as null | (() => {
      onLeaks?: (leaks: unknown[]) => void;
      onReport?: (report: unknown) => void;
    }),
  };

  mocks.initEventListeners.mockImplementation((getState: () => {
    onLeaks?: (leaks: unknown[]) => void;
    onReport?: (report: unknown) => void;
  }) => {
    mocks.capturedEventStateGetter = getState;
    return () => undefined;
  });

  return mocks;
});

vi.mock('../../src/ai/aiMemory', () => ({
  detectAndLearnPatterns: vi.fn(),
}));

vi.mock('../../src/ai/adaptiveAIEngine', () => ({
  runAdaptiveLearning: financialStateMocks.runAdaptiveLearning,
}));

vi.mock('../../src/events/eventEngine', () => ({
  FinancialEventEmitter: {
    transactionCreated: vi.fn(),
  },
  initEventListeners: financialStateMocks.initEventListeners,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: financialStateMocks.logWarn,
}));

describe('useFinancialState', () => {
  it('reads entities and profile directly from the sync engine', () => {
    const syncEngine = {
      entities: {
        accounts: [{ id: 'acc-1', name: 'Carteira', type: 'cash', balance: 10, currency: 'BRL', user_id: 'user-1', workspace_id: 'ws-1', tenant_id: 'tenant-1', created_at: '2026-04-01T00:00:00.000Z' }],
        transactions: [{ id: 'tx-1', amount: 25, description: 'Cafe', type: 'Despesa', category: 'Pessoal', date: '2026-04-01T00:00:00.000Z', user_id: 'user-1', workspace_id: 'ws-1', tenant_id: 'tenant-1' }],
        goals: [{ id: 'goal-1', title: 'Reserva', targetAmount: 1000, currentAmount: 100, category: 'Investimento', deadline: '2026-12-31', user_id: 'user-1', workspace_id: 'ws-1', tenant_id: 'tenant-1' }],
        reminders: [],
      },
      profile: {
        name: 'Flow User',
        theme: 'dark' as const,
        reminders: [{ id: 'rem-1', title: 'Pagar conta', date: '2026-04-10', type: 'Pessoal', completed: false, priority: 'media' as const }],
        alerts: [{ id: 'alert-1', category: 'Geral', threshold: 100, timeframe: 'mensal' as const }],
      },
      syncProfile: vi.fn().mockResolvedValue(undefined),
      syncEntities: vi.fn().mockImplementation(async (updates) => ({
        entities: {
          accounts: updates.accounts ?? syncEngine.entities.accounts,
          transactions: updates.transactions ?? syncEngine.entities.transactions,
          goals: updates.goals ?? syncEngine.entities.goals,
          reminders: updates.reminders ?? syncEngine.entities.reminders,
        },
        idMaps: {},
      })),
      backendSyncEnabled: true,
      hasLoadedEntities: true,
    };

    const { result } = renderHook(() => useFinancialState({
      userId: 'user-1',
      activeTenantId: 'tenant-1',
      activeWorkspaceId: 'ws-1',
      syncEngine: syncEngine as never,
    }));

    expect(result.current.accounts).toBe(syncEngine.entities.accounts);
    expect(result.current.transactions).toBe(syncEngine.entities.transactions);
    expect(result.current.goals).toBe(syncEngine.entities.goals);
    // reminders are merged from profile + entities (dedup), so reference changes
    expect(result.current.reminders).toStrictEqual(syncEngine.profile.reminders);
    expect(result.current.alerts).toBe(syncEngine.profile.alerts);
  });

  it('delegates writes through the domain service and sync engine without local mirror state', async () => {
    const syncEntities = vi.fn().mockImplementation(async (updates) => ({
      entities: {
        accounts: updates.accounts ?? [],
        transactions: updates.transactions ?? [],
        goals: updates.goals ?? [],
        reminders: updates.reminders ?? [],
      },
      idMaps: {},
    }));

    const syncEngine = {
      entities: {
        accounts: [],
        transactions: [],
        goals: [],
        reminders: [],
      },
      profile: {
        name: 'Flow User',
        theme: 'light' as const,
        reminders: [],
        alerts: [],
      },
      syncProfile: vi.fn().mockResolvedValue(undefined),
      syncEntities,
      backendSyncEnabled: true,
      hasLoadedEntities: true,
    };

    const { result } = renderHook(() => useFinancialState({
      userId: 'user-1',
      activeTenantId: 'tenant-1',
      activeWorkspaceId: 'ws-1',
      syncEngine: syncEngine as never,
    }));

    await act(async () => {
      await result.current.createAccount({
        name: 'Banco',
        type: 'bank',
        balance: 250,
      });
    });

    expect(syncEntities).toHaveBeenCalledWith(
      {
        accounts: [
          expect.objectContaining({
            name: 'Banco',
            user_id: 'user-1',
            tenant_id: 'tenant-1',
            workspace_id: 'ws-1',
          }),
        ],
      },
      { accounts: [] },
    );
  });

  it('logs adaptive learning failures without breaking the hook', async () => {
    financialStateMocks.runAdaptiveLearning.mockRejectedValueOnce(new Error('adaptive offline'));

    const syncEngine = {
      entities: {
        accounts: [],
        transactions: [
          { id: 'tx-1', amount: 25, description: 'Cafe', type: 'Despesa', category: 'Pessoal', date: '2026-04-01T00:00:00.000Z', user_id: 'user-1', workspace_id: 'ws-1', tenant_id: 'tenant-1' },
          { id: 'tx-2', amount: 40, description: 'Almoco', type: 'Despesa', category: 'Pessoal', date: '2026-04-02T00:00:00.000Z', user_id: 'user-1', workspace_id: 'ws-1', tenant_id: 'tenant-1' },
          { id: 'tx-3', amount: 150, description: 'Freela', type: 'Receita', category: 'Trabalho', date: '2026-04-03T00:00:00.000Z', user_id: 'user-1', workspace_id: 'ws-1', tenant_id: 'tenant-1' },
        ],
        goals: [],
        reminders: [],
      },
      profile: {
        name: 'Flow User',
        theme: 'light' as const,
        reminders: [],
        alerts: [],
      },
      syncProfile: vi.fn().mockResolvedValue(undefined),
      syncEntities: vi.fn().mockResolvedValue({
        entities: {
          accounts: [],
          transactions: [],
          goals: [],
          reminders: [],
        },
        idMaps: {},
      }),
      backendSyncEnabled: true,
      hasLoadedEntities: true,
    };

    const { rerender } = renderHook(() => useFinancialState({
      userId: 'user-1',
      activeTenantId: 'tenant-1',
      activeWorkspaceId: 'ws-1',
      syncEngine: syncEngine as never,
    }));

    await waitFor(() => {
      expect(financialStateMocks.logWarn).toHaveBeenCalledWith(
        '[useFinancialState] Failed to execute adaptive learning',
        expect.objectContaining({
          fallback: 'use-financial-state-adaptive-learning-failed',
        }),
      );
    });
  });

  it('logs default account creation failures without breaking the hook', async () => {
    const syncEntities = vi.fn().mockRejectedValueOnce(new Error('write failed'));

    const syncEngine = {
      entities: {
        accounts: [],
        transactions: [],
        goals: [],
        reminders: [],
      },
      profile: {
        name: 'Flow User',
        theme: 'light' as const,
        reminders: [],
        alerts: [],
      },
      syncProfile: vi.fn().mockResolvedValue(undefined),
      syncEntities,
      backendSyncEnabled: true,
      hasLoadedEntities: true,
    };

    renderHook(() => useFinancialState({
      userId: 'user-1',
      activeTenantId: 'tenant-1',
      activeWorkspaceId: 'ws-1',
      syncEngine: syncEngine as never,
    }));

    await waitFor(() => {
      expect(financialStateMocks.logWarn).toHaveBeenCalledWith(
        '[useFinancialState] Failed to create default workspace account',
        expect.objectContaining({
          fallback: 'use-financial-state-create-default-account-failed',
        }),
      );
    });
  });

  it('stores leak and report snapshots from the event listener pipeline', async () => {
    const syncEngine = {
      entities: {
        accounts: [],
        transactions: [],
        goals: [],
        reminders: [],
      },
      profile: {
        name: 'Flow User',
        theme: 'light' as const,
        reminders: [],
        alerts: [],
      },
      syncProfile: vi.fn().mockResolvedValue(undefined),
      syncEntities: vi.fn().mockResolvedValue({
        entities: {
          accounts: [],
          transactions: [],
          goals: [],
          reminders: [],
        },
        idMaps: {},
      }),
      backendSyncEnabled: true,
      hasLoadedEntities: true,
    };

    const { result } = renderHook(() => useFinancialState({
      userId: 'user-1',
      activeTenantId: 'tenant-1',
      activeWorkspaceId: 'ws-1',
      syncEngine: syncEngine as never,
    }));

    await waitFor(() => {
      expect(financialStateMocks.capturedEventStateGetter).toBeTruthy();
    });

    await act(async () => {
      const state = financialStateMocks.capturedEventStateGetter?.();
      state?.onLeaks?.([
        {
          merchant: 'Coffee Shop',
          occurrences: 4,
          monthly_cost: 120,
          suggestion: 'Cortar o gasto recorrente.',
        },
      ]);
      state?.onReport?.({
        month: '2026-05',
        total_income: 1000,
        total_expenses: 200,
        top_categories: [
          { category: 'Pessoal', amount: 200, percentage: 100 },
        ],
        insights: ['Gastos sob controle'],
      });
    });

    await waitFor(() => {
      expect(result.current.latestLeaks).toStrictEqual([
        {
          merchant: 'Coffee Shop',
          occurrences: 4,
          monthly_cost: 120,
          suggestion: 'Cortar o gasto recorrente.',
        },
      ]);
      expect(result.current.latestReport).toMatchObject({
        month: '2026-05',
        total_income: 1000,
        total_expenses: 200,
      });
    });
  });
});
