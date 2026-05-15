import { beforeEach, describe, expect, it } from 'vitest';

import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';
import {
  addTask,
  getNextTask,
  getNextTaskForUser,
  taskStore,
  updateTaskStatus,
} from '../../src/ai/queue/taskStore';
import { AITaskPriority, AITaskStatus, AITaskType, type AITask } from '../../src/ai/queue/taskTypes';

function setWorkspace(workspaceId: string): void {
  localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
}

function buildTask(overrides: Partial<AITask> = {}): AITask {
  return {
    id: overrides.id || 'task-1',
    type: overrides.type || AITaskType.INSIGHT_GENERATION,
    payload: overrides.payload || { sample: true },
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

describe('taskStore core flows', () => {
  beforeEach(() => {
    localStorage.clear();
    setWorkspace('ws-task-store');
    taskStore.clear();
  });

  it('prioritizes pending tasks and supports user-scoped next task', () => {
    const base = Date.now();

    addTask(buildTask({ id: 'low', priority: AITaskPriority.LOW, createdAt: base - 10, userId: 'user-a' }));
    addTask(buildTask({ id: 'high', priority: AITaskPriority.HIGH, createdAt: base - 5, userId: 'user-a' }));
    addTask(buildTask({ id: 'urgent-other-user', priority: AITaskPriority.URGENT, createdAt: base - 20, userId: 'user-b' }));

    expect(getNextTask()?.id).toBe('urgent-other-user');
    expect(getNextTaskForUser('user-a')?.id).toBe('high');
  });

  it('updates status timestamps, tracks errors and exposes counts/snapshots', () => {
    addTask(buildTask({ id: 'processing-target', userId: 'user-a' }));
    addTask(buildTask({ id: 'second', userId: 'user-a' }));

    updateTaskStatus('processing-target', AITaskStatus.PROCESSING);
    const processingTask = taskStore.getTask('processing-target');
    expect(processingTask?.startedAt).toBeTypeOf('number');

    taskStore.updateTaskStatus('processing-target', AITaskStatus.FAILED, 'worker failed');
    const failedTask = taskStore.getTask('processing-target');
    expect(failedTask?.completedAt).toBeTypeOf('number');
    expect(failedTask?.error?.message).toBe('worker failed');

    updateTaskStatus('second', AITaskStatus.COMPLETED);

    expect(taskStore.getPendingCount()).toBe(0);
    expect(taskStore.getProcessingCount()).toBe(0);

    const snapshot = taskStore.getUserTaskSnapshot('user-a');
    expect(snapshot.failed).toHaveLength(1);
    expect(snapshot.completed).toHaveLength(1);
  });

  it('clears completed and failed tasks with optional user filter', () => {
    addTask(buildTask({ id: 'a-completed', userId: 'user-a', status: AITaskStatus.COMPLETED }));
    addTask(buildTask({ id: 'a-failed', userId: 'user-a', status: AITaskStatus.FAILED }));
    addTask(buildTask({ id: 'a-pending', userId: 'user-a', status: AITaskStatus.PENDING }));
    addTask(buildTask({ id: 'b-completed', userId: 'user-b', status: AITaskStatus.COMPLETED }));

    taskStore.clearCompletedTasks('user-a');
    expect(taskStore.getTask('a-completed')).toBeUndefined();
    expect(taskStore.getTask('a-failed')).toBeUndefined();
    expect(taskStore.getTask('a-pending')).toBeDefined();
    expect(taskStore.getTask('b-completed')).toBeDefined();

    taskStore.clearCompletedTasks();
    expect(taskStore.getTask('b-completed')).toBeUndefined();
  });

  it('emits queue mutation events for add, update and clear flows', () => {
    const events: Array<{ name: string; detail: unknown }> = [];
    const handler = (event: Event): void => {
      const custom = event as CustomEvent;
      events.push({ name: event.type, detail: custom.detail });
    };

    window.addEventListener('ai-task-enqueued', handler);
    window.addEventListener('ai-task-updated', handler);
    window.addEventListener('ai-task-queue-cleared', handler);

    try {
      addTask(buildTask({ id: 'event-task', userId: 'user-a' }));
      updateTaskStatus('event-task', AITaskStatus.COMPLETED);
      taskStore.clearCompletedTasks('user-a');

      expect(events).toEqual([
        {
          name: 'ai-task-enqueued',
          detail: expect.objectContaining({
            taskId: 'event-task',
            taskType: AITaskType.INSIGHT_GENERATION,
            status: AITaskStatus.PENDING,
            priority: AITaskPriority.NORMAL,
            userId: 'user-a',
          }),
        },
        {
          name: 'ai-task-updated',
          detail: expect.objectContaining({
            taskId: 'event-task',
            status: AITaskStatus.COMPLETED,
            userId: 'user-a',
          }),
        },
        {
          name: 'ai-task-queue-cleared',
          detail: expect.objectContaining({
            userId: 'user-a',
            scope: 'user',
          }),
        },
      ]);
    } finally {
      window.removeEventListener('ai-task-enqueued', handler);
      window.removeEventListener('ai-task-updated', handler);
      window.removeEventListener('ai-task-queue-cleared', handler);
    }
  });

  it('emits global clear event with all scope', () => {
    const events: Array<{ name: string; detail: unknown }> = [];
    const handler = (event: Event): void => {
      const custom = event as CustomEvent;
      events.push({ name: event.type, detail: custom.detail });
    };

    window.addEventListener('ai-task-queue-cleared', handler);

    try {
      addTask(buildTask({ id: 'clear-all-task', userId: 'user-a', status: AITaskStatus.COMPLETED }));
      taskStore.clearCompletedTasks();

      expect(events).toEqual([
        {
          name: 'ai-task-queue-cleared',
          detail: expect.objectContaining({
            userId: null,
            scope: 'all',
          }),
        },
      ]);
    } finally {
      window.removeEventListener('ai-task-queue-cleared', handler);
    }
  });
});

