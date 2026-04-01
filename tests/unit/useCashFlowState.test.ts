import { renderHook, act } from '@testing-library/react';
import { useCashFlowState } from '../../hooks/useCashFlowState';
import { describe, it, expect } from 'vitest';

describe('useCashFlowState', () => {
  it('deve inicializar estados vazios', () => {
    const { result } = renderHook(() => useCashFlowState({
      userId: 'user-test',
      cloudSyncEnabled: false,
      setCloudSyncEnabled: () => {},
      syncStatus: 'idle',
      setSyncStatus: () => {},
    }));
    expect(result.current.transactions).toEqual([]);
    expect(result.current.accounts).toEqual([]);
    expect(result.current.alerts).toEqual([]);
    expect(result.current.reminders).toEqual([]);
    expect(result.current.goals).toEqual([]);
  });

  it('adiciona transação corretamente', () => {
    const { result } = renderHook(() => useCashFlowState({
      userId: 'user-test',
      cloudSyncEnabled: false,
      setCloudSyncEnabled: () => {},
      syncStatus: 'idle',
      setSyncStatus: () => {},
    }));
    act(() => {
      result.current.handleAddTransactions([
        { amount: 100, description: 'Teste', type: 'Receita', category: 'Pessoal' }
      ]);
    });
    expect(result.current.transactions.length).toBe(1);
    expect(result.current.transactions[0].amount).toBe(100);
  });
});

