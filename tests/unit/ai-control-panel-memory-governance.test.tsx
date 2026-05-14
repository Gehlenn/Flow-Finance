import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AIControlPanel from '../../pages/AIControlPanel';

const getAIMemoryMock = vi.fn();
const getAIMemorySnapshotMock = vi.fn();
const getAdaptiveLearningStatsMock = vi.fn();
const getFinancialEventsMock = vi.fn();
const deleteMemoryMock = vi.fn();

vi.mock('../../src/ai/aiMemory', () => ({
  getAIMemory: (...args: unknown[]) => getAIMemoryMock(...args),
  getAIMemorySnapshot: (...args: unknown[]) => getAIMemorySnapshotMock(...args),
  deleteMemory: (...args: unknown[]) => deleteMemoryMock(...args),
}));

vi.mock('../../src/ai/adaptiveAIEngine', () => ({
  getAdaptiveLearningStats: (...args: unknown[]) => getAdaptiveLearningStatsMock(...args),
}));

vi.mock('../../src/events/eventEngine', () => ({
  getFinancialEvents: (...args: unknown[]) => getFinancialEventsMock(...args),
  clearFinancialEvents: vi.fn(),
}));

describe('AIControlPanel memory governance', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('VITE_AI_DEBUG_PANEL', '1');
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));

    getAIMemorySnapshotMock.mockReturnValue([]);
    getAdaptiveLearningStatsMock.mockReturnValue({
      memory_count: 0,
      pattern_count: 0,
      is_learning: false,
    });
    getFinancialEventsMock.mockReturnValue([]);
  });

  it('permite excluir uma memoria especifica', async () => {
    getAIMemoryMock
      .mockResolvedValueOnce([
        {
          id: 'mem-delete',
          user_id: 'user-1',
          key: 'weekend_spending',
          value: 'high',
          confidence: 0.82,
          updated_at: '2026-05-10T10:00:00.000Z',
        },
        {
          id: 'mem-keep',
          user_id: 'user-1',
          key: 'frequent_merchant',
          value: 'iFood',
          confidence: 0.66,
          updated_at: '2026-05-11T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'mem-keep',
          user_id: 'user-1',
          key: 'frequent_merchant',
          value: 'iFood',
          confidence: 0.66,
          updated_at: '2026-05-11T10:00:00.000Z',
        },
      ]);

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('Alta confianca')).toBeTruthy();
    expect(screen.getByText('Confianca media')).toBeTruthy();
    expect(screen.getByText('Baixa confianca')).toBeTruthy();
    expect(screen.getByText('Padrões')).toBeTruthy();
    expect(screen.getByText('Perfil')).toBeTruthy();
    expect(screen.getByText('Comerciantes')).toBeTruthy();
    await screen.findByText('weekend_spending');

    fireEvent.click(screen.getByRole('button', { name: /excluir memoria weekend_spending/i }));

    await waitFor(() => {
      expect(deleteMemoryMock).toHaveBeenCalledWith('mem-delete');
      expect(screen.queryByText('weekend_spending')).toBeNull();
      expect(screen.getByText('frequent_merchant')).toBeTruthy();
    });
  });

  it('permite limpar todas as memorias da sessao atual', async () => {
    getAIMemoryMock
      .mockResolvedValueOnce([
        {
          id: 'mem-1',
          user_id: 'user-1',
          key: 'weekend_spending',
          value: 'high',
          confidence: 0.82,
          updated_at: '2026-05-10T10:00:00.000Z',
        },
        {
          id: 'mem-2',
          user_id: 'user-1',
          key: 'recurring_expenses',
          value: '3',
          confidence: 0.61,
          updated_at: '2026-05-11T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
    expect(screen.getByText('Total')).toBeTruthy();
    await screen.findByText('weekend_spending');

    fireEvent.click(screen.getByRole('button', { name: /limpar memorias/i }));

    await waitFor(() => {
      expect(deleteMemoryMock).toHaveBeenCalledTimes(2);
      expect(deleteMemoryMock).toHaveBeenCalledWith('mem-1');
      expect(deleteMemoryMock).toHaveBeenCalledWith('mem-2');
      expect(screen.queryByText('weekend_spending')).toBeNull();
      expect(screen.queryByText('recurring_expenses')).toBeNull();
    });
  });

  it('permite filtrar memorias por qualidade e funcao', async () => {
    getAIMemoryMock.mockResolvedValueOnce([
      {
        id: 'mem-high',
        user_id: 'user-1',
        key: 'category_dominance',
        value: 'Pessoal',
        confidence: 0.91,
        updated_at: '2026-05-12T10:00:00.000Z',
      },
      {
        id: 'mem-medium',
        user_id: 'user-1',
        key: 'recurring_expenses',
        value: '3',
        confidence: 0.64,
        updated_at: '2026-05-11T10:00:00.000Z',
      },
      {
        id: 'mem-low',
        user_id: 'user-1',
        key: 'merchant_hint',
        value: 'Cafe',
        confidence: 0.31,
        updated_at: '2026-05-10T10:00:00.000Z',
      },
    ]);

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
    await screen.findByText('category_dominance');

    fireEvent.click(screen.getByRole('button', { name: /baixa confiança/i }));

    expect(screen.getByText('merchant_hint')).toBeTruthy();
    expect(screen.queryByText('category_dominance')).toBeNull();
    expect(screen.queryByText('recurring_expenses')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /comerciantes/i }));

    expect(screen.getByText('merchant_hint')).toBeTruthy();
    expect(screen.queryByText('category_dominance')).toBeNull();
    expect(screen.queryByText('recurring_expenses')).toBeNull();
  });

  it('permite limpar apenas as memorias filtradas', async () => {
    getAIMemoryMock
      .mockResolvedValueOnce([
        {
          id: 'mem-high',
          user_id: 'user-1',
          key: 'category_dominance',
          value: 'Pessoal',
          confidence: 0.91,
          updated_at: '2026-05-12T10:00:00.000Z',
        },
        {
          id: 'mem-low',
          user_id: 'user-1',
          key: 'merchant_hint',
          value: 'Cafe',
          confidence: 0.31,
          updated_at: '2026-05-10T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'mem-high',
          user_id: 'user-1',
          key: 'category_dominance',
          value: 'Pessoal',
          confidence: 0.91,
          updated_at: '2026-05-12T10:00:00.000Z',
        },
      ]);

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
    await screen.findByText('category_dominance');

    fireEvent.click(screen.getByRole('button', { name: /baixa confiança/i }));
    fireEvent.click(screen.getByRole('button', { name: /limpar filtradas/i }));

    await waitFor(() => {
      expect(deleteMemoryMock).toHaveBeenCalledWith('mem-low');
        expect(screen.getByText('category_dominance')).toBeTruthy();
      expect(screen.getByText('Padr?es')).toBeTruthy();
      expect(screen.getByText('Perfil financeiro')).toBeTruthy();
      expect(screen.getByText('Comerciantes')).toBeTruthy();
      expect(screen.queryByText('merchant_hint')).toBeNull();
    });
  });
});
