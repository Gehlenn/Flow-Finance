export interface CFOFinancialState {
  balance: number;
  income: number;
  expenses: number;
}

export class AICFOAgent {
  async analyzeFinancialState(context: CFOFinancialState): Promise<string[]> {
    const insights: string[] = [];

    if (context.balance < 0) {
      insights.push('Seu saldo esta negativo.');
    }

    if (context.expenses > context.income) {
      insights.push('Seus gastos mensais estao acima da sua renda.');
    }

    if (insights.length === 0) {
      insights.push('Seu estado financeiro esta equilibrado no momento.');
    }

    return insights;
  }
}
