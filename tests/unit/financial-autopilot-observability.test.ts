import { describe, expect, it, vi } from 'vitest';

const autopilotMocks = vi.hoisted(() => ({
  buildFinancialGraph: vi.fn(),
  graphToAIContext: vi.fn(),
  detectSubscriptionCandidates: vi.fn(),
  getTopMerchants: vi.fn(),
  getCategorySpending: vi.fn(),
  getSpendingPatterns: vi.fn(),
  getRecurringExpenses: vi.fn(),
  getMerchantCategories: vi.fn(),
  hasBehavior: vi.fn(),
  getUserBehaviors: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('../../src/ai/financialGraph', () => ({
  buildFinancialGraph: autopilotMocks.buildFinancialGraph,
  graphToAIContext: autopilotMocks.graphToAIContext,
  detectSubscriptionCandidates: autopilotMocks.detectSubscriptionCandidates,
  getTopMerchants: autopilotMocks.getTopMerchants,
  getCategorySpending: autopilotMocks.getCategorySpending,
}));

vi.mock('../../src/ai/memory', () => ({
  getSpendingPatterns: autopilotMocks.getSpendingPatterns,
  getRecurringExpenses: autopilotMocks.getRecurringExpenses,
  getMerchantCategories: autopilotMocks.getMerchantCategories,
  hasBehavior: autopilotMocks.hasBehavior,
  getUserBehaviors: autopilotMocks.getUserBehaviors,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: autopilotMocks.logWarn,
}));

import { runFinancialAutopilot } from '../../src/ai/financialAutopilot';
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
    description: overrides.description ?? 'Delivery',
    date: overrides.date ?? '2026-04-10',
    source: overrides.source ?? 'manual',
    generated: overrides.generated ?? false,
    confidence_score: overrides.confidence_score ?? 1,
    account_id: overrides.account_id ?? 'acc-1',
    merchant: overrides.merchant,
    recurring: overrides.recurring,
  };
}

describe('financialAutopilot observability', () => {
  it('logs contextual data when graph enrichment fails', () => {
    autopilotMocks.buildFinancialGraph.mockImplementation(() => {
      throw new Error('graph offline');
    });
    autopilotMocks.graphToAIContext.mockReturnValue('');
    autopilotMocks.getSpendingPatterns.mockReturnValue([]);
    autopilotMocks.getRecurringExpenses.mockReturnValue([]);
    autopilotMocks.getMerchantCategories.mockReturnValue([]);
    autopilotMocks.hasBehavior.mockReturnValue(false);
    autopilotMocks.getUserBehaviors.mockReturnValue([]);
    autopilotMocks.detectSubscriptionCandidates.mockReturnValue([]);
    autopilotMocks.getTopMerchants.mockReturnValue([]);
    autopilotMocks.getCategorySpending.mockReturnValue([]);

    const actions = runFinancialAutopilot(
      [makeAccount({ balance: 250 })],
      [makeTransaction()],
      {
        balance_7_days: 0,
        balance_30_days: 0,
        current_balance: 0,
        projected_expenses: 0,
        projected_income: 0,
      },
      [],
    );

    expect(actions.length).toBeGreaterThan(0);
    expect(autopilotMocks.logWarn).toHaveBeenCalledWith(
      '[Autopilot] Graph context unavailable; continuing without graph enrichment',
      expect.objectContaining({
        userId: 'local',
        error: expect.any(Error),
      }),
    );
  });

  it('logs contextual data when memory loading fails', () => {
    autopilotMocks.buildFinancialGraph.mockReturnValue({
      nodes: [],
      edges: [],
    });
    autopilotMocks.graphToAIContext.mockReturnValue('');
    autopilotMocks.getSpendingPatterns.mockImplementation(() => {
      throw new Error('memory offline');
    });
    autopilotMocks.getRecurringExpenses.mockReturnValue([]);
    autopilotMocks.getMerchantCategories.mockReturnValue([]);
    autopilotMocks.hasBehavior.mockReturnValue(false);
    autopilotMocks.getUserBehaviors.mockReturnValue([]);
    autopilotMocks.detectSubscriptionCandidates.mockReturnValue([]);
    autopilotMocks.getTopMerchants.mockReturnValue([]);
    autopilotMocks.getCategorySpending.mockReturnValue([]);

    const actions = runFinancialAutopilot(
      [makeAccount({ balance: 250 })],
      [makeTransaction()],
      {
        balance_7_days: 0,
        balance_30_days: 0,
        current_balance: 0,
        projected_expenses: 0,
        projected_income: 0,
      },
      [],
    );

    expect(actions.length).toBeGreaterThan(0);
    expect(autopilotMocks.logWarn).toHaveBeenCalledWith(
      '[Autopilot] Error loading AI memories; continuing without behavioral context',
      expect.objectContaining({
        userId: 'local',
        error: expect.any(Error),
      }),
    );
  });
});
