import { describe, expect, it, vi } from 'vitest';

const engineMocks = vi.hoisted(() => ({
  saveMemory: vi.fn(),
  updateMemory: vi.fn(),
  getMemoriesByType: vi.fn(() => []),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  analyzeSpendingPatterns: vi.fn(),
  analyzeMerchantCategories: vi.fn(),
  analyzeRecurringExpenses: vi.fn(),
  analyzeUserBehavior: vi.fn(),
  analyzeFinancialProfile: vi.fn(),
  analyzeIncomePatterns: vi.fn(),
  analyzeTimePatterns: vi.fn(),
}));

vi.mock('../../src/ai/memory/AIMemoryStore', () => ({
  aiMemoryStore: {
    saveMemory: engineMocks.saveMemory,
    updateMemory: engineMocks.updateMemory,
    getMemoriesByType: engineMocks.getMemoriesByType,
  },
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: engineMocks.logWarn,
  logInfo: engineMocks.logInfo,
}));

vi.mock('../../src/ai/memory/memoryAnalyzer', () => ({
  analyzeSpendingPatterns: engineMocks.analyzeSpendingPatterns,
  analyzeMerchantCategories: engineMocks.analyzeMerchantCategories,
  analyzeRecurringExpenses: engineMocks.analyzeRecurringExpenses,
  analyzeUserBehavior: engineMocks.analyzeUserBehavior,
  analyzeFinancialProfile: engineMocks.analyzeFinancialProfile,
  analyzeIncomePatterns: engineMocks.analyzeIncomePatterns,
  analyzeTimePatterns: engineMocks.analyzeTimePatterns,
}));

import { updateAIMemory } from '../../src/ai/memory/AIMemoryEngine';
import { Category, TransactionType, type Transaction } from '../../types';

describe('AIMemoryEngine observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs contextual data when there are not enough transactions', async () => {
    const transactions = [
      {
        id: 'tx-1',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Teste',
        date: '2026-05-10',
        source: 'manual',
        generated: false,
        confidence_score: 1,
        account_id: 'acc-1',
      },
      {
        id: 'tx-2',
        amount: 120,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Teste',
        date: '2026-05-09',
        source: 'manual',
        generated: false,
        confidence_score: 1,
        account_id: 'acc-1',
      },
    ] as Transaction[];

    const count = await updateAIMemory('user-1', transactions);

    expect(count).toBe(0);
    expect(engineMocks.logWarn).toHaveBeenCalledWith(
      '[AI Memory Engine] Not enough transactions to learn from',
      expect.objectContaining({
        userId: 'user-1',
        transactionCount: 2,
        minOccurrences: 3,
        fallback: 'ai-memory-engine-not-enough-transactions',
      }),
    );
  });

  it('logs contextual data when memory persistence fails', async () => {
    engineMocks.analyzeSpendingPatterns.mockReturnValue([
      ['weekly_spikes', { pattern: 'weekly_spikes', frequency: 3 }],
    ]);
    engineMocks.analyzeMerchantCategories.mockReturnValue([]);
    engineMocks.analyzeRecurringExpenses.mockReturnValue([]);
    engineMocks.analyzeUserBehavior.mockReturnValue([]);
    engineMocks.analyzeFinancialProfile.mockReturnValue(null);
    engineMocks.analyzeIncomePatterns.mockReturnValue([]);
    engineMocks.analyzeTimePatterns.mockReturnValue([]);
    engineMocks.saveMemory.mockImplementation(() => {
      throw new Error('storage offline');
    });

    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Teste',
        date: '2026-05-10',
        source: 'manual',
        generated: false,
        confidence_score: 1,
        account_id: 'acc-1',
      },
      {
        id: 'tx-2',
        amount: 120,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Teste',
        date: '2026-05-09',
        source: 'manual',
        generated: false,
        confidence_score: 1,
        account_id: 'acc-1',
      },
      {
        id: 'tx-3',
        amount: 140,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Teste',
        date: '2026-05-08',
        source: 'manual',
        generated: false,
        confidence_score: 1,
        account_id: 'acc-1',
      },
    ];

    const count = await updateAIMemory('user-1', transactions);

    expect(count).toBe(0);
    expect(engineMocks.logWarn).toHaveBeenCalledWith(
      '[AI Memory Engine] Error updating memories; continuing without persistence',
      expect.objectContaining({
        userId: 'user-1',
        error: expect.any(Error),
      }),
    );
  });

  it('logs contextual data when memory update succeeds', async () => {
    engineMocks.analyzeSpendingPatterns.mockReturnValue([]);
    engineMocks.analyzeMerchantCategories.mockReturnValue([]);
    engineMocks.analyzeRecurringExpenses.mockReturnValue([]);
    engineMocks.analyzeUserBehavior.mockReturnValue([]);
    engineMocks.analyzeFinancialProfile.mockReturnValue(null);
    engineMocks.analyzeIncomePatterns.mockReturnValue([]);
    engineMocks.analyzeTimePatterns.mockReturnValue([]);

    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Teste',
        date: '2026-05-10',
        source: 'manual',
        generated: false,
        confidence_score: 1,
        account_id: 'acc-1',
      },
      {
        id: 'tx-2',
        amount: 120,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Teste',
        date: '2026-05-09',
        source: 'manual',
        generated: false,
        confidence_score: 1,
        account_id: 'acc-1',
      },
      {
        id: 'tx-3',
        amount: 140,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Teste',
        date: '2026-05-08',
        source: 'manual',
        generated: false,
        confidence_score: 1,
        account_id: 'acc-1',
      },
    ];

    const count = await updateAIMemory('user-1', transactions);

    expect(count).toBe(0);
    expect(engineMocks.logInfo).toHaveBeenCalledWith(
      '[AI Memory Engine] Updated memories for user',
      expect.objectContaining({
        userId: 'user-1',
        memoriesUpdated: 0,
        fallback: 'ai-memory-engine-updated-memories',
      }),
    );
  });
});
