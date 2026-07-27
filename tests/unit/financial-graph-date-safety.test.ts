import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildFinancialGraph, getCategorySpending, getTopMerchants } from '../../src/ai/financialGraph';
import { Category, TransactionType, type Transaction } from '../../types';
import { type Account } from '../../models/Account';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 'tx-1',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? TransactionType.DESPESA,
    category: overrides.category ?? Category.PESSOAL,
    description: overrides.description ?? 'Despesa',
    date: overrides.date ?? '2026-04-10',
    source: overrides.source ?? 'manual',
    generated: overrides.generated ?? false,
    confidence_score: overrides.confidence_score ?? 1,
    account_id: overrides.account_id ?? 'acc-1',
    merchant: overrides.merchant,
  };
}

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

describe('financialGraph', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa datas-only locais para trend e last_seen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

    const graph = buildFinancialGraph(
      'user-1',
      [makeAccount()],
      [
        makeTransaction({ id: 'prev', amount: 100, description: 'Mercado', merchant: 'Mercado', date: '2026-03-20', category: Category.PESSOAL }),
        makeTransaction({ id: 'curr', amount: 200, description: 'Mercado', merchant: 'Mercado', date: '2026-04-20', category: Category.PESSOAL }),
        makeTransaction({ id: 'invalid', amount: 50, description: 'Lixo', merchant: 'Lixo', date: 'invalid-date', category: Category.PESSOAL }),
      ],
    );

    const spending = getCategorySpending(graph);
    const personal = spending.find(item => item.name === Category.PESSOAL);
    expect(personal?.trend).toBe('up');

    const topMerchants = getTopMerchants(graph);
    expect(topMerchants[0]?.last_seen).toBe('2026-04-20');
  });
});
