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
});
