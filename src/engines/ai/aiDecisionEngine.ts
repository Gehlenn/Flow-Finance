import { analyzeBudget } from '../finance/budgetEngine';
import { AIContext } from './aiContextBuilder';

export interface AIDecision {
  level: 'safe' | 'attention' | 'critical';
  recommendation: string;
}

export function makeAIDecision(context: AIContext): AIDecision {
  const budget = analyzeBudget({
    income: context.monthlyIncome,
    expenses: context.monthlySpending,
  });

  if (!budget.isHealthy && context.balance < 0) {
    return {
      level: 'critical',
      recommendation: 'Fluxo negativo com baixa poupanca. Priorize corte de custos e renegociacao de contas fixas.',
    };
  }

  if (!budget.isHealthy) {
    return {
      level: 'attention',
      recommendation: budget.recommendation,
    };
  }

  return {
    level: 'safe',
    recommendation: budget.recommendation,
  };
}
