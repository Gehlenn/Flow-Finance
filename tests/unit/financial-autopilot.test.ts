import { describe, expect, it } from 'vitest';
import { FinancialAutopilot } from '../../src/engines/autopilot/financialAutopilot';

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
});
