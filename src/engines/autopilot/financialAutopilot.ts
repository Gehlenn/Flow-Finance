import { UserContext } from '../../context/UserContext';

export interface FinancialHealthContext {
  userContext: UserContext;
  monthlyExpenses: number;
  monthlyIncome: number;
  currentBalance: number;
}

export function analyzeFinancialHealth(context: FinancialHealthContext): string[] {
  const insights: string[] = [];

  if (context.monthlyExpenses > context.monthlyIncome) {
    insights.push('Voce esta gastando mais do que ganha.');
  }

  if (context.currentBalance < 0) {
    insights.push('Seu saldo atual esta negativo. Priorize recomposicao de caixa.');
  }

  if (context.monthlyIncome > 0) {
    const savingsRate = ((context.monthlyIncome - context.monthlyExpenses) / context.monthlyIncome) * 100;
    if (savingsRate < 10) {
      insights.push('Sua taxa de poupanca esta abaixo de 10%. Avalie cortes em custos variaveis.');
    }
  }

  if (insights.length === 0) {
    insights.push('Sua saude financeira esta estavel no momento.');
  }

  return insights;
}
