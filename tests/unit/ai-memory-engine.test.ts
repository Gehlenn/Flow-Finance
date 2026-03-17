import { beforeEach, describe, expect, it } from 'vitest';
import {
  aiMemoryEngine,
  updateAIMemory,
  getAIMemories,
  getSpendingPatterns,
  getMerchantCategories,
  getRecurringExpenses,
  getUserBehaviors,
  getFinancialProfile,
  getMemoryStats,
} from '../../src/ai/memory/AIMemoryEngine';
import { aiMemoryStore } from '../../src/ai/memory/AIMemoryStore';
import { AIMemoryType } from '../../src/ai/memory/memoryTypes';
import { Category, TransactionType } from '../../types';
import type { Transaction } from '../../types';

// ─── Fixture factory ──────────────────────────────────────────────────────────

let _id = 0;

function tx(
  description: string,
  amount: number,
  type: TransactionType,
  daysAgo: number,
  merchant?: string,
  recurring = false,
): Transaction {
  return {
    id: `t${++_id}`,
    description,
    merchant,
    amount,
    type,
    category: Category.PESSOAL,
    date: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    recurring,
    confidence_score: 0.8,
  } as any;
}

/** Builds a realistic transaction set large enough for the engine to process. */
function buildTxSet(userId: string): Transaction[] {
  return [
    // Income (monthly)
    tx('Salário Empresa SA', 5000, TransactionType.RECEITA, 5,  'Empresa SA'),
    tx('Salário Empresa SA', 5000, TransactionType.RECEITA, 35, 'Empresa SA'),
    tx('Salário Empresa SA', 5000, TransactionType.RECEITA, 65, 'Empresa SA'),
    // Recurring subscriptions
    tx('Netflix',  49.9, TransactionType.DESPESA, 3,  'Netflix',  true),
    tx('Netflix',  49.9, TransactionType.DESPESA, 33, 'Netflix',  true),
    tx('Netflix',  49.9, TransactionType.DESPESA, 63, 'Netflix',  true),
    tx('Spotify',  21.9, TransactionType.DESPESA, 3,  'Spotify',  true),
    tx('Spotify',  21.9, TransactionType.DESPESA, 33, 'Spotify',  true),
    // Frequent merchant
    tx('iFood',    38,   TransactionType.DESPESA, 2,  'iFood'),
    tx('iFood',    42,   TransactionType.DESPESA, 9,  'iFood'),
    tx('iFood',    55,   TransactionType.DESPESA, 16, 'iFood'),
    tx('iFood',    61,   TransactionType.DESPESA, 23, 'iFood'),
    // Assorted expenses
    tx('Supermercado', 320, TransactionType.DESPESA, 4),
    tx('Aluguel',     1200, TransactionType.DESPESA, 1),
    tx('Farmácia',      80, TransactionType.DESPESA, 7),
  ];
}

