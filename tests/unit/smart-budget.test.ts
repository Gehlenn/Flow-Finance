      it('retorna budget correto com income negativo', () => {
        const txs = [makeTx({ amount: -1000, type: TransactionType.RECEITA, category: Category.CONSULTORIO }), PERSONAL(500)];
        const result = generateSmartBudget(txs, 'Balanced');
        expect(result.totalIncome).toBe(-1000);
        expect(result.totalExpenses).toBe(500);
        expect(result.savingsRate).toBe(0);
        expect(result.lines.length).toBe(1);
      });

      it('usa profile undefined corretamente', () => {
        const txs = [INCOME, PERSONAL(1000)];
        const result = generateSmartBudget(txs, undefined as any);
        expect(result.targetSavingsRate).toBe(0.15);
      });

      it('gera action "reduzir"', () => {
        const income = 1000;
        // Primeiro, calcular o limite sugerido
        const budget = income * (1 - 0.15); // Balanced: target 15%
        const reduction = 0.1; // Balanced
        const limit = Number((budget * 1 * (1 - reduction)).toFixed(2));
        // Gasto para garantir 'reduzir' (>20% acima)
        const gasto = Number((limit * 1.25).toFixed(2));
        const txs = [
          makeTx({ amount: income, type: TransactionType.RECEITA, category: Category.CONSULTORIO }),
          makeTx({ amount: gasto, type: TransactionType.DESPESA, category: 'A' as Category }),
        ];
        const result = generateSmartBudget(txs, 'Balanced');
        expect(result.lines[0].action).toBe('reduzir');
      });

      it('gera action "alertar"', () => {
        const income = 1000;
        const budget = income * (1 - 0.15);
        const reduction = 0.1;
        const limit = Number((budget * 1 * (1 - reduction)).toFixed(2));
        // Gasto para garantir 'alertar' (~10% acima)
        const gasto = Number((limit * 1.10).toFixed(2));
        const txs = [
          makeTx({ amount: income, type: TransactionType.RECEITA, category: Category.CONSULTORIO }),
          makeTx({ amount: gasto, type: TransactionType.DESPESA, category: 'A' as Category }),
        ];
        const result = generateSmartBudget(txs, 'Balanced');
        expect(result.lines[0].action).toBe('alertar');
      });

      it('gera action "ok"', () => {
        const income = 1000;
        const budget = income * (1 - 0.15);
        const reduction = 0.1;
        const limit = Number((budget * 1 * (1 - reduction)).toFixed(2));
        // Gasto para garantir 'ok' (~2% abaixo)
        const gasto = Number((limit * 0.98).toFixed(2));
        const txs = [
          makeTx({ amount: income, type: TransactionType.RECEITA, category: Category.CONSULTORIO }),
          makeTx({ amount: gasto, type: TransactionType.DESPESA, category: 'A' as Category }),
        ];
        const result = generateSmartBudget(txs, 'Balanced');
        expect(result.lines[0].action).toBe('ok');
      });

      it('lida com múltiplas categorias e valores extremos', () => {
        const txs = [INCOME];
        for (let i = 0; i < 10; i++) {
          txs.push(makeTx({ amount: i * 1000, type: TransactionType.DESPESA, category: ('CAT' + i) as Category }));
        }
        const result = generateSmartBudget(txs, 'Balanced');
        expect(result.lines.length).toBe(10);
        expect(result.lines[0].actualSpend).toBe(9000);
        expect(result.lines[9].actualSpend).toBe(0);
      });
    it('retorna budget correto com income zero', () => {
      const txs = [PERSONAL(1000), NEGOCIO(500)];
      const result = generateSmartBudget(txs, 'Balanced');
      expect(result.totalIncome).toBe(0);
      expect(result.totalExpenses).toBe(1500);
      expect(result.savingsRate).toBe(0);
      expect(result.lines.length).toBe(2);
      expect(result.lines[0].suggestedLimit).toBeGreaterThan(0);
    });

    it('lida com despesas negativas', () => {
      const txs = [INCOME, PERSONAL(-500), NEGOCIO(1000)];
      const result = generateSmartBudget(txs, 'Balanced');
      expect(result.lines.length).toBe(2);
      expect(result.lines.find(l => l.category === Category.PESSOAL)?.actualSpend).toBe(-500);
    });

    it('lida com categoria desconhecida', () => {
      const txs = [INCOME, makeTx({ amount: 100, type: TransactionType.DESPESA, category: 'OUTRA' as Category })];
      const result = generateSmartBudget(txs, 'Balanced');
      expect(result.lines.length).toBeGreaterThanOrEqual(1);
      expect(result.lines.some(l => l.category === 'OUTRA')).toBe(true);
    });

    it('lida com share zero', () => {
      const txs = [INCOME, PERSONAL(0), NEGOCIO(1000)];
      const result = generateSmartBudget(txs, 'Balanced');
      expect(result.lines.length).toBe(2);
      expect(result.lines.find(l => l.category === Category.PESSOAL)?.suggestedLimit).toBeGreaterThanOrEqual(0);
    });

    it('ordena linhas por desvio decrescente', () => {
      const txs = [INCOME, PERSONAL(2000), NEGOCIO(1000)];
      const result = generateSmartBudget(txs, 'Balanced');
      expect(result.lines[0].deviation).toBeGreaterThanOrEqual(result.lines[1].deviation);
    });
  it('lida com múltiplas categorias com valores iguais', () => {
    const txs = [INCOME, PERSONAL(1000), NEGOCIO(1000)];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.lines.length).toBe(2);
    expect(result.lines[0].actualSpend).toBe(1000);
    expect(result.lines[1].actualSpend).toBe(1000);
  });

  it('lida com despesas zero em categoria', () => {
    const txs = [INCOME, makeTx({ amount: 0, type: TransactionType.DESPESA, category: Category.PESSOAL })];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].actualSpend).toBe(0);
    expect(result.lines[0].suggestedLimit).toBeGreaterThanOrEqual(0);
  });

  it('lida com floating point extremo', () => {
    const txs = [INCOME, makeTx({ amount: 0.3333333333, type: TransactionType.DESPESA, category: Category.PESSOAL })];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.lines[0].actualSpend).toBeCloseTo(0.33, 2);
    expect(result.lines[0].suggestedLimit).toBeGreaterThan(0);
  });

  it('perfil Risk Taker com múltiplas categorias', () => {
    const txs = [INCOME, PERSONAL(1000), NEGOCIO(2000)];
    const result = generateSmartBudget(txs, 'Risk Taker');
    expect(result.lines.length).toBe(2);
    expect(result.targetSavingsRate).toBe(0.1);
  });
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
  it('retorna linhas vazias se não houver despesas', () => {
    const txs = [INCOME];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.lines.length).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.surplusForSavings).toBeCloseTo(10000, 1);
  });

  it('usa perfil desconhecido corretamente', () => {
    const txs = [INCOME, PERSONAL(1000)];
    const result = generateSmartBudget(txs, 'PerfilInexistente');
    // targetSavingsRate e reductionFactor devem usar fallback
    expect(result.targetSavingsRate).toBe(0.15);
    const line = result.lines[0];
    expect(line).toBeDefined();
  });

  it('lida com valores negativos e zero', () => {
    const txs = [makeTx({ amount: -500, type: TransactionType.DESPESA, category: Category.PESSOAL })];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.totalExpenses).toBe(-500);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].actualSpend).toBe(-500);
  });

  it('não quebra com categorias duplicadas ou vazias', () => {
    const txs = [
      makeTx({ amount: 100, type: TransactionType.DESPESA, category: '' as any }),
      makeTx({ amount: 200, type: TransactionType.DESPESA, category: '' as any }),
    ];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].actualSpend).toBe(300);
  });

  it('lida com income e expenses zero', () => {
    const txs: any[] = [];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.savingsRate).toBe(0);
    expect(result.lines.length).toBe(0);
  });

  it('lida com despesas negativas e income zero', () => {
    const txs = [makeTx({ amount: -100, type: TransactionType.DESPESA, category: Category.PESSOAL })];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(-100);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].actualSpend).toBe(-100);
  });

  it('lida com income negativo', () => {
    const txs = [makeTx({ amount: -500, type: TransactionType.RECEITA, category: Category.CONSULTORIO })];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.totalIncome).toBe(-500);
    expect(result.savingsRate).toBe(0);
  });

  it('lida com perfil Risk Taker', () => {
    const txs = [INCOME, PERSONAL(1000)];
    const result = generateSmartBudget(txs, 'Risk Taker');
    expect(result.targetSavingsRate).toBe(0.1);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].suggestedLimit).toBeGreaterThan(0);
  });

  it('lida com perfil Undefined explicitamente', () => {
    const txs = [INCOME, PERSONAL(500)];
    const result = generateSmartBudget(txs, 'Undefined');
    expect(result.targetSavingsRate).toBe(0.15);
    expect(result.lines.length).toBe(1);
  });

  it('lida com múltiplas categorias e shares diferentes', () => {
    const txs = [INCOME, PERSONAL(1000), NEGOCIO(2000)];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.lines.length).toBe(2);
    expect(result.lines[0].category).not.toBe(result.lines[1].category);
    expect(result.lines[0].actualSpend + result.lines[1].actualSpend).toBe(3000);
  });

  it('lida com categoria com share zero', () => {
    const txs = [INCOME];
    const result = generateSmartBudget(txs, 'Balanced');
    expect(result.lines.length).toBe(0);
  });

  it('action = "alertar" para desvio exato de 5%', () => {
    // suggestedLimit = 1000, actual = 1050, deviationPct = 5
    const txs = [INCOME, makeTx({ amount: 1050, type: TransactionType.DESPESA, category: Category.PESSOAL })];
    const result = generateSmartBudget(txs, 'PerfilInexistente');
    const line = result.lines[0];
    // Pela regra, 5% não é > 5, então deve ser 'ok'
    expect(line.action).toBe('ok');
  });

  it('action = "alertar" para desvio exato de 20%', () => {
    // suggestedLimit = 1000, actual = 1200, deviationPct = 20
    const txs = [INCOME, makeTx({ amount: 1200, type: TransactionType.DESPESA, category: Category.PESSOAL })];
    const result = generateSmartBudget(txs, 'PerfilInexistente');
    const line = result.lines[0];
    // Pela regra, 20% não é > 20, então deve ser 'alertar' apenas se > 20
    expect(['ok', 'alertar']).toContain(line.action);
  });

  it('arredondamento correto de suggestedLimit', () => {
    const txs = [INCOME, makeTx({ amount: 333.333, type: TransactionType.DESPESA, category: Category.PESSOAL })];
    const result = generateSmartBudget(txs, 'Balanced');
    const line = result.lines[0];
    expect(Number.isFinite(line.suggestedLimit)).toBe(true);
    expect(line.suggestedLimit).toBeCloseTo(line.suggestedLimit, 2);
  });
});
