import { describe, expect, it } from 'vitest';
import { normalizeCFORequestInput } from '../../src/controllers/aiController';
import { AppError } from '../../src/middleware/errorHandler';

describe('normalizeCFORequestInput', () => {
  it('normalizes valid payload', () => {
    const normalized = normalizeCFORequestInput({
      question: '  Posso investir este mes?  ',
      context: 'Saldo: 2000',
      intent: 'investment_question',
    });

    expect(normalized.question).toBe('Posso investir este mes?');
    expect(normalized.context).toBe('Saldo: 2000');
    expect(normalized.intent).toBe('investment_question');
  });

  it('throws AppError when question is missing', () => {
    expect(() => normalizeCFORequestInput({ context: 'x' })).toThrow(AppError);
  });

  it('falls back to general_finance for unknown intent', () => {
    const normalized = normalizeCFORequestInput({
      question: 'Como esta meu orçamento?',
      context: 'Saldo: 1500',
      intent: 'invalid_intent',
    });

    expect(normalized.intent).toBe('general_finance');
  });

  it('truncates context to max length', () => {
    const longContext = 'x'.repeat(21000);
    const normalized = normalizeCFORequestInput({
      question: 'Resumo do mes',
      context: longContext,
      intent: 'budget_question',
    });

    expect(normalized.context.length).toBe(20000);
  });
});
