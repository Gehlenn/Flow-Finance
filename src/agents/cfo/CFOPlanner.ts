import { CFOFinancialState } from './AICFOAgent';

export interface CFOPlan {
  savingsGoal: number;
  expenseCap: number;
}

export class CFOPlanner {
  generatePlan(context: CFOFinancialState): CFOPlan {
    return {
      savingsGoal: context.income * 0.2,
      expenseCap: context.income * 0.8,
    };
  }
}
