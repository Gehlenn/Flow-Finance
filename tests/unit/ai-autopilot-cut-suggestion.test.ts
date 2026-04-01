import { describe, it, expect } from 'vitest';
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
    date: partial.date || new Date().toISOString(),
    merchant: partial.merchant || '',
    recurring: partial.recurring || false,
    generated: false,
  };
}

describe('runFinancialAutopilot - Sugestão de corte automático', () => {
  it('gera sugestão de corte quando gasto do mês ultrapassa média histórica da categoria', () => {
    const accounts: Account[] = [
      { id: '1', user_id: 'u', name: 'Conta', type: 'cash', balance: 1000, currency: 'BRL', created_at: new Date().toISOString() }
    ];
    const now = new Date();
    const txs = [
      // Histórico: 3 meses atrás
      makeTx({ amount: 100, type: TransactionType.DESPESA, category: 'Alimentação', date: new Date(now.getFullYear(), now.getMonth() - 3, 5).toISOString() }),
      makeTx({ amount: 120, type: TransactionType.DESPESA, category: 'Alimentação', date: new Date(now.getFullYear(), now.getMonth() - 2, 5).toISOString() }),
      makeTx({ amount: 110, type: TransactionType.DESPESA, category: 'Alimentação', date: new Date(now.getFullYear(), now.getMonth() - 1, 5).toISOString() }),
      // Mês atual: ultrapassa média
      makeTx({ amount: 200, type: TransactionType.DESPESA, category: 'Alimentação', date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString() }),
    ];
    const prediction = { balance_30_days: 100, balance_7_days: 100, current_balance: 1000, projected_expenses: 0, projected_income: 0 };
    const insights = [];
    const actions = runFinancialAutopilot(accounts, txs, prediction, insights);
    const cutSuggestion = actions.find(a => a.title && a.title.includes('Sugestão de corte em Alimentação'));
    expect(cutSuggestion).toBeDefined();
    expect(cutSuggestion.type).toBe('optimization');
    expect(cutSuggestion.value).toBeGreaterThan(0);
  });
});
