import { describe, expect, it } from 'vitest';
import { normalizeCFORequestInput } from '../../src/controllers/aiController';
import { buildCfoPrompt } from '../../src/controllers/aiControllerHelpers';
import { AppError } from '../../src/middleware/errorHandler';

describe('normalizeCFORequestInput', () => {
  it('normalizes valid payload', () => {
    const normalized = normalizeCFORequestInput({
      question: '  Como esta meu caixa hoje?  ',
      context: 'Saldo: 2000',
      intent: 'cash_position',
    });

    expect(normalized.question).toBe('Como esta meu caixa hoje?');
    expect(normalized.context).toBe('Saldo: 2000');
    expect(normalized.intent).toBe('cash_position');
  });

  it('throws AppError when question is missing', () => {
    expect(() => normalizeCFORequestInput({ context: 'x' })).toThrow(AppError);
  });

  it('falls back to monthly_summary for unknown intent', () => {
    const normalized = normalizeCFORequestInput({
      question: 'Como esta meu orçamento?',
      context: 'Saldo: 1500',
      intent: 'invalid_intent',
    });

    expect(normalized.intent).toBe('monthly_summary');
  });

  it('truncates context to max length', () => {
    const longContext = 'x'.repeat(21000);
    const normalized = normalizeCFORequestInput({
      question: 'Resumo do mes',
      context: longContext,
      intent: 'receivables_question',
    });

    expect(normalized.context.length).toBe(20000);
  });

  it('builds CFO prompt around operational cash-flow decisions', () => {
    const prompt = buildCfoPrompt({
      context: 'Saldo confirmado: 1000. Recebiveis pendentes: 2500.',
      intent: 'cash_position',
      question: 'O que faco esta semana?',
    });

    expect(prompt).toContain('consultor de caixa operacional');
    expect(prompt).toContain('empresas de servico');
    expect(prompt).toContain('caixa confirmado');
    expect(prompt).toContain('previsto');
    expect(prompt).toContain('proxima acao semanal');
    expect(prompt).not.toContain('Assistente Financeiro');
  });
});
