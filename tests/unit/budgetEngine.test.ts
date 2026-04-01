  it('retorna savingsRate exatamente 20 como otimo', () => {
    expect(analyzeBudget({ income: 1000, expenses: 800 })).toEqual({
      savingsRate: 20,
      isHealthy: true,
      recommendation: 'Otimo ritmo de poupanca. Mantenha a consistencia.',
    });
  });

  it('retorna savingsRate negativo extremo', () => {
    expect(analyzeBudget({ income: 100, expenses: 500 })).toEqual({
      savingsRate: -400,
      isHealthy: false,
      recommendation: 'Alerta: despesas elevadas. Reavalie categorias com maior impacto.',
    });
  });

  it('retorna savingsRate zero para income e expenses zero', () => {
    expect(analyzeBudget({ income: 0, expenses: 0 })).toEqual({
      savingsRate: 0,
      isHealthy: false,
      recommendation: 'Registre receitas para calcular a saude orcamentaria.',
    });
  });

  it('lida com floating point extremo', () => {
    const res = analyzeBudget({ income: 0.3333333333, expenses: 0.1111111111 });
    expect(res.savingsRate).toBeCloseTo(66.67, 2);
    expect(res.isHealthy).toBe(true);
  });
import { describe, it, expect } from 'vitest';
import { analyzeBudget } from '../../src/engines/finance/budgetEngine';

describe('analyzeBudget', () => {
  it('retorna savingsRate 0 e alerta se income <= 0', () => {
    expect(analyzeBudget({ income: 0, expenses: 100 })).toEqual({
      savingsRate: 0,
      isHealthy: false,
      recommendation: 'Registre receitas para calcular a saude orcamentaria.',
    });
    expect(analyzeBudget({ income: -100, expenses: 100 })).toEqual({
      savingsRate: 0,
      isHealthy: false,
      recommendation: 'Registre receitas para calcular a saude orcamentaria.',
    });
  });

  it('retorna otimo ritmo de poupanca para savingsRate >= 20', () => {
    expect(analyzeBudget({ income: 1000, expenses: 700 })).toEqual({
      savingsRate: 30,
      isHealthy: true,
      recommendation: 'Otimo ritmo de poupanca. Mantenha a consistencia.',
    });
  });

  it('retorna boa saude financeira para savingsRate >= 10', () => {
    expect(analyzeBudget({ income: 1000, expenses: 850 })).toEqual({
      savingsRate: 15,
      isHealthy: true,
      recommendation: 'Boa saude financeira. Busque reduzir gastos variaveis.',
    });
  });

  it('retorna alerta para savingsRate < 10', () => {
    expect(analyzeBudget({ income: 1000, expenses: 950 })).toEqual({
      savingsRate: 5,
      isHealthy: false,
      recommendation: 'Alerta: despesas elevadas. Reavalie categorias com maior impacto.',
    });
  });
  it('retorna savingsRate exatamente 10 como saudável', () => {
    expect(analyzeBudget({ income: 1000, expenses: 900 })).toEqual({
      savingsRate: 10,
      isHealthy: true,
      recommendation: 'Boa saude financeira. Busque reduzir gastos variaveis.',
    });
  });

  it('retorna savingsRate negativo como alerta', () => {
    expect(analyzeBudget({ income: 1000, expenses: 1200 })).toEqual({
      savingsRate: -20,
      isHealthy: false,
      recommendation: 'Alerta: despesas elevadas. Reavalie categorias com maior impacto.',
    });
  });

  it('lida com valores grandes', () => {
    expect(analyzeBudget({ income: 1_000_000, expenses: 800_000 })).toEqual({
      savingsRate: 20,
      isHealthy: true,
      recommendation: 'Otimo ritmo de poupanca. Mantenha a consistencia.',
    });
  });
});
