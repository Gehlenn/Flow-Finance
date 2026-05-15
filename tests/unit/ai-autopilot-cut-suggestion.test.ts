import { describe, it, expect, vi, afterEach } from 'vitest';
import { runFinancialAutopilot } from '../../src/ai/financialAutopilot';
import { TransactionType } from '../../types';
import { Account } from '../../models/Account';

function makeTx(partial) {
  return {
    id: Math.random().toString(36).slice(2),
    amount: partial.amount,
    type: partial.type,
    category: partial.category,
    description: partial.description || '',
    date: partial.date,
    merchant: partial.merchant || '',
    recurring: partial.recurring || false,
    generated: false,
  };
}

describe('runFinancialAutopilot - Sugestão de corte automático', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gera sugestão de corte quando gasto do mês ultrapassa limite calculado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));

    const accounts: Account[] = [
      { id: '1', user_id: 'u', name: 'Conta', type: 'cash', balance: 1000, currency: 'BRL', created_at: '2026-01-01T00:00:00.000Z' },
    ];

    const txs = [
      makeTx({ amount: 200, type: TransactionType.RECEITA, category: 'Servicos', date: '2026-04-02' }),
      makeTx({ amount: 100, type: TransactionType.DESPESA, category: 'CategoriaTesteCorte', date: '2026-01-05' }),
      makeTx({ amount: 120, type: TransactionType.DESPESA, category: 'CategoriaTesteCorte', date: '2026-02-05' }),
      makeTx({ amount: 110, type: TransactionType.DESPESA, category: 'CategoriaTesteCorte', date: '2026-03-05' }),
      makeTx({ amount: 200, type: TransactionType.DESPESA, category: 'CategoriaTesteCorte', date: '2026-04-05' }),
    ];

    const prediction = { balance_30_days: 100, balance_7_days: 100, current_balance: 1000, projected_expenses: 0, projected_income: 0 };
    const insights = [];

    const actions = runFinancialAutopilot(accounts, txs, prediction, insights);
    const cutSuggestion = actions.find((a) => a.type === 'optimization' && a.category === 'CategoriaTesteCorte');

    expect(cutSuggestion).toBeDefined();
    expect(cutSuggestion?.title).toContain('Sugestão de corte');
    expect(cutSuggestion?.value ?? 0).toBeGreaterThan(0);
  });
});
