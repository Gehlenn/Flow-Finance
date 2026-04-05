import { describe, expect, it } from 'vitest';
import { CFOSchema, InterpretSchema, TokenCountSchema } from '../../src/validation/ai.schema';

describe('AI schema hardening', () => {
  it('accepts valid CFO payload', () => {
    const result = CFOSchema.safeParse({
      question: 'Posso gastar este mês?',
      context: 'Saldo atual: R$ 2500',
      intent: 'spending_advice',
    });

    expect(result.success).toBe(true);
  });

  it('rejects oversized CFO question', () => {
    const result = CFOSchema.safeParse({
      question: 'a'.repeat(1001),
      context: 'ok',
      intent: 'general_finance',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid CFO intent', () => {
    const result = CFOSchema.safeParse({
      question: 'Qual meu saldo?',
      intent: 'unknown_intent',
    });

    expect(result.success).toBe(false);
  });

  it('rejects oversized interpret text', () => {
    const result = InterpretSchema.safeParse({
      text: 'a'.repeat(4001),
    });

    expect(result.success).toBe(false);
  });

  it('rejects oversized token-count text', () => {
    const result = TokenCountSchema.safeParse({
      text: 'a'.repeat(20001),
    });

    expect(result.success).toBe(false);
  });
});
