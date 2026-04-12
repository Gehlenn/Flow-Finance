import { describe, expect, it } from 'vitest';

import { analyzeFinancialQuestion } from '../../src/ai/aiCFO';

describe('analyzeFinancialQuestion', () => {
  it('classifies balance checks into cash_position', () => {
    expect(analyzeFinancialQuestion('Qual meu caixa confirmado agora?')).toBe('cash_position');
  });

  it('classifies short-term forecast requests into receivables_question', () => {
    expect(analyzeFinancialQuestion('Mostre a previsao dos proximos 30 dias.')).toBe('receivables_question');
  });

  it('classifies pending receivables requests into receivables_question', () => {
    expect(analyzeFinancialQuestion('Tenho pendencias e vencidos para esta semana?')).toBe('receivables_question');
  });

  it('classifies spending viability into spending_advice', () => {
    expect(analyzeFinancialQuestion('Posso gastar mais esta semana?')).toBe('spending_advice');
  });

  it('falls back to monthly_summary for broad prompts', () => {
    expect(analyzeFinancialQuestion('Como foi meu desempenho financeiro?')).toBe('monthly_summary');
  });

  it('routes generic investment wording to monthly_summary', () => {
    expect(analyzeFinancialQuestion('Devo investir neste momento?')).toBe('monthly_summary');
  });
});
