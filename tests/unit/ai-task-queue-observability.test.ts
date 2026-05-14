import { beforeEach, describe, expect, it, vi } from 'vitest';

const addTaskMock = vi.fn();
const getTaskMock = vi.fn();
const updateTaskStatusMock = vi.fn();
const startMock = vi.fn();
const stopMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

vi.mock('../../src/ai/queue/taskStore', () => ({
  taskStore: {
    addTask: (...args: unknown[]) => addTaskMock(...args),
    getTask: (...args: unknown[]) => getTaskMock(...args),
    updateTaskStatus: (...args: unknown[]) => updateTaskStatusMock(...args),
    getTasksByUser: vi.fn(),
    getTasksByStatus: vi.fn(),
    getAllTasks: vi.fn(),
    clearCompletedTasks: vi.fn(),
  },
}));

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
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('logs initialization, enqueue and cancel events with context', async () => {
    const { aiTaskQueue, enqueueTaskForUser } = await import('../../src/ai/queue/AITaskQueue');
    const { AITaskPriority, AITaskStatus, AITaskType } = await import('../../src/ai/queue/taskTypes');

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
    expect(addTaskMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'task-123',
      type: AITaskType.INSIGHT_GENERATION,
      userId: 'user-1',
      priority: AITaskPriority.HIGH,
      maxRetries: 4,
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

    getTaskMock.mockReturnValueOnce({
      id: 'task-123',
      status: AITaskStatus.PENDING,
    });

    expect(aiTaskQueue.cancelTask('task-123')).toBe(true);
    expect(updateTaskStatusMock).toHaveBeenCalledWith('task-123', AITaskStatus.CANCELLED);
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
  });
});
