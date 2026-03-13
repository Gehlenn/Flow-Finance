import { describe, expect, it } from 'vitest';
import { Category, TransactionType, type Transaction } from '../../types';
import {
  analyzeFinancialProfile,
  analyzeIncomePatterns,
  analyzeMerchantCategories,
  analyzeRecurringExpenses,
  analyzeSpendingPatterns,
  analyzeTimePatterns,
  analyzeUserBehavior,
} from '../../src/ai/memory/memoryAnalyzer';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    amount: overrides.amount ?? 100,
    type: overrides.type ?? TransactionType.DESPESA,
    category: overrides.category ?? Category.PESSOAL,
    description: overrides.description ?? 'Transacao teste',
    date: overrides.date ?? '2026-03-01T10:00:00.000Z',
    merchant: overrides.merchant,
    generated: overrides.generated,
    account_id: overrides.account_id,
    source: overrides.source,
    confidence_score: overrides.confidence_score,
  };
}

describe('memoryAnalyzer', () => {
  it('detecta padroes de gasto de fim de semana e de inicio do mes', () => {
    const transactions = [
      tx({ id: 'w1', amount: 120, date: '2026-03-01T09:00:00.000Z' }),
      tx({ id: 'w2', amount: 80, date: '2026-03-07T09:00:00.000Z' }),
      tx({ id: 'w3', amount: 100, date: '2026-03-08T09:00:00.000Z' }),
      tx({ id: 'm1', amount: 70, date: '2026-03-02T09:00:00.000Z' }),
      tx({ id: 'm2', amount: 55, date: '2026-03-03T09:00:00.000Z' }),
      tx({ id: 'm3', amount: 60, date: '2026-03-04T09:00:00.000Z' }),
      tx({ id: 'm4', amount: 58, date: '2026-03-05T09:00:00.000Z' }),
      tx({ id: 'm5', amount: 62, date: '2026-03-06T09:00:00.000Z' }),
      tx({ id: 'end1', amount: 45, date: '2026-03-21T09:00:00.000Z' }),
    ];

    const patterns = analyzeSpendingPatterns(transactions);

    expect(patterns.has('weekend')).toBe(true);
    expect(patterns.has('weekday')).toBe(true);
    expect(patterns.has('monthly_beginning')).toBe(true);
    expect(patterns.get('weekend')?.categories).toContain(Category.PESSOAL);
  });

  it('agrupa merchants, recorrencia e comportamento do usuario', () => {
    const transactions = [
      tx({ id: 'n1', merchant: 'Netflix', description: 'Netflix', amount: 49.9, date: '2026-01-10T20:00:00.000Z' }),
      tx({ id: 'n2', merchant: 'Netflix', description: 'Netflix', amount: 49.9, date: '2026-02-10T20:00:00.000Z' }),
      tx({ id: 'n3', merchant: 'Netflix', description: 'Netflix', amount: 49.9, date: '2026-03-10T20:00:00.000Z' }),
      tx({ id: 'u1', merchant: 'Uber', description: 'Uber', amount: 18, date: '2026-03-07T23:30:00.000Z' }),
      tx({ id: 'u2', merchant: 'Uber', description: 'Uber', amount: 21, date: '2026-03-08T23:10:00.000Z' }),
      tx({ id: 'u3', merchant: 'Uber', description: 'Uber', amount: 19, date: '2026-03-14T22:50:00.000Z' }),
      tx({ id: 'u4', merchant: 'Uber', description: 'Uber', amount: 17, date: '2026-03-15T23:45:00.000Z' }),
      tx({ id: 'income-1', type: TransactionType.RECEITA, category: Category.CONSULTORIO, description: 'Salario', merchant: 'Empresa', amount: 5000, date: '2026-03-05T08:00:00.000Z' }),
      tx({ id: 'income-2', type: TransactionType.RECEITA, category: Category.CONSULTORIO, description: 'Bonus', merchant: 'Empresa', amount: 2000, date: '2026-03-20T08:00:00.000Z' }),
    ];

    const merchants = analyzeMerchantCategories(transactions);
    const recurring = analyzeRecurringExpenses(transactions);
    const behaviors = analyzeUserBehavior(transactions);

    expect(merchants.get('netflix')?.avgAmount).toBeCloseTo(49.9);
    expect(recurring.get('netflix')?.isSubscription).toBe(true);
    expect(recurring.get('netflix')?.frequency).toBe('monthly');
    expect(behaviors.has('impulsive_spending')).toBe(true);
    expect(behaviors.has('weekend_spender')).toBe(true);
  });

  it('classifica perfil financeiro, estabilidade de renda e padrao temporal', () => {
    const transactions = [
      tx({ id: 'salary-1', type: TransactionType.RECEITA, category: Category.CONSULTORIO, merchant: 'Empresa', description: 'Salario', amount: 6000, date: '2026-01-05T08:00:00.000Z' }),
      tx({ id: 'salary-2', type: TransactionType.RECEITA, category: Category.CONSULTORIO, merchant: 'Empresa', description: 'Salario', amount: 6000, date: '2026-02-05T08:00:00.000Z' }),
      tx({ id: 'salary-3', type: TransactionType.RECEITA, category: Category.CONSULTORIO, merchant: 'Empresa', description: 'Salario', amount: 6000, date: '2026-03-05T08:00:00.000Z' }),
      tx({ id: 'e1', amount: 400, date: '2026-03-03T09:00:00.000Z' }),
      tx({ id: 'e2', amount: 350, date: '2026-03-10T10:00:00.000Z' }),
      tx({ id: 'e3', amount: 300, date: '2026-03-17T11:00:00.000Z' }),
      tx({ id: 'e4', amount: 250, date: '2026-03-24T10:30:00.000Z' }),
    ];

    const profile = analyzeFinancialProfile(transactions);
    const incomePatterns = analyzeIncomePatterns(transactions);
    const timePatterns = analyzeTimePatterns(transactions);

    expect(profile?.profile).toBe('conservative');
    expect(profile?.riskTolerance).toBe(30);
    expect(incomePatterns.get('empresa')?.type).toBe('salary');
    expect(incomePatterns.get('empresa')?.isStable).toBe(true);
    expect(timePatterns.get('day_2')?.timeframe).toBe('morning');
    expect(timePatterns.get('day_2')?.frequency).toBe(4);
  });

  it('retorna nulo quando nao ha dados suficientes para perfil financeiro', () => {
    const profile = analyzeFinancialProfile([
      tx({ id: 'only-expense', amount: 120 }),
    ]);

    expect(profile).toBeNull();
  });
});