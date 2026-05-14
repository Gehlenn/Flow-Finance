import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logWarnMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => logWarnMock(...args),
}));

describe('AI storage resilience', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads AI memory store, task store and debug logs safely when storage is malformed', async () => {
    logWarnMock.mockReset();

    localStorage.setItem('flow_ai_memory:global', '{"bad":true}');
    localStorage.setItem('flow_ai_memory_v2:global', '{bad');
    localStorage.setItem('flow_ai_task_queue:global', '{bad');
    localStorage.setItem('flow_ai_debug:global', '{bad');

    const [{ aiMemoryStore }, { taskStore }, aiMemory, debugService] = await Promise.all([
      import('../../src/ai/memory/AIMemoryStore'),
      import('../../src/ai/queue/taskStore'),
      import('../../src/ai/aiMemory'),
      import('../../src/ai/aiDebugService'),
    ]);

    expect(aiMemoryStore.getAllMemories()).toEqual([]);
    expect(taskStore.getAllTasks()).toEqual([]);
    expect(aiMemory.getAIMemorySnapshot('user-1')).toEqual([]);
    expect(debugService.getAIDebugLogs()).toEqual([]);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[AI Memory Store] Failed to load; returning empty memory set',
      expect.objectContaining({
        storageKey: 'flow_ai_memory_v2:global',
        error: expect.any(Error),
      }),
    );
    expect(logWarnMock).toHaveBeenCalledWith(
      '[TaskStore] Failed to load from storage; using empty queue',
      expect.objectContaining({
        storageKey: 'flow_ai_task_queue:global',
        error: expect.any(Error),
        fallback: 'task-store-load-failed',
      }),
    );

    debugService.logAIDebug({
      input: 'teste',
      error: 'falha',
    });

    expect(debugService.getAIDebugLogs().length).toBeGreaterThan(0);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[AIDebug] Failed to parse debug logs storage; returning empty set',
      expect.objectContaining({
        storageKey: 'flow_ai_debug:global',
        error: expect.any(Error),
        fallback: 'ai-debug-parse-failed',
      }),
    );
  });
});
