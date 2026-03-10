import { UserContext } from '../../context/UserContext';
import { aiTaskQueue } from '../../ai/queue/AITaskQueue';

export interface AutopilotAlert {
  type: 'overspending' | 'negative_balance' | 'low_savings_rate' | 'stable';
  message: string;
}

export interface FinancialHealthContext {
  userContext: UserContext;
  monthlyExpenses: number;
  monthlyIncome: number;
  currentBalance: number;
}

export class FinancialAutopilot {
  analyze(context: Omit<FinancialHealthContext, 'userContext'>): AutopilotAlert[] {
    const alerts: AutopilotAlert[] = [];

    if (context.monthlyExpenses > context.monthlyIncome) {
      alerts.push({
        type: 'overspending',
        message: 'Voce esta gastando mais do que ganha.',
      });
    }

    if (context.currentBalance < 0) {
      alerts.push({
        type: 'negative_balance',
        message: 'Seu saldo atual esta negativo. Priorize recomposicao de caixa.',
      });
    }

    if (context.monthlyIncome > 0) {
      const savingsRate = ((context.monthlyIncome - context.monthlyExpenses) / context.monthlyIncome) * 100;
      if (savingsRate < 10) {
        alerts.push({
          type: 'low_savings_rate',
          message: 'Sua taxa de poupanca esta abaixo de 10%. Avalie cortes em custos variaveis.',
        });
      }
    }

    if (alerts.length === 0) {
      alerts.push({
        type: 'stable',
        message: 'Sua saude financeira esta estavel no momento.',
      });
    }

    return alerts;
  }

  enqueueAnalysis(userId: string, accounts: unknown[], transactions: unknown[], goals?: unknown[]): string {
    if (!aiTaskQueue.isInitialized()) {
      aiTaskQueue.initialize();
    }

    return aiTaskQueue.enqueueAutopilotAnalysis(userId, accounts, transactions, goals);
  }
}

export function analyzeFinancialHealth(context: FinancialHealthContext): string[] {
  const autopilot = new FinancialAutopilot();
  return autopilot.analyze({
    monthlyExpenses: context.monthlyExpenses,
    monthlyIncome: context.monthlyIncome,
    currentBalance: context.currentBalance,
  }).map((alert) => alert.message);
}
