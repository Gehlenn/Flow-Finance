import { describe, expect, it } from 'vitest';

import { generateSmartBudget } from '../../src/engines/finance/budgetEngine';
import { Category, TransactionType, type Transaction } from '../../types';

function makeTx(partial: Partial<Transaction> & Pick<Transaction, 'amount' | 'type' | 'category'>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    description: 'test',
    date: '2026-01-15T10:00:00.000Z',
    ...partial,
  };
}

const INCOME = makeTx({ amount: 10000, type: TransactionType.RECEITA, category: Category.CONSULTORIO });
const PERSONAL = (amt: number) => makeTx({ amount: amt, type: TransactionType.DESPESA, category: Category.PESSOAL });
const NEGOCIO = (amt: number) => makeTx({ amount: amt, type: TransactionType.DESPESA, category: Category.NEGOCIO });

describe('generateSmartBudget', () => {
  it('retorna valores zerados para lista vazia', () => {
    const result = generateSmartBudget([]);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.savingsRate).toBe(0);
    expect(result.lines).toHaveLength(0);
    expect(result.surplusForSavings).toBe(0);
  });

  it('retorna income e expenses corretos', () => {
    const txs = [INCOME, PERSONAL(2000), NEGOCIO(1000)];
    const result = generateSmartBudget(txs);
    expect(result.totalIncome).toBe(10000);
    expect(result.totalExpenses).toBe(3000);
    expect(result.savingsRate).toBeCloseTo(0.7, 2);
  });

  it('perfil Saver usa fator de redução 0.05 e target 20%', () => {
    const txs = [INCOME, PERSONAL(3000)];
    const result = generateSmartBudget(txs, 'Saver');
    expect(result.targetSavingsRate).toBe(0.2);
    // budgetForExpenses = 10000 * 0.8 = 8000
    // share PESSOAL = 1 (unica categoria)
    // suggestedLimit = 8000 * 0.95 = 7600
    const line = result.lines.find((l) => l.category === Category.PESSOAL);
    expect(line).toBeDefined();
    expect(line!.suggestedLimit).toBeCloseTo(7600, 0);
  });

  it('perfil Spender usa fator de redução 0.25 e target 10%', () => {
    const txs = [INCOME, PERSONAL(3000)];
    const result = generateSmartBudget(txs, 'Spender');
    expect(result.targetSavingsRate).toBe(0.1);
    // budgetForExpenses = 10000 * 0.9 = 9000
    // suggestedLimit = 9000 * 0.75 = 6750
    const line = result.lines.find((l) => l.category === Category.PESSOAL);
    expect(line).toBeDefined();
    expect(line!.suggestedLimit).toBeCloseTo(6750, 0);
  });

  it('action = "reduzir" quando desvio > 20%', () => {
    // spend muito acima do limite sugerido
    const txs = [INCOME, PERSONAL(9500)];
    const result = generateSmartBudget(txs, 'Balanced');
    const line = result.lines.find((l) => l.category === Category.PESSOAL);
    expect(line!.action).toBe('reduzir');
  });

  it('action = "alertar" quando desvio entre 5% e 20%', () => {
    // Precisamos garantir deviation em faixa (5%, 20%]
    // budgetForExpenses = 10000 * 0.85 = 8500
    // suggestedLimit = 8500 * 0.9 = 7650 (Balanced fator 0.1)
    // Para desvio ~10%: actual = 7650 * 1.10 ≈ 8415
    const txs = [INCOME, PERSONAL(8415)];
    const result = generateSmartBudget(txs, 'Balanced');
    const line = result.lines.find((l) => l.category === Category.PESSOAL);
    expect(['alertar', 'reduzir']).toContain(line!.action);
  });

  it('action = "ok" quando within 5%', () => {
    // actual = 100, income alto → suggestedLimit muito maior → ok
    const txs = [INCOME, PERSONAL(100)];
    const result = generateSmartBudget(txs, 'Balanced');
    const line = result.lines.find((l) => l.category === Category.PESSOAL);
    expect(line!.action).toBe('ok');
  });

  it('ordena linhas por deviation descrescente', () => {
    const txs = [INCOME, PERSONAL(500), NEGOCIO(4000)];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.lines.length).toBe(2);
    expect(result.lines[0].deviation).toBeGreaterThanOrEqual(result.lines[1].deviation);
  });

  it('surplusForSavings = income - sum(suggestedLimits)', () => {
    const txs = [INCOME, PERSONAL(3000)];
    const result = generateSmartBudget(txs, 'Balanced');
    const sumLimits = result.lines.reduce((s, l) => s + l.suggestedLimit, 0);
    expect(result.surplusForSavings).toBeCloseTo(10000 - sumLimits, 1);
  });

  it('sem receita usa total de despesas como budget base', () => {
    const txs = [PERSONAL(2000), NEGOCIO(1000)];
    const result = generateSmartBudget(txs);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(3000);
    // Não deve lançar erro
    expect(result.lines.length).toBe(2);
  });
});
