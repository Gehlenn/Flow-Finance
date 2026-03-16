import { describe, expect, it } from 'vitest';
import { classifyFinancialProfile } from '../../src/engines/ai/financialProfileClassifier';
import { Category, TransactionType, type Transaction } from '../../types';

function tx(
  id: string,
  amount: number,
  type: TransactionType,
  category: Category = Category.PESSOAL,
): Transaction {
  return { id, amount, type, category, description: id, date: new Date().toISOString() };
}

describe('classifyFinancialProfile', () => {
  // --- Profiles ---
  it('classifies Saver when savings rate is high', () => {
    const result = classifyFinancialProfile([
      tx('i1', 5000, TransactionType.RECEITA),
      tx('e1', 2000, TransactionType.DESPESA),
    ]);
    expect(result.profile).toBe('Saver');
    expect(result.savingsRate).toBeCloseTo(0.6, 2);
  });

  it('classifies Spender when expenses exceed income', () => {
    const result = classifyFinancialProfile([
      tx('i1', 2000, TransactionType.RECEITA),
      tx('e1', 2500, TransactionType.DESPESA),
    ]);
    expect(result.profile).toBe('Spender');
    expect(result.savingsRate).toBeLessThan(0);
  });

  it('classifies Risk Taker when savings rate is between 0 and 5%', () => {
    const result = classifyFinancialProfile([
      tx('i1', 1000, TransactionType.RECEITA),
      tx('e1', 960, TransactionType.DESPESA),
    ]);
    expect(result.profile).toBe('Risk Taker');
    expect(result.savingsRate).toBeGreaterThanOrEqual(0);
    expect(result.savingsRate).toBeLessThanOrEqual(0.05);
  });

  it('classifies Balanced when savings rate is between 5% and 30%', () => {
    const result = classifyFinancialProfile([
      tx('i1', 3000, TransactionType.RECEITA),
      tx('e1', 2400, TransactionType.DESPESA),
    ]);
    expect(result.profile).toBe('Balanced');
  });

  it('classifies Risk Taker when income is zero', () => {
    const result = classifyFinancialProfile([
      tx('e1', 500, TransactionType.DESPESA),
    ]);
    expect(result.profile).toBe('Risk Taker');
    expect(result.savingsRate).toBe(-1);
  });

  it('classifies Undefined when transaction list is empty', () => {
    const result = classifyFinancialProfile([]);
    expect(result.profile).toBe('Undefined');
    expect(result.confidence).toBe(0);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  // --- Confidence ---
  it('confidence increases with more transactions', () => {
    const few = classifyFinancialProfile([
      tx('i1', 5000, TransactionType.RECEITA),
      tx('e1', 1000, TransactionType.DESPESA),
    ]);
    const many = classifyFinancialProfile([
      tx('i1', 5000, TransactionType.RECEITA),
      tx('e1', 500, TransactionType.DESPESA),
      tx('e2', 300, TransactionType.DESPESA),
      tx('e3', 200, TransactionType.DESPESA),
      tx('e4', 100, TransactionType.DESPESA),
      tx('e5', 50, TransactionType.DESPESA),
    ]);
    expect(many.confidence).toBeGreaterThanOrEqual(few.confidence);
  });

  // --- Category Breakdown ---
  it('retorna topCategories ordenadas por total decrescente', () => {
    const result = classifyFinancialProfile([
      tx('i1', 5000, TransactionType.RECEITA),
      tx('e1', 1000, TransactionType.DESPESA, Category.NEGOCIO),
      tx('e2', 2000, TransactionType.DESPESA, Category.PESSOAL),
      tx('e3', 500,  TransactionType.DESPESA, Category.INVESTIMENTO),
    ]);
    expect(result.topCategories[0].category).toBe(Category.PESSOAL);
    expect(result.topCategories[0].total).toBe(2000);
    expect(result.topCategories[0].share).toBeCloseTo(2000 / 3500, 3);
  });

  it('retorna topCategories vazio quando nao ha despesas', () => {
    const result = classifyFinancialProfile([
      tx('i1', 5000, TransactionType.RECEITA),
    ]);
    expect(result.topCategories).toHaveLength(0);
  });

  // --- Insights ---
  it('retorna insights nao vazios para cada perfil', () => {
    const profiles = [
      [tx('i1', 5000, TransactionType.RECEITA), tx('e1', 2000, TransactionType.DESPESA)], // Saver
      [tx('i1', 2000, TransactionType.RECEITA), tx('e1', 2500, TransactionType.DESPESA)], // Spender
      [tx('e1', 500, TransactionType.DESPESA)],                                            // Risk (no income)
      [tx('i1', 1000, TransactionType.RECEITA), tx('e1', 850, TransactionType.DESPESA)], // Balanced
    ];
    for (const profile of profiles) {
      const result = classifyFinancialProfile(profile);
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.insights.every((s) => s.length > 0)).toBe(true);
    }
  });

  // --- Income/Expenses ---
  it('expoe income e expenses corretos no resultado', () => {
    const result = classifyFinancialProfile([
      tx('i1', 4000, TransactionType.RECEITA),
      tx('e1', 1500, TransactionType.DESPESA),
    ]);
    expect(result.income).toBe(4000);
    expect(result.expenses).toBe(1500);
  });
});
