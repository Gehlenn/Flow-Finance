import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectSalary, formatNextPayday } from '../../src/ai/salaryDetector';
import { Category, TransactionType, type Transaction } from '../../types';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 'tx-1',
    amount: overrides.amount ?? 5000,
    type: overrides.type ?? TransactionType.RECEITA,
    category: overrides.category ?? Category.NEGOCIO,
    description: overrides.description ?? 'Salario empresa',
    date: overrides.date ?? '2026-04-10',
    source: overrides.source ?? 'manual',
    generated: overrides.generated ?? false,
    confidence_score: overrides.confidence_score ?? 1,
    account_id: overrides.account_id ?? 'acc-1',
    merchant: overrides.merchant,
  };
}

describe('salaryDetector', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trata datas-only como locais e formata payday sem drift', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));

    const result = detectSalary([
      makeTransaction({ id: 'pay-1', description: 'Salario empresa', merchant: 'Empresa', date: '2026-03-10' }),
      makeTransaction({ id: 'pay-2', description: 'Salario empresa', merchant: 'Empresa', date: '2026-04-10' }),
      makeTransaction({ id: 'noise', amount: 75, description: 'Pix recebido', merchant: 'Outro', date: 'invalid-date' }),
    ]);

    expect(result.detected).toBe(true);
    expect(result.primary_income?.day_of_month).toBe(10);
    expect(result.primary_income?.next_expected).toBe('2026-05-10');
    expect(formatNextPayday('2026-04-10')).toBe('Hoje');
  });
});
