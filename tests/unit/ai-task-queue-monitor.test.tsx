import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AITaskPriority, AITaskStatus, AITaskType } from '../../src/ai/queue/taskTypes';

const getAllTasksMock = vi.fn();
const getQueueStatsMock = vi.fn();
const clearCompletedTasksMock = vi.fn();

vi.mock('../../src/ai/queue', async () => {
  const actual = await vi.importActual<typeof import('../../src/ai/queue')>('../../src/ai/queue');
  return {
    ...actual,
    aiTaskQueue: {
      ...actual.aiTaskQueue,
      getQueueStats: (...args: unknown[]) => getQueueStatsMock(...args),
    },
    taskStore: {
      ...actual.taskStore,
      getAllTasks: (...args: unknown[]) => getAllTasksMock(...args),
      clearCompletedTasks: (...args: unknown[]) => clearCompletedTasksMock(...args),
    },
  };
});

describe('AITaskQueueMonitor', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getAllTasksMock.mockReturnValue([
      {
        id: 'task-1',
        type: AITaskType.INSIGHT_GENERATION,
        status: AITaskStatus.PENDING,
        priority: AITaskPriority.HIGH,
        createdAt: 1000,
        retryCount: 0,
        maxRetries: 2,
        userId: 'user-1',
      },
    ]);
    getQueueStatsMock.mockReturnValue({
      pending: 1,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 1,
    });
  });

  it('renderiza canceladas e atualiza quando a fila muda', async () => {
    const { default: AITaskQueueMonitor } = await import('../../components/dev/AITaskQueueMonitor');

    render(<AITaskQueueMonitor />);

    fireEvent.click(screen.getByRole('button', { name: /AI Task Queue/i }));

    expect(screen.getByText('Canceladas')).toBeTruthy();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(getAllTasksMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent('ai-task-updated'));

    await waitFor(() => expect(getAllTasksMock).toHaveBeenCalledTimes(2));

    window.dispatchEvent(new CustomEvent('ai-task-queue-cleared'));

    await waitFor(() => expect(getAllTasksMock).toHaveBeenCalledTimes(3));
  });

  it('limpa concluídas e recarrega a lista', async () => {
    const { default: AITaskQueueMonitor } = await import('../../components/dev/AITaskQueueMonitor');

    render(<AITaskQueueMonitor />);

    fireEvent.click(screen.getByRole('button', { name: /AI Task Queue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Limpar Concluídas/i }));

    expect(clearCompletedTasksMock).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(getAllTasksMock).toHaveBeenCalledTimes(2));
  });
});