describe('AIMemoryEngine', () => {
  beforeEach(() => {
    localStorage.clear();
    aiMemoryStore.clearUserMemories('u1');
    aiMemoryStore.clearUserMemories('u2');
  });

  // ─── updateAIMemory (short path) ──────────────────────────────────────────

  it('updateAIMemory returns 0 when transactions are fewer than minOccurrences (3)', async () => {
    const count = await updateAIMemory('u1', [
      tx('t1', 10, TransactionType.DESPESA, 1),
      tx('t2', 20, TransactionType.DESPESA, 2),
    ]);
    expect(count).toBe(0);
  });

  // ─── updateAIMemory (full path) ───────────────────────────────────────────

  it('updateAIMemory returns positive count for sufficient transactions', async () => {
    const count = await updateAIMemory('u1', buildTxSet('u1'));
    expect(count).toBeGreaterThan(0);
  });

  it('updateAIMemory creates at least one merchant category memory', async () => {
    await updateAIMemory('u1', buildTxSet('u1'));
    const merchants = getMerchantCategories('u1');
    expect(merchants.length).toBeGreaterThan(0);
    expect(merchants[0].merchantName).toBeTruthy();
  });

  it('updateAIMemory creates at least one recurring expense memory', async () => {
    await updateAIMemory('u1', buildTxSet('u1'));
    const recurring = getRecurringExpenses('u1');
    expect(recurring.length).toBeGreaterThan(0);
    expect(recurring[0].merchantName).toBeTruthy();
  });

  it('updateAIMemory creates a financial profile memory', async () => {
    await updateAIMemory('u1', buildTxSet('u1'));
    const profile = getFinancialProfile('u1');
    expect(profile).not.toBeNull();
    expect(profile!.savingsRate).toBeTypeOf('number');
  });

  it('updateAIMemory creates at least one spending pattern memory', async () => {
    await updateAIMemory('u1', buildTxSet('u1'));
    const patterns = getSpendingPatterns('u1');
    expect(patterns.length).toBeGreaterThan(0);
  });

  // ─── Incremental learning (second call strengthens existing) ─────────────

  it('second updateAIMemory call increases strength for existing memories', async () => {
    const txs = buildTxSet('u1');
    await updateAIMemory('u1', txs);
    const before = getAIMemories('u1', AIMemoryType.MERCHANT_CATEGORY)
      .reduce((sum, m) => sum + m.strength, 0);

    await updateAIMemory('u1', txs);
    const after = getAIMemories('u1', AIMemoryType.MERCHANT_CATEGORY)
      .reduce((sum, m) => sum + m.strength, 0);

    expect(after).toBeGreaterThan(before);
  });

  // ─── User isolation ───────────────────────────────────────────────────────

  it('memories are isolated per userId', async () => {
    await updateAIMemory('u1', buildTxSet('u1'));
    expect(getAIMemories('u2')).toHaveLength(0);
  });

  // ─── getUserBehaviors ─────────────────────────────────────────────────────

  it('getUserBehaviors returns array after learning', async () => {
    await updateAIMemory('u1', buildTxSet('u1'));
    const behaviors = getUserBehaviors('u1');
    expect(Array.isArray(behaviors)).toBe(true);
  });

  // ─── getMemoryStats ───────────────────────────────────────────────────────

  it('getMemoryStats returns totalMemories matching actual saved count', async () => {
    const count = await updateAIMemory('u1', buildTxSet('u1'));
    const stats = getMemoryStats('u1');

    expect(stats.totalMemories).toBe(count);
    expect(stats.avgConfidence).toBeGreaterThan(0);
    expect(stats.avgStrength).toBeGreaterThan(0);
  });

  // ─── clearUserMemories ────────────────────────────────────────────────────

  it('clearUserMemories resets all memories for user', async () => {
    await updateAIMemory('u1', buildTxSet('u1'));
    expect(getAIMemories('u1').length).toBeGreaterThan(0);

    aiMemoryEngine.clearUserMemories('u1');
    expect(getAIMemories('u1')).toHaveLength(0);
  });

  it('stores confidence + expiration signals for category distribution patterns', () => {
    aiMemoryEngine.updateMemory(
      {
        recurring: [],
        weeklySpikes: [],
        categoryDominance: ['Pessoal', 1200],
        recurringInsights: [],
        weeklySpikeInsights: [],
        dominantCategoryShare: 0.68,
        confidence: {
          recurring: 0,
          weeklySpikes: 0,
          categoryDominance: 0.82,
          overall: 0.27,
        },
      },
      'u1',
    );

    const memories = getAIMemories('u1', AIMemoryType.SPENDING_PATTERN);
    const categoryMemory = memories.find((m) => m.key === 'category_dominance');

    expect(categoryMemory).toBeDefined();
    expect(categoryMemory?.metadata?.signalType).toBe('category_distribution');
    expect(categoryMemory?.metadata?.confidenceBand).toBe('high');
    expect(typeof categoryMemory?.metadata?.expiresAt).toBe('number');
    expect(categoryMemory!.metadata!.expiresAt).toBeGreaterThan(Date.now());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AIMemoryStore — direct unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('AIMemoryStore', () => {
  beforeEach(() => {
    localStorage.clear();
    aiMemoryStore.clearUserMemories('u1');
  });

  it('saveMemory → getMemoriesByUser round-trip', () => {
    aiMemoryStore.saveMemory({
      id: 'mem1',
      userId: 'u1',
      type: AIMemoryType.SPENDING_PATTERN,
      key: 'weekend',
      value: { pattern: 'weekend', avgAmount: 150, frequency: 3 },
      confidence: 0.7,
      strength: 30,
      occurrences: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastObservedAt: Date.now(),
    });

    const memories = aiMemoryStore.getMemoriesByUser('u1');
    expect(memories).toHaveLength(1);
    expect(memories[0].key).toBe('weekend');
  });

  it('queryMemories filters by type + minConfidence', () => {
    aiMemoryStore.saveMemory({ id: 'm1', userId: 'u1', type: AIMemoryType.MERCHANT_CATEGORY, key: 'ifood', value: {}, confidence: 0.9, strength: 40, occurrences: 1, createdAt: Date.now(), updatedAt: Date.now(), lastObservedAt: Date.now() });
    aiMemoryStore.saveMemory({ id: 'm2', userId: 'u1', type: AIMemoryType.SPENDING_PATTERN,  key: 'x',     value: {}, confidence: 0.2, strength: 10, occurrences: 1, createdAt: Date.now(), updatedAt: Date.now(), lastObservedAt: Date.now() });

    const results = aiMemoryStore.queryMemories({
      userId:        'u1',
      type:          AIMemoryType.MERCHANT_CATEGORY,
      minConfidence: 0.5,
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('m1');
  });

  it('updateMemory mutates value and bumps updatedAt', () => {
    const before = Date.now();
    aiMemoryStore.saveMemory({ id: 'upd1', userId: 'u1', type: AIMemoryType.USER_BEHAVIOR, key: 'b', value: 'old', confidence: 0.5, strength: 20, occurrences: 1, createdAt: before - 1000, updatedAt: before - 1000, lastObservedAt: before - 1000 });

    aiMemoryStore.updateMemory('upd1', { value: 'new', confidence: 0.9 });

    const mem = aiMemoryStore.getMemory('upd1')!;
    expect(mem.value).toBe('new');
    expect(mem.confidence).toBe(0.9);
    expect(mem.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('deleteMemory removes only the target entry', () => {
    aiMemoryStore.saveMemory({ id: 'del1', userId: 'u1', type: AIMemoryType.USER_BEHAVIOR, key: 'bx', value: {}, confidence: 0.5, strength: 10, occurrences: 1, createdAt: Date.now(), updatedAt: Date.now(), lastObservedAt: Date.now() });
    aiMemoryStore.saveMemory({ id: 'keep1', userId: 'u1', type: AIMemoryType.USER_BEHAVIOR, key: 'by', value: {}, confidence: 0.5, strength: 10, occurrences: 1, createdAt: Date.now(), updatedAt: Date.now(), lastObservedAt: Date.now() });

    aiMemoryStore.deleteMemory('del1');
    expect(aiMemoryStore.getMemoriesByUser('u1')).toHaveLength(1);
    expect(aiMemoryStore.getMemory('del1')).toBeUndefined();
  });

  it('getStats reflects stored memories correctly', () => {
    aiMemoryStore.saveMemory({ id: 's1', userId: 'u1', type: AIMemoryType.SPENDING_PATTERN, key: 'k1', value: {}, confidence: 0.8, strength: 50, occurrences: 2, createdAt: Date.now(), updatedAt: Date.now(), lastObservedAt: Date.now() });
    aiMemoryStore.saveMemory({ id: 's2', userId: 'u1', type: AIMemoryType.MERCHANT_CATEGORY, key: 'k2', value: {}, confidence: 0.6, strength: 30, occurrences: 1, createdAt: Date.now(), updatedAt: Date.now(), lastObservedAt: Date.now() });

    const stats = aiMemoryStore.getStats('u1');
    expect(stats.totalMemories).toBe(2);
    expect(stats.avgConfidence).toBeCloseTo(0.7);
    expect(stats.byType[AIMemoryType.SPENDING_PATTERN]).toBe(1);
    expect(stats.byType[AIMemoryType.MERCHANT_CATEGORY]).toBe(1);
  });

  it('queryMemories ignores entries with expired metadata.expiresAt', () => {
    aiMemoryStore.saveMemory({
      id: 'exp1',
      userId: 'u1',
      type: AIMemoryType.SPENDING_PATTERN,
      key: 'category_dominance',
      value: { category: 'Pessoal', amount: 900 },
      confidence: 0.9,
      strength: 50,
      occurrences: 2,
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 1000,
      lastObservedAt: Date.now() - 1000,
      metadata: { expiresAt: Date.now() - 1 },
    });

    const results = aiMemoryStore.queryMemories({ userId: 'u1' });
    expect(results.find((m) => m.id === 'exp1')).toBeUndefined();
  });
});
