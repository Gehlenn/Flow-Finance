export interface BudgetInput {
  income: number;
  expenses: number;
}

export interface BudgetAnalysis {
  savingsRate: number;
  isHealthy: boolean;
  recommendation: string;
}

export function analyzeBudget(input: BudgetInput): BudgetAnalysis {
  if (input.income <= 0) {
    return {
      savingsRate: 0,
      isHealthy: false,
      recommendation: 'Registre receitas para calcular a saude orcamentaria.',
    };
  }

  const net = input.income - input.expenses;
  const savingsRate = (net / input.income) * 100;

  if (savingsRate >= 20) {
    return { savingsRate, isHealthy: true, recommendation: 'Otimo ritmo de poupanca. Mantenha a consistencia.' };
  }

  if (savingsRate >= 10) {
    return { savingsRate, isHealthy: true, recommendation: 'Boa saude financeira. Busque reduzir gastos variaveis.' };
  }

  return { savingsRate, isHealthy: false, recommendation: 'Alerta: despesas elevadas. Reavalie categorias com maior impacto.' };
}
