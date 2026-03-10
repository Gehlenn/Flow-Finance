import { describe, expect, it } from 'vitest';
import { CFOAdvisor } from '../../src/agents/cfo/CFOAdvisor';
import { Category, TransactionType } from '../../types';

describe('CFOAdvisor', () => {
  it('generates a savings plan and negative balance insight', async () => {
    const advisor = new CFOAdvisor();

    const result = await advisor.advise({
      userId: 'user-1',
      transactions: [
        {
          id: 't1',
          amount: 2000,
          type: TransactionType.RECEITA,
          category: Category.CONSULTORIO,
          description: 'Receita mensal',
          date: new Date().toISOString(),
        },
        {
          id: 't2',
          amount: 2500,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Despesas fixas',
          date: new Date().toISOString(),
        },
      ],
      monthlyIncome: 2000,
      monthlyExpenses: 2500,
      balance: -500,
    });

    expect(result.plan.savingsGoal).toBe(400);
    expect(result.insights.some((i) => i.includes('negativo'))).toBe(true);
    expect(result.autopilotAlerts.some((a) => a.type === 'overspending')).toBe(true);
  });

  it('supports repository-backed flow without transactions in input', async () => {
    const fakeRepository = {
      getByUser: async () => [
        {
          id: 't3',
          amount: 4000,
          type: TransactionType.RECEITA,
          category: Category.CONSULTORIO,
          description: 'Receita',
          date: new Date().toISOString(),
        },
      ],
    } as any;

    const advisor = new CFOAdvisor(fakeRepository);

    const result = await advisor.advise({
      userId: 'user-2',
      monthlyIncome: 4000,
      monthlyExpenses: 2000,
      balance: 2000,
    });

    expect(result.plan.savingsGoal).toBe(800);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it('includes 30 day cashflow forecast insight', async () => {
    const advisor = new CFOAdvisor();

    const result = await advisor.advise({
      userId: 'user-forecast',
      transactions: [
        {
          id: 'income-1',
          amount: 6000,
          type: TransactionType.RECEITA,
          category: Category.CONSULTORIO,
          description: 'Receita mensal',
          date: '2026-01-05T00:00:00.000Z',
        },
        {
          id: 'netflix-1',
          amount: 50,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Netflix',
          merchant: 'Netflix',
          date: '2026-01-10T00:00:00.000Z',
        },
        {
          id: 'netflix-2',
          amount: 50,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Netflix',
          merchant: 'Netflix',
          date: '2026-02-10T00:00:00.000Z',
        },
        {
          id: 'netflix-3',
          amount: 50,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Netflix',
          merchant: 'Netflix',
          date: '2026-03-10T00:00:00.000Z',
        },
      ],
      monthlyIncome: 6000,
      monthlyExpenses: 1000,
      balance: 5000,
    });

    expect(result.insights.some((insight) => insight.includes('30 dias'))).toBe(true);
  });
});
