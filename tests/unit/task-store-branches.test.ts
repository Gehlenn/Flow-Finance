import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';
import { AITaskPriority, AITaskStatus, AITaskType, type AITask } from '../../src/ai/queue/taskTypes';

const logWarnMock = vi.fn();
const logInfoMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => logWarnMock(...args),
  logInfo: (...args: unknown[]) => logInfoMock(...args),
}));

function setWorkspace(workspaceId: string): void {
  localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
}

function buildTask(overrides: Partial<AITask> = {}): AITask {
  return {
    id: overrides.id || 'task',
    type: overrides.type || AITaskType.INSIGHT_GENERATION,
    payload: overrides.payload || { ok: true },
    status: overrides.status || AITaskStatus.PENDING,
    priority: overrides.priority ?? AITaskPriority.NORMAL,
    createdAt: overrides.createdAt ?? Date.now(),
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 2,
    userId: overrides.userId || 'user-1',
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    result: overrides.result,
    error: overrides.error,
  };
}

describe('taskStore branch coverage', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    logWarnMock.mockReset();
    logInfoMock.mockReset();
    setWorkspace('ws-task-branches');
  });

  it('loads malformed storage safely and keeps queue empty', async () => {
    localStorage.setItem('flow_ai_task_queue:ws-task-branches', '{bad');

    const { taskStore } = await import('../../src/ai/queue/taskStore');

    expect(taskStore.getAllTasks()).toEqual([]);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[TaskStore] Failed to load from storage; using empty queue',
      expect.objectContaining({
        storageKey: 'flow_ai_task_queue:ws-task-branches',
        error: expect.any(Error),
        fallback: 'task-store-load-failed',
      }),
    );
  });

  it('cleans expired completed and failed tasks on initialization', async () => {
    const now = Date.now();
    const old = now - 25 * 60 * 60 * 1000;

    localStorage.setItem(
      'flow_ai_task_queue:ws-task-branches',
      JSON.stringify({
        completed_old: buildTask({ id: 'completed_old', status: AITaskStatus.COMPLETED, createdAt: old }),
        failed_old: buildTask({ id: 'failed_old', status: AITaskStatus.FAILED, createdAt: old }),
        processing_old: buildTask({ id: 'processing_old', status: AITaskStatus.PROCESSING, createdAt: old }),
      }),
    );

    const { taskStore } = await import('../../src/ai/queue/taskStore');
    const ids = taskStore.getAllTasks().map((task) => task.id);

    expect(ids).not.toContain('completed_old');
    expect(ids).not.toContain('failed_old');
    expect(ids).toContain('processing_old');
    expect(logInfoMock).toHaveBeenCalledWith(
      '[TaskStore] Cleaned expired tasks',
      expect.objectContaining({ cleaned: 2, fallback: 'task-store-cleaned-expired-tasks' }),
    );
  });

  it('enforces max queue size and keeps newest tasks', async () => {
    const { taskStore } = await import('../../src/ai/queue/taskStore');

    for (let i = 0; i < 110; i += 1) {
      taskStore.addTask(
        buildTask({
          id: `task-${i}`,
          createdAt: i,
          priority: AITaskPriority.NORMAL,
        }),
      );
    }

    const all = taskStore.getAllTasks();
    const ids = new Set(all.map((task) => task.id));

    expect(all).toHaveLength(100);
    expect(ids.has('task-0')).toBe(false);
    expect(ids.has('task-109')).toBe(true);
  });

  it('covers no-op branches for missing task updates and status transitions', async () => {
    const { taskStore, updateTaskStatus } = await import('../../src/ai/queue/taskStore');

    taskStore.updateTask('missing-id', { result: { ok: false } });
    updateTaskStatus('missing-id', AITaskStatus.FAILED);

    taskStore.addTask(buildTask({ id: 'done', status: AITaskStatus.COMPLETED }));
    taskStore.addTask(buildTask({ id: 'processing', status: AITaskStatus.PROCESSING }));

    expect(taskStore.getTasksByStatus(AITaskStatus.CANCELLED)).toEqual([]);
    expect(taskStore.getNextTask('user-not-found')).toBeNull();

    taskStore.clearCompletedTasks('another-user');
    expect(taskStore.getTask('done')).toBeDefined();

    taskStore.clear();
    expect(taskStore.getAllTasks()).toEqual([]);
  });
  it('covers ordering branches for same priority and user/status sorting', async () => {
    const { taskStore } = await import('../../src/ai/queue/taskStore');

    taskStore.addTask(buildTask({ id: 'same-priority-new', priority: AITaskPriority.NORMAL, createdAt: 200, userId: 'user-sort' }));
    taskStore.addTask(buildTask({ id: 'same-priority-old', priority: AITaskPriority.NORMAL, createdAt: 100, userId: 'user-sort' }));
    taskStore.addTask(buildTask({ id: 'completed-a', status: AITaskStatus.COMPLETED, createdAt: 300, userId: 'user-sort' }));
    taskStore.addTask(buildTask({ id: 'completed-b', status: AITaskStatus.COMPLETED, createdAt: 250, userId: 'user-sort' }));

    expect(taskStore.getNextTask('user-sort')?.id).toBe('same-priority-old');

    const completed = taskStore.getTasksByStatus(AITaskStatus.COMPLETED);
    expect(completed.map((task) => task.id)).toEqual(['completed-a', 'completed-b']);

    const byUser = taskStore.getTasksByUser('user-sort');
    expect(byUser[0].createdAt).toBeGreaterThanOrEqual(byUser[1].createdAt);
  });

  it('updateTask with existing task mutates and persists', async () => {
    const { taskStore } = await import('../../src/ai/queue/taskStore');

    taskStore.addTask(buildTask({ id: 'to-update', result: undefined }));
    taskStore.updateTask('to-update', { result: { done: true }, retryCount: 1 });

    const updated = taskStore.getTask('to-update');
    expect((updated?.result as any)?.done).toBe(true);
    expect(updated?.retryCount).toBe(1);
  });
});

