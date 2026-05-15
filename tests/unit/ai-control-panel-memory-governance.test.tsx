import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AIControlPanel from '../../pages/AIControlPanel';
import { AITaskPriority, AITaskStatus, AITaskType } from '../../src/ai/queue/taskTypes';

const getAIMemoryMock = vi.fn();
const getAIMemorySnapshotMock = vi.fn();
const getAdaptiveLearningStatsMock = vi.fn();
const getFinancialEventsMock = vi.fn();
const deleteMemoryMock = vi.fn();
const updateMemoryMock = vi.fn();
const getAllTasksMock = vi.fn();
const cancelTaskMock = vi.fn();
const clearCompletedTasksMock = vi.fn();
const getQueueStatsMock = vi.fn();

vi.mock('../../src/ai/aiMemory', () => ({
  getAIMemory: (...args: unknown[]) => getAIMemoryMock(...args),
  getAIMemorySnapshot: (...args: unknown[]) => getAIMemorySnapshotMock(...args),
  deleteMemory: (...args: unknown[]) => deleteMemoryMock(...args),
  updateMemory: (...args: unknown[]) => updateMemoryMock(...args),
}));

vi.mock('../../src/ai/adaptiveAIEngine', () => ({
  getAdaptiveLearningStats: (...args: unknown[]) => getAdaptiveLearningStatsMock(...args),
}));

vi.mock('../../src/events/eventEngine', () => ({
  getFinancialEvents: (...args: unknown[]) => getFinancialEventsMock(...args),
  clearFinancialEvents: vi.fn(),
}));

vi.mock('../../src/ai/queue/taskStore', () => ({
  taskStore: {
    getAllTasks: (...args: unknown[]) => getAllTasksMock(...args),
  },
}));

