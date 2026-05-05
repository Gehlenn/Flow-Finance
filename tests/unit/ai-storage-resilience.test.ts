import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('AI storage resilience', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads AI memory store, task store and debug logs safely when storage is malformed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    localStorage.setItem('flow_ai_memory_v2:global', '{"bad":true}');
    localStorage.setItem('flow_ai_task_queue:global', '[]');
    localStorage.setItem('flow_ai_debug:global', '{bad');

    const [{ aiMemoryStore }, { taskStore }, debugService] = await Promise.all([
      import('../../src/ai/memory/AIMemoryStore'),
      import('../../src/ai/queue/taskStore'),
      import('../../src/ai/aiDebugService'),
    ]);

    expect(aiMemoryStore.getAllMemories()).toEqual([]);
    expect(taskStore.getAllTasks()).toEqual([]);
    expect(debugService.getAIDebugLogs()).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();

    debugService.logAIDebug({
      input: 'teste',
      error: 'falha',
    });

    expect(debugService.getAIDebugLogs().length).toBeGreaterThan(0);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to persist debug logs'),
    );
  });
});
