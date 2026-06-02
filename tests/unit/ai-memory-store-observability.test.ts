import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logInfoMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logInfo: (...args: unknown[]) => logInfoMock(...args),
}));

describe('AIMemoryStore observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs contextual data when decayed memories are pruned', async () => {
    const { aiMemoryStore } = await import('../../src/ai/memory/AIMemoryStore');
    const { AIMemoryType } = await import('../../src/ai/memory/memoryTypes');

    const now = Date.now();
    aiMemoryStore.saveMemory({
      id: 'decay-1',
      userId: 'u1',
      type: AIMemoryType.SPENDING_PATTERN,
      key: 'category_dominance',
      value: { category: 'Pessoal', amount: 900 },
      confidence: 0.95,
      strength: 95,
      occurrences: 3,
      createdAt: now - 100 * 86400000,
      updatedAt: now - 100 * 86400000,
      lastObservedAt: now - 100 * 86400000,
      metadata: { contextDecayMultiplier: 2 },
    });

    aiMemoryStore.setDecayConfig({ enabled: true, timeWindow: 1, decayRate: 0.01, minConfidence: 0.9 });
    aiMemoryStore.runDecayCycle();

    expect(logInfoMock).toHaveBeenCalledWith(
      '[AI Memory Store] Decayed old memories',
      expect.objectContaining({
        decayed: expect.any(Number),
        fallback: 'ai-memory-store-decayed-old-memories',
      }),
    );
  });

  it('loads decayed memories without reentering storage during the initial decay pass', async () => {
    localStorage.setItem('active_workspace_id', 'ws-ai-memory');
    const now = Date.now();
    localStorage.setItem(
      'flow_ai_memory_v2:ws-ai-memory',
      JSON.stringify([
        {
          id: 'old-1',
          userId: 'user-1',
          type: 'spending_pattern',
          key: 'stale_pattern',
          value: { category: 'transporte' },
          confidence: 0.19,
          strength: 19,
          occurrences: 1,
          createdAt: now - 100 * 86400000,
          updatedAt: now - 100 * 86400000,
          lastObservedAt: now - 100 * 86400000,
        },
      ]),
    );

    const originalGetItem = Storage.prototype.getItem;
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    let getItemCalls = 0;

    getItemSpy.mockImplementation(function (this: Storage, key: string) {
      getItemCalls += 1;
      if (getItemCalls > 3) {
        throw new Error('reentrant load detected');
      }

      return originalGetItem.call(this, key);
    });

    await expect(import('../../src/ai/memory/AIMemoryStore')).resolves.toMatchObject({
      aiMemoryStore: expect.any(Object),
    });

    expect(getItemCalls).toBe(3);
    expect(setItemSpy).toHaveBeenCalledWith('flow_ai_memory_v2:ws-ai-memory', '[]');
  });
});
