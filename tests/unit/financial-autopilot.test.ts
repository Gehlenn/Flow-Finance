import { describe, expect, it } from 'vitest';
import { FinancialAutopilot } from '../../src/engines/autopilot/financialAutopilot';
import { Category, TransactionType } from '../../types';

describe('FinancialAutopilot', () => {
  it('returns overspending alert when expenses are above income', () => {
    const autopilot = new FinancialAutopilot();

    const alerts = autopilot.analyze({
      monthlyExpenses: 5000,
      monthlyIncome: 3500,
      currentBalance: 200,
    });

    expect(alerts.some((a) => a.type === 'overspending')).toBe(true);
  });

  it('returns stable alert when finances are healthy', () => {
    const autopilot = new FinancialAutopilot();

    const alerts = autopilot.analyze({
      monthlyExpenses: 1500,
      monthlyIncome: 5000,
      currentBalance: 3000,
    });

    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('stable');
  });

  it('flags dominant expense category from money map', () => {
    const autopilot = new FinancialAutopilot();

    const alerts = autopilot.analyze({
      monthlyExpenses: 1000,
      monthlyIncome: 4000,
      currentBalance: 5000,
      transactions: [
        {
          id: 't1',
          amount: 420,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Mercado',
          date: new Date().toISOString(),
        },
        {
          id: 't2',
          amount: 300,
          type: TransactionType.DESPESA,
          category: Category.CONSULTORIO,
          description: 'Uber',
          date: new Date().toISOString(),
        },
        {
          id: 't3',
          amount: 280,
          type: TransactionType.DESPESA,
          category: Category.NEGOCIO,
          description: 'Ferramenta',
          date: new Date().toISOString(),
        },
      ],
    });

    expect(alerts.some((alert) => alert.message.includes('42%'))).toBe(true);
  });
});
