import { describe, expect, it, vi } from 'vitest';

const insightMocks = vi.hoisted(() => ({
  buildFinancialGraph: vi.fn(),
  getTopMerchants: vi.fn(),
  getCategorySpending: vi.fn(),
  detectSubscriptionCandidates: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('../../src/ai/financialGraph', () => ({
  buildFinancialGraph: insightMocks.buildFinancialGraph,
  getTopMerchants: insightMocks.getTopMerchants,
  getCategorySpending: insightMocks.getCategorySpending,
  detectSubscriptionCandidates: insightMocks.detectSubscriptionCandidates,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: insightMocks.logWarn,
}));

import { generateFinancialInsights } from '../../src/ai/insightGenerator';
import { Category, TransactionType, type Transaction } from '../../types';
import { type Account } from '../../models/Account';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: overrides.id || 'acc-1',
    user_id: overrides.user_id || 'user-1',
    name: overrides.name || 'Conta',
    type: overrides.type || 'cash',
    balance: overrides.balance ?? 0,
    currency: overrides.currency || 'BRL',
    created_at: overrides.created_at || '2026-04-01T00:00:00.000Z',
  } as Account;
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 'tx-1',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? TransactionType.DESPESA,
    category: overrides.category ?? Category.PESSOAL,
    description: overrides.description ?? 'Despesa',
    date: overrides.date ?? '2026-05-10',
    source: overrides.source ?? 'manual',
    generated: overrides.generated ?? false,
    confidence_score: overrides.confidence_score ?? 1,
    account_id: overrides.account_id ?? 'acc-1',
    merchant: overrides.merchant,
    recurring: overrides.recurring,
  };
}

describe('insightGenerator observability', () => {
  it('logs contextual data when graph insights fail', () => {
    insightMocks.buildFinancialGraph.mockImplementation(() => {
      throw new Error('graph offline');
    });
    insightMocks.getTopMerchants.mockReturnValue([]);
    insightMocks.getCategorySpending.mockReturnValue([]);
    insightMocks.detectSubscriptionCandidates.mockReturnValue([]);

    const insights = generateFinancialInsights(
      [
        makeTransaction({ id: 'tx-1', amount: 120, type: TransactionType.DESPESA, category: Category.PESSOAL }),
        makeTransaction({ id: 'tx-2', amount: 180, type: TransactionType.DESPESA, category: Category.NEGOCIO }),
        makeTransaction({ id: 'tx-3', amount: 800, type: TransactionType.RECEITA, category: Category.NEGOCIO }),
      ],
      'user-1',
      [makeAccount({ balance: 500 })],
    );

    expect(insights.length).toBeGreaterThan(0);
    expect(insightMocks.logWarn).toHaveBeenCalledWith(
      '[InsightGenerator] Graph insights unavailable; continuing without graph enrichment',
      expect.objectContaining({
        userId: 'user-1',
        error: expect.any(Error),
      }),
    );
  });
});
