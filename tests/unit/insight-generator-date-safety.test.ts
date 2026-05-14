import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('generateFinancialInsights date safety', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('trata datas date-only como janela local para insights mensais', async () => {
    const { generateFinancialInsights } = await import('../../src/ai/insightGenerator');
    const { Category, TransactionType } = await import('../../types');

    const insights = generateFinancialInsights([
      {
        id: 'last-month',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Despesa antiga',
        date: '2026-04-10',
      },
      {
        id: 'current-month-1',
        amount: 160,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Despesa atual',
        date: '2026-05-01',
      },
      {
        id: 'current-month-2',
        amount: 150,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Despesa atual',
        date: '2026-05-02',
      },
      {
        id: 'income',
        amount: 1200,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: '2026-05-05',
      },
    ] as never[]);

    expect(insights.some((insight) => insight.message.includes('aumentaram'))).toBe(true);
  });
});
