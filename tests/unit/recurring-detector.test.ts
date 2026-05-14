import { describe, expect, it } from 'vitest';

import { recurringDetector } from '../../src/engines/finance/cashflowPrediction/recurringDetector';
import { Category, TransactionType, type Transaction } from '../../types';

function expense(id: string, amount: number, merchant: string, date: string): Transaction {
  return {
    id,
    amount,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: merchant,
    merchant,
    date,
  };
}

describe('recurringDetector', () => {
  it('trata datas-only como datas validas para recorrencia', () => {
    const result = recurringDetector.detect([
      expense('1', 59.9, 'Netflix', '2026-01-04'),
      expense('2', 59.9, 'Netflix', '2026-02-04'),
      expense('3', 59.9, 'Netflix', '2026-03-04'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('Netflix');
    expect(result[0].nextExpectedDate).toMatch(/^2026-\d{2}-\d{2}$/);
  });

  it('ignora transacoes com data quebrada ao calcular recorrencia', () => {
    const result = recurringDetector.detect([
      expense('1', 59.9, 'Netflix', '2026-01-04'),
      expense('2', 59.9, 'Netflix', 'invalid-date'),
      expense('3', 59.9, 'Netflix', '2026-03-04'),
      expense('4', 59.9, 'Netflix', '2026-04-04'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].occurrences).toBeGreaterThanOrEqual(3);
  });
});
