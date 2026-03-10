import { describe, expect, it } from 'vitest';
import { classifyFinancialProfile } from '../../src/engines/ai/financialProfileClassifier';
import { Category, TransactionType, type Transaction } from '../../types';

function tx(id: string, amount: number, type: TransactionType): Transaction {
  return {
    id,
    amount,
    type,
    category: Category.PESSOAL,
    description: id,
    date: new Date().toISOString(),
  };
}

describe('classifyFinancialProfile', () => {
  it('classifies Saver when savings rate is high', () => {
    const result = classifyFinancialProfile([
      tx('i1', 5000, TransactionType.RECEITA),
      tx('e1', 2000, TransactionType.DESPESA),
    ]);

    expect(result.profile).toBe('Saver');
  });

  it('classifies Spender when expenses exceed income', () => {
    const result = classifyFinancialProfile([
      tx('i1', 2000, TransactionType.RECEITA),
      tx('e1', 2500, TransactionType.DESPESA),
    ]);

    expect(result.profile).toBe('Spender');
  });
});
