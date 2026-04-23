import { UserContext } from '../../context/UserContext';
import { aiTaskQueue } from '../../ai/queue/AITaskQueue';
import { aiMemoryStore } from '../../ai/memory/AIMemoryStore';
import { AIMemoryType } from '../../ai/memory/memoryTypes';
import { Transaction } from '../../../types';
import { moneyMapEngine } from '../finance/moneyMap/moneyMapEngine';

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
  analyze(context: Omit<FinancialHealthContext, 'userContext'> & { userId?: string; transactions?: Transaction[] }): AutopilotAlert[] {
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

    if (context.userId) {
      const recurring = aiMemoryStore.getByType(AIMemoryType.RECURRING_EXPENSE, context.userId);
      if (recurring.length >= 3) {
        alerts.push({
          type: 'overspending',
          message: `Detectamos ${recurring.length} recorrencias. Revise assinaturas e custos fixos para reduzir gastos.`,
        });
      }
    }

    if (context.transactions && context.transactions.length > 0) {
      const dominantCategory = moneyMapEngine.getDominantCategory(context.transactions);
      if (dominantCategory && dominantCategory.percentage >= 35) {
        alerts.push({
          type: 'overspending',
          message: `${dominantCategory.category} representa ${Math.round(dominantCategory.percentage)}% dos seus gastos.`,
        });
      }
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
    userId: context.userContext.userId,
  }).map((alert) => alert.message);
}

// --- A3: Priorizacao de acoes por risco + impacto ---

export type ActionPriority = 'critica' | 'alta' | 'media' | 'baixa';

export interface PrioritizedAction {
  id: string;
  priority: ActionPriority;
  priorityScore: number;    // 0..100 (maior = mais urgente)
  impactScore: number;      // 0..100 (maior impacto financeiro)
  riskScore: number;        // 0..100 (maior risco se ignorado)
  title: string;
  description: string;
  suggestedCut?: number;    // valor R$ sugerido de corte (quando aplicavel)
  category?: string;
}

export interface PrioritizedActionsResult {
  actions: PrioritizedAction[];
  topAction: PrioritizedAction | null;
}

/**
 * Prioriza acoes financeiras acionaveis por risco x impacto.
 * Consome alerts do FinancialAutopilot e dados de budget para gerar cortes sugeridos.
 */
export function prioritizeActions(
  monthlyIncome: number,
  monthlyExpenses: number,
  currentBalance: number,
  transactions: Transaction[] = [],
  profile: string = 'Undefined',
): PrioritizedActionsResult {
  const actions: PrioritizedAction[] = [];
  const savingsRate = monthlyIncome > 0
    ? (monthlyIncome - monthlyExpenses) / monthlyIncome
    : 0;

  // Acao 1: Saldo negativo - risco critico
  if (currentBalance < 0) {
    actions.push({
      id: 'negative_balance',
      priority: 'critica',
      priorityScore: 100,
      impactScore: 95,
      riskScore: 100,
      title: 'Recompor saldo negativo',
      description: `Saldo negativo de R$ ${Math.abs(currentBalance).toFixed(2)}. Prioridade maxima: corte imediato de gastos nao essenciais.`,
      suggestedCut: Math.abs(currentBalance),
    });
  }

  // Acao 2: Gastos > Receita - overspending
  if (monthlyExpenses > monthlyIncome) {
    const overshoot = monthlyExpenses - monthlyIncome;
    actions.push({
      id: 'overspending',
      priority: 'critica',
      priorityScore: 90,
      impactScore: 90,
      riskScore: 85,
      title: 'Reduzir despesas abaixo da receita',
      description: `Despesas superam receita em R$ ${overshoot.toFixed(2)}/mes. Corte necessario para equilibrar o fluxo.`,
      suggestedCut: Number(overshoot.toFixed(2)),
    });
  }

  // Acao 3: Taxa de poupanca baixa
  if (savingsRate < 0.1 && monthlyIncome > 0) {
    const targetCut = monthlyExpenses - monthlyIncome * 0.85; // poupar 15%
    actions.push({
      id: 'low_savings',
      priority: 'alta',
      priorityScore: 75,
      impactScore: 70,
      riskScore: 65,
      title: 'Aumentar taxa de poupanca',
      description: `Poupanca atual: ${(savingsRate * 100).toFixed(0)}% (meta 15%). Corte necessario: R$ ${Math.max(0, targetCut).toFixed(2)}/mes.`,
      suggestedCut: Number(Math.max(0, targetCut).toFixed(2)),
    });
  }

  // Acao 4: Categoria dominante (>35% das despesas)
  if (transactions.length > 0) {
    const dominant = moneyMapEngine.getDominantCategory(transactions);
    if (dominant && dominant.percentage >= 35) {
      const dominantAmount = monthlyExpenses * (dominant.percentage / 100);
      const suggestedCut = Number((dominantAmount * 0.15).toFixed(2)); // cortar 15% da categoria
      actions.push({
        id: 'dominant_category',
        priority: dominant.percentage >= 50 ? 'alta' : 'media',
        priorityScore: Math.round(dominant.percentage * 1.2),
        impactScore: Math.round(dominant.percentage),
        riskScore: dominant.percentage >= 50 ? 60 : 40,
        title: `Revisar gastos em ${dominant.category}`,
        description: `${dominant.category} representa ${Math.round(dominant.percentage)}% das despesas. Corte sugerido de 15%: R$ ${suggestedCut.toFixed(2)}.`,
        suggestedCut,
        category: String(dominant.category),
      });
    }
  }

  // Acao 5: Perfil Spender com poupanca positiva - oportunidade de investimento
  if (profile === 'Saver' && savingsRate >= 0.2) {
    const investable = Number((monthlyIncome * savingsRate * 0.5).toFixed(2));
    actions.push({
      id: 'invest_surplus',
      priority: 'baixa',
      priorityScore: 30,
      impactScore: 60,
      riskScore: 10,
      title: 'Alocar excedente em investimentos',
      description: `Perfil Saver com poupanca de ${(savingsRate * 100).toFixed(0)}%. Considere alocar R$ ${investable.toFixed(2)}/mes em renda variavel ou fixa.`,
      suggestedCut: 0,
    });
  }

  // Se nenhuma acao critica -> acao de manutencao
  if (actions.length === 0) {
    actions.push({
      id: 'maintain_health',
      priority: 'baixa',
      priorityScore: 20,
      impactScore: 30,
      riskScore: 10,
      title: 'Manter saude financeira',
      description: 'Financas equilibradas. Continue monitorando para antecipar mudancas de perfil.',
    });
  }

  // Ordenar por priorityScore decrescente
  actions.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    actions,
    topAction: actions[0] ?? null,
  };
}

