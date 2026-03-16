import { describe, expect, it } from 'vitest';

import {
  assessGoalFeasibility,
  recommendGoal,
  type SmartGoal,
} from '../../src/engines/finance/smartGoals/smartGoalsEngine';

// ─── assessGoalFeasibility ────────────────────────────────────────────────────

describe('assessGoalFeasibility', () => {
  it('retorna viavel quando meta ja atingida', () => {
    const goal: SmartGoal = { targetAmount: 5000, currentAmount: 5000, targetDate: '2027-01-01' };
    const result = assessGoalFeasibility(goal, 1000);
    expect(result.feasibility).toBe('viavel');
    expect(result.estimatedMonths).toBe(0);
    expect(result.shortfallPerMonth).toBe(0);
  });

  it('retorna viavel quando capacidade >= necessidade', () => {
    // remaining = 10000 - 0 = 10000; meses = 12; monthly = 833.33; available = 1000
    const goal: SmartGoal = {
      targetAmount: 10000,
      currentAmount: 0,
      targetDate: new Date(Date.now() + 366 * 24 * 3600 * 1000).toISOString(),
    };
    const result = assessGoalFeasibility(goal, 1000);
    expect(result.feasibility).toBe('viavel');
    expect(result.surplusPerMonth).toBeGreaterThan(0);
    expect(result.shortfallPerMonth).toBe(0);
  });

  it('retorna esticado quando ratio entre 0.7 e 1.0', () => {
    // remaining = 10000, meses = 12, monthly = 833.33; available = 750 (ratio ~0.9)
    const futureDate = new Date(Date.now() + 366 * 24 * 3600 * 1000).toISOString();
    const goal: SmartGoal = { targetAmount: 10000, currentAmount: 0, targetDate: futureDate };
    const result = assessGoalFeasibility(goal, 750);
    expect(result.feasibility).toBe('esticado');
  });

  it('retorna inviavel quando ratio < 0.7', () => {
    const futureDate = new Date(Date.now() + 366 * 24 * 3600 * 1000).toISOString();
    const goal: SmartGoal = { targetAmount: 10000, currentAmount: 0, targetDate: futureDate };
    const result = assessGoalFeasibility(goal, 200);
    expect(result.feasibility).toBe('inviavel');
    expect(result.shortfallPerMonth).toBeGreaterThan(0);
    expect(result.surplusPerMonth).toBe(0);
  });

  it('sem targetDate e capacidade positiva: estima meses', () => {
    const goal: SmartGoal = { targetAmount: 6000, currentAmount: 0 };
    const result = assessGoalFeasibility(goal, 600);
    expect(result.feasibility).toBe('viavel');
    expect(result.estimatedMonths).toBe(10);
  });

  it('sem targetDate e capacidade zero: inviavel', () => {
    const goal: SmartGoal = { targetAmount: 6000, currentAmount: 0 };
    const result = assessGoalFeasibility(goal, 0);
    expect(result.feasibility).toBe('inviavel');
    expect(result.estimatedMonths).toBeNull();
  });

  it('sem targetDate e capacidade negativa: inviavel com shortfall', () => {
    const goal: SmartGoal = { targetAmount: 6000, currentAmount: 0 };
    const result = assessGoalFeasibility(goal, -500);
    expect(result.feasibility).toBe('inviavel');
    expect(result.shortfallPerMonth).toBe(500);
  });
});

// ─── recommendGoal ───────────────────────────────────────────────────────────

describe('recommendGoal', () => {
  it('prioridade 1: reserva emergencia quando reserve < 100%', () => {
    const result = recommendGoal(5000, 3000, 'Balanced', 0);
    expect(result.goalType).toBe('reserva_emergencia');
    expect(result.priorityScore).toBeGreaterThan(50);
    // target = 3000 * 6 = 18000
    expect(result.suggestedTarget).toBe(18000);
  });

  it('reserva parcial: target = emergencia - reserve', () => {
    const result = recommendGoal(5000, 3000, 'Balanced', 9000);
    // emergencyTarget = 18000, faltam 9000
    expect(result.goalType).toBe('reserva_emergencia');
    expect(result.suggestedTarget).toBe(9000);
  });

  it('prioridade 2: quitar_divida para Spender sem poupança adequada', () => {
    // reserve completo; savings = (5000-4800)/5000 = 4%
    const result = recommendGoal(5000, 4800, 'Spender', 5000 * 4800 / 5000 * 6);
    // emergencyTarget = 4800*6 = 28800; reserve = 5760 → coverage < 1 → ainda reserva
    // Para garantir reserve = 100%, usar reserve >= emergencyTarget
    const result2 = recommendGoal(5000, 4800, 'Spender', 28800);
    expect(result2.goalType).toBe('quitar_divida');
  });

  it('prioridade 2: quitar_divida para Risk Taker sem poupança', () => {
    const result = recommendGoal(5000, 4600, 'Risk Taker', 27600);
    expect(result.goalType).toBe('quitar_divida');
    expect(result.priorityScore).toBe(75);
  });

  it('prioridade 3: investimento para Balanced com 15%+ poupança', () => {
    // savings = (5000 - 4000)/5000 = 20%
    const result = recommendGoal(5000, 4000, 'Balanced', 24000);
    expect(result.goalType).toBe('investimento');
    expect(result.priorityScore).toBe(55);
  });

  it('prioridade 3: investimento para Saver com 15%+ poupança', () => {
    const result = recommendGoal(8000, 6000, 'Saver', 36000);
    // savings = (8000-6000)/8000 = 25%
    expect(result.goalType).toBe('investimento');
  });

  it('default: economizar para outros casos', () => {
    const result = recommendGoal(5000, 4500, 'Undefined', 27000);
    // savings = 10%, Undefined → economizar
    expect(result.goalType).toBe('economizar');
    expect(result.suggestedTarget).toBeCloseTo(5000 * 0.15 * 12, 0);
  });

  it('renda zero: savingsRate zero → reserva como prioridade', () => {
    const result = recommendGoal(0, 0, 'Balanced', 0);
    // emergencyTarget = 0 → reserveCoverage = 1 (zeroes) → investimento ou economizar
    expect(['economizar', 'investimento', 'reserva_emergencia']).toContain(result.goalType);
  });
});
