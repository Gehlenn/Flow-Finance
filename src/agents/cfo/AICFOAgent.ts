import { AIMemoryType } from '../../ai/memory/memoryTypes';
import { aiMemoryStore } from '../../ai/memory/AIMemoryStore';

export interface CFOFinancialState {
  balance: number;
  income: number;
  expenses: number;
  userId?: string;
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

    if (context.userId) {
      const recurring = aiMemoryStore.getByType(AIMemoryType.RECURRING_EXPENSE, context.userId);
      if (recurring.length > 0) {
        insights.push(`Voce possui ${recurring.length} pagamentos recorrentes.`);
      }
    }

    if (insights.length === 0) {
      insights.push('Seu estado financeiro esta equilibrado no momento.');
    }

    return insights;
  }
}
