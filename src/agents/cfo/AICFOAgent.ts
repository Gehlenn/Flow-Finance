import { AIMemoryType } from '../../ai/memory/memoryTypes';
import { aiMemoryStore } from '../../ai/memory/AIMemoryStore';
import { Transaction } from '../../../types';
import { FinancialPatterns, financialPatternDetector } from '../../engines/finance/patternDetector/financialPatternDetector';
import { cashflowPredictionEngine } from '../../engines/finance/cashflowPrediction/cashflowPredictionEngine';
import { FinancialProfile } from '../../engines/ai/financialProfileClassifier';

export interface CFOFinancialState {
  balance: number;
  income: number;
  expenses: number;
  userId?: string;
  profile?: FinancialProfile;
  transactions?: Transaction[];
  patterns?: FinancialPatterns;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
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

    if (context.profile) {
      insights.push(`Seu perfil financeiro atual e ${context.profile}.`);
    }

    if (context.transactions && context.transactions.length > 0) {
      const forecast = cashflowPredictionEngine.predict({
        balance: context.balance,
        transactions: context.transactions,
        patterns: context.patterns || financialPatternDetector.detectPatterns(context.transactions),
      });

      insights.push(`Seu saldo estimado em 30 dias e ${formatCurrency(forecast.in30Days)}.`);
    }

    if (insights.length === 0) {
      insights.push('Seu estado financeiro esta equilibrado no momento.');
    }

    return insights;
  }
}
