import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';

const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logInfo: (...args: unknown[]) => logInfoMock(...args),
  logWarn: (...args: unknown[]) => logWarnMock(...args),
}));

describe('taskStore cleanup observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, 'ws-cleanup');
  });

  it('logs contextual data when expired tasks are cleaned', async () => {
    const storedKey = 'flow_ai_task_queue:ws-cleanup';
    localStorage.setItem(storedKey, JSON.stringify({
      task_old: {
        id: 'task_old',
        userId: 'user-1',
        type: 'INSIGHT_GENERATION',
        status: 'COMPLETED',
        priority: 1,
        createdAt: Date.now() - (25 * 60 * 60 * 1000),
        payload: { prompt: 'old task' },
        retryCount: 0,
        maxRetries: 2,
      },
    }));

    const { taskStore } = await import('../../src/ai/queue/taskStore');

    expect(taskStore.getAllTasks()).toEqual([]);
    expect(logInfoMock).toHaveBeenCalledWith(
      '[TaskStore] Cleaned expired tasks',
      expect.objectContaining({
        cleaned: 1,
        storageKey: storedKey,
        fallback: 'task-store-cleaned-expired-tasks',
      }),
    );
  });
});