vi.mock('../../src/ai/queue/AITaskQueue', () => ({
  aiTaskQueue: {
    cancelTask: (...args: unknown[]) => cancelTaskMock(...args),
    clearCompletedTasks: (...args: unknown[]) => clearCompletedTasksMock(...args),
    getQueueStats: (...args: unknown[]) => getQueueStatsMock(...args),
  },
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
    getAllTasksMock.mockReturnValue([]);
    cancelTaskMock.mockReturnValue(true);
    clearCompletedTasksMock.mockReturnValue(undefined);
    getQueueStatsMock.mockReturnValue({
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    });
    updateMemoryMock.mockResolvedValue(undefined);
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
    expect(screen.getAllByText(/Padr/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Perfil').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Comerciantes').length).toBeGreaterThan(0);
    await screen.findAllByText('weekend_spending');

    fireEvent.click(screen.getByRole('button', { name: /excluir memoria weekend_spending/i }));

    await waitFor(() => {
      expect(deleteMemoryMock).toHaveBeenCalledWith('mem-delete');
      expect(screen.queryAllByText('weekend_spending').length).toBe(0);
      expect(screen.getAllByText('frequent_merchant').length).toBeGreaterThan(0);
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
    await screen.findAllByText('weekend_spending');

    fireEvent.click(screen.getByRole('button', { name: /limpar memorias/i }));

    await waitFor(() => {
      expect(deleteMemoryMock).toHaveBeenCalledTimes(2);
      expect(deleteMemoryMock).toHaveBeenCalledWith('mem-1');
      expect(deleteMemoryMock).toHaveBeenCalledWith('mem-2');
      expect(screen.queryAllByText('weekend_spending').length).toBe(0);
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
    await screen.findAllByText('merchant_hint');

    fireEvent.click(screen.getByRole('button', { name: /baixa confian/i }));

    expect(screen.getAllByText('merchant_hint').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /comerciantes/i }));

    expect(screen.getAllByText('merchant_hint').length).toBeGreaterThan(0);
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
    await screen.findAllByText('merchant_hint');

    fireEvent.click(screen.getByRole('button', { name: /baixa confian/i }));
    fireEvent.click(screen.getByRole('button', { name: /limpar filtradas/i }));

    await waitFor(() => {
      expect(deleteMemoryMock).toHaveBeenCalledWith('mem-low');
      expect(screen.getAllByText(/Padr/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Perfil/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Comerciantes').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('merchant_hint').length).toBe(0);
    });
  });

  it('permite confirmar ou invalidar memorias e mostra a origem', async () => {
    getAIMemoryMock.mockResolvedValueOnce([
      {
        id: 'mem-confirm',
        user_id: 'user-1',
        key: 'merchant_hint',
        value: 'Cafe',
        confidence: 0.42,
        updated_at: '2026-05-12T10:00:00.000Z',
        metadata: {
          source: expect.stringMatching(/trans|transaction/i),
        },
      },
      {
        id: 'mem-invalidate',
        user_id: 'user-1',
        key: 'weekend_spending',
        value: 'high',
        confidence: 0.91,
        updated_at: '2026-05-11T10:00:00.000Z',
      },
    ]);

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
    await screen.findAllByText('merchant_hint');

    expect(screen.getAllByText(/Origem:/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Origem: infer/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /confirmar memoria merchant_hint/i }));

    await waitFor(() => {
      expect(updateMemoryMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'mem-confirm',
        confidence: 0.5,
        metadata: expect.objectContaining({
          source: expect.stringMatching(/trans|transaction/i),
          reviewState: 'confirmed',
          reviewedAt: expect.any(String),
        }),
      }));
      expect(screen.getByText(/Revis.*confirmada/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /invalidar memoria weekend_spending/i }));

    await waitFor(() => {
      expect(updateMemoryMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'mem-invalidate',
        confidence: 0.73,
        metadata: expect.objectContaining({
          source: expect.stringMatching(/infer/i),
          reviewState: 'invalidated',
          reviewedAt: expect.any(String),
        }),
      }));
      expect(screen.getByText(/Revis.*invalidada/i)).toBeTruthy();
    });
  });

  it('mostra a fila de IA com estados e tarefas recentes', async () => {
    getAllTasksMock
      .mockReturnValueOnce([
      {
        id: 'task-1',
        type: AITaskType.INSIGHT_GENERATION,
        payload: { transactions: 12 },
        status: AITaskStatus.PENDING,
        priority: AITaskPriority.HIGH,
        createdAt: new Date('2026-05-12T10:00:00.000Z').getTime(),
        retryCount: 0,
        maxRetries: 3,
        userId: 'user-1',
      },
      {
        id: 'task-2',
        type: AITaskType.FINANCIAL_REPORT,
        payload: {},
        status: AITaskStatus.PROCESSING,
        priority: AITaskPriority.NORMAL,
        createdAt: new Date('2026-05-12T09:00:00.000Z').getTime(),
        startedAt: new Date('2026-05-12T09:05:00.000Z').getTime(),
        retryCount: 0,
        maxRetries: 3,
        userId: 'user-1',
      },
      {
        id: 'task-3',
        type: AITaskType.LEAK_DETECTION,
        payload: {},
        status: AITaskStatus.COMPLETED,
        priority: AITaskPriority.LOW,
        createdAt: new Date('2026-05-12T08:00:00.000Z').getTime(),
        completedAt: new Date('2026-05-12T08:10:00.000Z').getTime(),
        retryCount: 0,
        maxRetries: 3,
        userId: 'user-1',
      },
    ])
      .mockReturnValueOnce([
        {
          id: 'task-2',
          type: AITaskType.FINANCIAL_REPORT,
          payload: {},
          status: AITaskStatus.PROCESSING,
          priority: AITaskPriority.NORMAL,
          createdAt: new Date('2026-05-12T09:00:00.000Z').getTime(),
          startedAt: new Date('2026-05-12T09:05:00.000Z').getTime(),
          retryCount: 0,
          maxRetries: 3,
          userId: 'user-1',
        },
        {
          id: 'task-3',
          type: AITaskType.LEAK_DETECTION,
          payload: {},
          status: AITaskStatus.COMPLETED,
          priority: AITaskPriority.LOW,
          createdAt: new Date('2026-05-12T08:00:00.000Z').getTime(),
          completedAt: new Date('2026-05-12T08:10:00.000Z').getTime(),
          retryCount: 0,
          maxRetries: 3,
          userId: 'user-1',
        },
      ])
      .mockReturnValueOnce([
        {
          id: 'task-2',
          type: AITaskType.FINANCIAL_REPORT,
          payload: {},
          status: AITaskStatus.PROCESSING,
          priority: AITaskPriority.NORMAL,
          createdAt: new Date('2026-05-12T09:00:00.000Z').getTime(),
          startedAt: new Date('2026-05-12T09:05:00.000Z').getTime(),
          retryCount: 0,
          maxRetries: 3,
          userId: 'user-1',
        },
      ]);

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Queue' }));

    expect(screen.getByText('AI Task Queue')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
    expect(screen.getByText('Processando')).toBeTruthy();
    expect(screen.getByText('Insight')).toBeTruthy();
    expect(screen.getByText(/Relat/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /ver detalhes da tarefa task-1/i }));

    expect(screen.getByText('Detalhes da tarefa')).toBeTruthy();
    expect(screen.getByText('Retries: 0/3')).toBeTruthy();
    expect(screen.getByText(/"transactions":\s*12/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cancelar tarefa task-1/i }));

    await waitFor(() => {
      expect(cancelTaskMock).toHaveBeenCalledWith('task-1');
      expect(getAllTasksMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('Insight')).toBeNull();
      expect(screen.getByText(/Relat/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /limpar tarefas/i }));

    await waitFor(() => {
      expect(clearCompletedTasksMock).toHaveBeenCalledTimes(1);
      expect(getAllTasksMock).toHaveBeenCalledTimes(3);
      
    });
  });

  it('atualiza a fila quando recebe um evento de mutacao', async () => {
    getAllTasksMock
      .mockReturnValueOnce([
        {
          id: 'task-1',
          type: AITaskType.INSIGHT_GENERATION,
          payload: { transactions: 12 },
          status: AITaskStatus.PENDING,
          priority: AITaskPriority.HIGH,
          createdAt: new Date('2026-05-12T10:00:00.000Z').getTime(),
          retryCount: 0,
          maxRetries: 3,
          userId: 'user-1',
        },
        {
          id: 'task-2',
          type: AITaskType.FINANCIAL_REPORT,
          payload: {},
          status: AITaskStatus.PROCESSING,
          priority: AITaskPriority.NORMAL,
          createdAt: new Date('2026-05-12T09:00:00.000Z').getTime(),
          startedAt: new Date('2026-05-12T09:05:00.000Z').getTime(),
          retryCount: 0,
          maxRetries: 3,
          userId: 'user-1',
        },
      ])
      .mockReturnValueOnce([
        {
          id: 'task-2',
          type: AITaskType.FINANCIAL_REPORT,
          payload: {},
          status: AITaskStatus.PROCESSING,
          priority: AITaskPriority.NORMAL,
          createdAt: new Date('2026-05-12T09:00:00.000Z').getTime(),
          startedAt: new Date('2026-05-12T09:05:00.000Z').getTime(),
          retryCount: 0,
          maxRetries: 3,
          userId: 'user-1',
        },
        {
          id: 'task-4',
          type: AITaskType.LEAK_DETECTION,
          payload: { merchant: 'iFood' },
          status: AITaskStatus.PENDING,
          priority: AITaskPriority.URGENT,
          createdAt: new Date('2026-05-12T11:00:00.000Z').getTime(),
          retryCount: 0,
          maxRetries: 3,
          userId: 'user-1',
        },
      ]);

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Queue' }));
    await waitFor(() => { expect(getAllTasksMock).toHaveBeenCalledTimes(1); });

    act(() => {
      window.dispatchEvent(new CustomEvent('ai-task-updated'));
    });

    await waitFor(() => {
      expect(getAllTasksMock).toHaveBeenCalledTimes(2);
    });
  });
});















