import { beforeEach, describe, expect, it, vi } from 'vitest';

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
});

