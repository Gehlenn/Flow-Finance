import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';

const startMock = vi.fn();
const stopMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

vi.mock('../../src/ai/queue/AIWorker', () => ({
  aiWorker: {
    start: (...args: unknown[]) => startMock(...args),
    stop: (...args: unknown[]) => stopMock(...args),
  },
}));

vi.mock('../../src/utils/helpers', () => ({
  makeId: () => 'task-123',
}));

vi.mock('../../src/utils/logger', () => ({
  logInfo: (...args: unknown[]) => logInfoMock(...args),
  logWarn: (...args: unknown[]) => logWarnMock(...args),
}));

describe('AITaskQueue observability', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, 'ws-queue-observability');

    const { taskStore } = await import('../../src/ai/queue/taskStore');
    taskStore.clear();
  });

  it('logs initialization, enqueue and cancel events with context', async () => {
    const { aiTaskQueue, enqueueTaskForUser } = await import('../../src/ai/queue/AITaskQueue');
    const { AITaskPriority, AITaskStatus, AITaskType } = await import('../../src/ai/queue/taskTypes');
    const { taskStore } = await import('../../src/ai/queue/taskStore');

    const enqueueEvents: CustomEvent[] = [];
    const updateEvents: CustomEvent[] = [];
    const enqueueHandler = (event: Event): void => {
      enqueueEvents.push(event as CustomEvent);
    };
    const updateHandler = (event: Event): void => {
      updateEvents.push(event as CustomEvent);
    };

    window.addEventListener('ai-task-enqueued', enqueueHandler);
    window.addEventListener('ai-task-updated', updateHandler);

    try {
      aiTaskQueue.initialize();
      aiTaskQueue.initialize();

      expect(startMock).toHaveBeenCalledTimes(1);
      expect(logInfoMock).toHaveBeenCalledWith(
        '[AI Task Queue] Initializing...',
        expect.objectContaining({ fallback: 'ai-task-queue-initializing' }),
      );
      expect(logInfoMock).toHaveBeenCalledWith(
        '[AI Task Queue] Ready',
        expect.objectContaining({ fallback: 'ai-task-queue-ready' }),
      );
      expect(logWarnMock).toHaveBeenCalledWith(
        '[AI Task Queue] Already initialized',
        expect.objectContaining({ fallback: 'ai-task-queue-already-initialized' }),
      );

      const taskId = enqueueTaskForUser(
        'user-1',
        AITaskType.INSIGHT_GENERATION,
        { accounts: [], transactions: [] },
        {
          priority: AITaskPriority.HIGH,
          maxRetries: 4,
        },
      );

      expect(taskId).toBe('task-123');
      expect(taskStore.getTask('task-123')).toBeDefined();
      expect(enqueueEvents).toHaveLength(1);
      expect(enqueueEvents[0].detail).toEqual(expect.objectContaining({
        taskId: 'task-123',
        taskType: AITaskType.INSIGHT_GENERATION,
        status: AITaskStatus.PENDING,
        priority: AITaskPriority.HIGH,
        userId: 'user-1',
      }));
      expect(logInfoMock).toHaveBeenCalledWith(
        '[AI Task Queue] Task enqueued',
        expect.objectContaining({
          taskId: 'task-123',
          taskType: AITaskType.INSIGHT_GENERATION,
          userId: 'user-1',
          priority: AITaskPriority.HIGH,
          fallback: 'ai-task-queue-task-enqueued',
        }),
      );

      expect(aiTaskQueue.getQueueStats()).toEqual({
        pending: 1,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      });

      expect(aiTaskQueue.cancelTask('task-123')).toBe(true);
      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0].detail).toEqual(expect.objectContaining({
        taskId: 'task-123',
        status: AITaskStatus.CANCELLED,
        userId: 'user-1',
      }));
      expect(aiTaskQueue.getQueueStats()).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 1,
      });
      expect(logInfoMock).toHaveBeenCalledWith(
        '[AI Task Queue] Task cancelled',
        expect.objectContaining({
          taskId: 'task-123',
          fallback: 'ai-task-queue-task-cancelled',
        }),
      );

      aiTaskQueue.shutdown();
      expect(stopMock).toHaveBeenCalledTimes(1);
      expect(logInfoMock).toHaveBeenCalledWith(
        '[AI Task Queue] Shutdown complete',
        expect.objectContaining({ fallback: 'ai-task-queue-shutdown-complete' }),
      );
    } finally {
      window.removeEventListener('ai-task-enqueued', enqueueHandler);
      window.removeEventListener('ai-task-updated', updateHandler);
    }
  });
});
