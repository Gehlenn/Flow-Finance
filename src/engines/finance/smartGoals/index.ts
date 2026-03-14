export * from './smartGoalsEngine';
export * from './goalRecommendationEngine';

// Compatibilidade com implementação anterior
export interface SmartGoalInput {
  goalAmount: number;
  currentAmount: number;
  monthsToGoal: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
}

export interface SmartGoalPlan {
  remainingAmount: number;
  monthsToGoal: number;
  monthlyContribution: number;
  feasibility: 'alta' | 'media' | 'baixa';
  recommendations: string[];
}

export function buildSmartGoalPlan(input: SmartGoalInput): SmartGoalPlan {
  const remainingAmount = Math.max(0, input.goalAmount - input.currentAmount);
  const monthsToGoal = Math.max(1, input.monthsToGoal);
  const monthlyContribution = remainingAmount / monthsToGoal;

  const disposableIncome =
    input.monthlyIncome !== undefined && input.monthlyExpenses !== undefined
      ? Math.max(0, input.monthlyIncome - input.monthlyExpenses)
      : undefined;

  let feasibility: SmartGoalPlan['feasibility'] = 'media';
  const recommendations: string[] = [];

  if (disposableIncome === undefined) {
    recommendations.push('informe receita e despesas para melhorar a projeção');
  } else if (monthlyContribution <= disposableIncome * 0.6) {
    feasibility = 'alta';
    recommendations.push('meta factível com a folga de caixa atual');
  } else if (monthlyContribution <= disposableIncome) {
    feasibility = 'media';
    recommendations.push('meta possível, mas exige disciplina mensal');
  } else {
    feasibility = 'baixa';
    recommendations.push('reduza despesas variáveis ou aumente o prazo da meta');
    recommendations.push('considere renda extra para cobrir o valor mensal alvo');
  }

  return {
    remainingAmount,
    monthsToGoal,
    monthlyContribution: Number(monthlyContribution.toFixed(2)),
    feasibility,
    recommendations,
  };
}
