import { describe, expect, it } from 'vitest';
import { detectFinancialLeaks } from '../../src/ai/leakDetector';
import { Category, TransactionType, type Transaction } from '../../types';

function tx(date: string): Transaction {
  return {
    id: `${date}-${Math.random().toString(36).slice(2)}`,
    amount: 19.9,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Assinatura',
    merchant: 'Netflix',
    date,
  };
}

describe('detectFinancialLeaks date safety', () => {
  it('detecta vazamentos recorrentes com datas date-only', () => {
    const leaks = detectFinancialLeaks([
      tx('2026-01-10'),
      tx('2026-02-10'),
      tx('2026-03-10'),
      {
        id: 'income',
        amount: 5000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: '2026-03-05',
      },
    ] as never[]);

    expect(leaks[0]?.merchant).toBe('netflix');
    expect(leaks[0]?.monthly_cost).toBeGreaterThan(0);
  });
});
