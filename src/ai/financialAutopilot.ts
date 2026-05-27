import { type Account } from '../../models/Account';
import { type Transaction, TransactionType } from '../../types';
import { type AIInsight } from './insightGenerator';
import { type CashflowPrediction } from './riskAnalyzer';
import { buildFinancialGraph, graphToAIContext } from './financialGraph';
import { getMerchantCategories, getRecurringExpenses, getSpendingPatterns, getUserBehaviors, hasBehavior } from './memory';
import { generateSmartBudget } from '../engines/finance/budgetEngine';
import { learnMemory } from './aiMemory';
import { makeId, formatCurrency } from '../../utils/helpers';
import { logWarn } from '../utils/logger';
import { type LegacyAutopilotAction } from './signalEngine';
import {
  getMonthTxs,
  matchKeywords,
  parseAutopilotDate,
  pushDefaultAction,
  sortAutopilotActions,
  totalExpenses,
} from './financialAutopilotHelpers';

export type AutopilotAction = LegacyAutopilotAction;

function now(): string {
  return new Date().toISOString();
}

const SUBSCRIPTION_KEYWORDS = [
  'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'apple',
  'youtube', 'deezer', 'globoplay', 'paramount', 'assinatura',
  'mensalidade', 'plano', 'subscription', 'prime',
];

const DELIVERY_KEYWORDS = [
  'ifood', 'rappi', 'uber eats', 'delivery', '99food',
  'james', 'loggi', 'entrega', 'pedido',
];

export function runFinancialAutopilot(
  accounts: Account[],
  transactions: Transaction[],
  prediction: CashflowPrediction,
  _insights: AIInsight[],
): AutopilotAction[] {
  const actions: AutopilotAction[] = [];
  const base = transactions.filter((transaction) => !transaction.generated);
  const currentMonthTxs = getMonthTxs(base, 0);
  const lastMonthTxs = getMonthTxs(base, 1);
  const currentExpenses = totalExpenses(currentMonthTxs);
  const lastExpenses = totalExpenses(lastMonthTxs);

  const smartBudget = generateSmartBudget(base, 'Undefined');
  const categoryBudgets: Record<string, number> = Object.fromEntries(
    smartBudget.lines.map((line) => [line.category, line.suggestedLimit]),
  );

  const catHistory: Record<string, number[]> = {};
  for (let monthsAgo = 1; monthsAgo <= 3; monthsAgo++) {
    const txs = getMonthTxs(base, monthsAgo);
    for (const transaction of txs.filter((item) => item.type === TransactionType.DESPESA)) {
      if (!catHistory[transaction.category]) catHistory[transaction.category] = [];
      catHistory[transaction.category][monthsAgo - 1] =
        (catHistory[transaction.category][monthsAgo - 1] || 0) + transaction.amount;
    }
  }

  const currentCategorySpend: Record<string, number> = {};
  for (const transaction of currentMonthTxs.filter((item) => item.type === TransactionType.DESPESA)) {
    currentCategorySpend[transaction.category] = (currentCategorySpend[transaction.category] || 0) + transaction.amount;
  }

  for (const [category, spent] of Object.entries(currentCategorySpend)) {
    const budget = categoryBudgets[category];
    const history = catHistory[category] || [];
    const avg = history.length > 0 ? history.reduce((sum, value) => sum + value, 0) / history.length : undefined;
    const limit = avg !== undefined ? Math.min(budget ?? avg, avg) : budget ?? avg;

    if (limit && spent > limit * 1.05) {
      const suggestedCut = spent - limit;
      actions.push({
        id: makeId(),
        type: 'warning',
        severity: 'high',
        title: `Gasto excessivo em ${category}`,
        description: `Voce ja gastou ${formatCurrency(spent)} em "${category}" este mes, acima do limite (${formatCurrency(limit)}). Considere revisar seus gastos nesta categoria.`,
        value: suggestedCut,
        category,
        action_label: 'Ver Detalhes',
        created_at: now(),
      });
      actions.push({
        id: makeId(),
        type: 'optimization',
        severity: 'medium',
        title: `Sugestão de corte em ${category}`,
        description: `Reduza ao menos ${formatCurrency(suggestedCut)} em "${category}" para equilibrar seu orcamento e evitar extrapolar o limite historico/media da categoria.`,
        value: suggestedCut,
        category,
        action_label: 'Criar Meta de Corte',
        created_at: now(),
      });
      actions.push({
        id: makeId(),
        type: 'suggestion',
        severity: 'medium',
        title: `Meta automática: economizar em ${category}`,
        description: `Sugerimos criar uma meta de economizar pelo menos ${formatCurrency(suggestedCut)} em "${category}" ate o final do mes para equilibrar seu orcamento.`,
        value: suggestedCut,
        category,
        action_label: 'Criar Meta Automatica',
        created_at: now(),
      });
    }
  }

  if (prediction.balance_30_days < 0) {
    actions.push({
      id: makeId(),
      type: 'warning',
      severity: 'high',
      title: 'Saldo negativo possível',
      description: `Sua projecao para os proximos 30 dias e de ${formatCurrency(prediction.balance_30_days)}. Considere reduzir gastos ou antecipar receitas.`,
      value: prediction.balance_30_days,
      action_label: 'Ver Projecao',
      created_at: now(),
    });
  } else if (prediction.balance_7_days < prediction.current_balance * 0.2) {
    actions.push({
      id: makeId(),
      type: 'warning',
      severity: 'medium',
      title: 'Saldo caindo nos próximos 7 dias',
      description: `Em 7 dias seu saldo pode cair para ${formatCurrency(prediction.balance_7_days)} - abaixo de 20% do valor atual.`,
      value: prediction.balance_7_days,
      action_label: 'Ver Fluxo',
      created_at: now(),
    });
  }

  if (lastExpenses > 0 && currentExpenses > lastExpenses * 1.15) {
    const pct = Math.round(((currentExpenses - lastExpenses) / lastExpenses) * 100);
    const severity = pct > 40 ? 'high' : pct > 20 ? 'medium' : 'low';
    actions.push({
      id: makeId(),
      type: 'warning',
      severity,
      title: 'Aumento de gastos detectado',
      description: `Seus gastos este mes (${formatCurrency(currentExpenses)}) estao ${pct}% acima do mes anterior (${formatCurrency(lastExpenses)}).`,
      value: currentExpenses - lastExpenses,
      action_label: 'Ver Historico',
      created_at: now(),
    });
  }

  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentTxs = base.filter((transaction) => (parseAutopilotDate(transaction.date)?.getTime() ?? Number.NEGATIVE_INFINITY) >= last90.getTime());

  const subTxs = recentTxs.filter((transaction) =>
    transaction.type === TransactionType.DESPESA &&
    (matchKeywords(transaction.description, SUBSCRIPTION_KEYWORDS) ||
      matchKeywords(transaction.merchant ?? '', SUBSCRIPTION_KEYWORDS) ||
      transaction.recurring === true)
  );
  if (subTxs.length > 0) {
    const subTotal = subTxs.reduce((sum, transaction) => sum + transaction.amount, 0);
    const monthlyEst = subTotal / 3;
    const uniqueSubs = new Set(subTxs.map((transaction) => transaction.description.toLowerCase())).size;
    actions.push({
      id: makeId(),
      type: 'insight',
      severity: 'low',
      title: 'Gastos com assinaturas',
      description: `Voce tem ${uniqueSubs} assinatura(s) recorrente(s) com custo estimado de ${formatCurrency(monthlyEst)}/mes. Revise se todas estao sendo usadas.`,
      value: monthlyEst,
      category: 'Assinaturas',
      action_label: 'Revisar',
      created_at: now(),
    });
  }

  const deliveryTxs = recentTxs.filter((transaction) =>
    transaction.type === TransactionType.DESPESA &&
    matchKeywords(transaction.description + (transaction.merchant ?? ''), DELIVERY_KEYWORDS)
  );
  if (deliveryTxs.length >= 4) {
    const deliveryTotal = deliveryTxs.reduce((sum, transaction) => sum + transaction.amount, 0);
    const monthlyEst = deliveryTotal / 3;
    actions.push({
      id: makeId(),
      type: 'suggestion',
      severity: 'medium',
      title: 'Alto gasto com delivery',
      description: `Voce gastou ${formatCurrency(deliveryTotal)} com delivery nos ultimos 90 dias (~${formatCurrency(monthlyEst)}/mes). Preparar refeicoes em casa pode gerar economia significativa.`,
      value: monthlyEst,
      category: 'Alimentacao',
      action_label: 'Ver Gastos',
      created_at: now(),
    });
  }

  const categoryTotals: Record<string, number> = {};
  for (const transaction of base.filter((item) => item.type === TransactionType.DESPESA)) {
    categoryTotals[transaction.category] = (categoryTotals[transaction.category] ?? 0) + transaction.amount;
  }
  const topCategories = Object.entries(categoryTotals).sort((left, right) => right[1] - left[1]);
  if (topCategories.length > 0) {
    const [topCategory, topAmount] = topCategories[0];
    const totalAll = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);
    const pct = totalAll > 0 ? Math.round((topAmount / totalAll) * 100) : 0;

    if (pct > 40) {
      const potential = topAmount * 0.1;
      actions.push({
        id: makeId(),
        type: 'optimization',
        severity: 'medium',
      title: 'Potencial de economia identificado',
        description: `"${topCategory}" representa ${pct}% dos seus gastos totais (${formatCurrency(topAmount)}). Reduzir 10% nessa categoria pouparia ${formatCurrency(potential)}.`,
        value: potential,
        category: topCategory,
        action_label: 'Criar Meta',
        created_at: now(),
      });
      actions.push({
        id: makeId(),
        type: 'suggestion',
        severity: 'medium',
        title: `Meta automática: economizar em ${topCategory}`,
        description: `Sugerimos criar uma meta de economizar pelo menos ${formatCurrency(potential)} em "${topCategory}" ate o final do mes para potencializar sua saude financeira.`,
        value: potential,
        category: topCategory,
        action_label: 'Criar Meta Automatica',
        created_at: now(),
      });
    }
  }

  const emergencyTarget = prediction.projected_expenses * 3;
  if (prediction.current_balance < emergencyTarget && prediction.current_balance > 0) {
    actions.push({
      id: makeId(),
      type: 'suggestion',
      severity: 'low',
      title: 'Reserva de emergência abaixo do ideal',
      description: `O recomendado e ter ${formatCurrency(emergencyTarget)} de reserva (3 meses de despesas). Seu saldo atual e ${formatCurrency(prediction.current_balance)}.`,
      value: emergencyTarget - prediction.current_balance,
      action_label: 'Criar Meta',
      created_at: now(),
    });
    actions.push({
      id: makeId(),
      type: 'suggestion',
      severity: 'medium',
      title: 'Meta automática: criar reserva de emergência',
      description: `Sugerimos criar uma meta de reservar ${formatCurrency(emergencyTarget - prediction.current_balance)} para atingir o ideal de 3 meses de despesas.`,
      value: emergencyTarget - prediction.current_balance,
      category: 'Reserva de Emergencia',
      action_label: 'Criar Meta Automatica',
      created_at: now(),
    });
  }

  if (prediction.projected_income > 0 && prediction.projected_expenses > 0) {
    const savingRate = (prediction.projected_income - prediction.projected_expenses) / prediction.projected_income;
    if (savingRate > 0.25) {
      actions.push({
        id: makeId(),
        type: 'insight',
        severity: 'low',
        title: 'Fluxo financeiro saudavel',
        description: `Com base nos seus dados, voce esta poupando cerca de ${Math.round(savingRate * 100)}% da sua renda projetada. Continue assim!`,
        value: savingRate,
        action_label: 'Ver Insights',
        created_at: now(),
      });
    }
  }

  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const smallRecent = base.filter((transaction) =>
    transaction.type === TransactionType.DESPESA &&
    transaction.amount < 30 &&
    (parseAutopilotDate(transaction.date)?.getTime() ?? Number.NEGATIVE_INFINITY) >= last30.getTime()
  );
  if (smallRecent.length >= 8) {
    const smallTotal = smallRecent.reduce((sum, transaction) => sum + transaction.amount, 0);
    actions.push({
      id: makeId(),
      type: 'optimization',
      severity: 'low',
      title: 'Microgastos acumulados',
      description: `${smallRecent.length} compras abaixo de R$30 nos ultimos 30 dias totalizaram ${formatCurrency(smallTotal)}. Pequenos gastos frequentes somam mais do que parecem.`,
      value: smallTotal,
      action_label: 'Ver Historico',
      created_at: now(),
    });
  }

  try {
    const graph = buildFinancialGraph('local', accounts, base);
    graphToAIContext(graph, 3);
  } catch (error) {
    logWarn('[Autopilot] Graph context unavailable; continuing without graph enrichment', {
      error,
      userId: 'local',
    });
  }

  try {
    const userId = 'local';
    const spendingPatterns = getSpendingPatterns(userId);
    const weekendPattern = spendingPatterns.find((pattern) => (pattern as { pattern?: string }).pattern === 'weekend');
    if (weekendPattern && (weekendPattern as { frequency?: number }).frequency && (weekendPattern as { frequency: number }).frequency > 40) {
      actions.push({
        id: makeId(),
        type: 'insight',
        severity: 'low',
        title: 'Padrao de gastos aos finais de semana',
        description: `${(weekendPattern as { description: string }).description}. Considere estabelecer um orcamento especifico para lazer.`,
        value: (weekendPattern as { avgAmount?: number }).avgAmount,
        category: 'Comportamento',
        action_label: 'Ver Padroes',
        created_at: now(),
      });
    }

    if (hasBehavior(userId, 'impulsive_spending')) {
      const behaviors = getUserBehaviors(userId);
      const impulsive = behaviors.find((behavior) => behavior.behavior === 'impulsive_spending');
      if (impulsive && impulsive.score > 60) {
        actions.push({
          id: makeId(),
          type: 'suggestion',
          severity: 'medium',
          title: 'Padrao de compras impulsivas detectado',
          description: `Identificamos ${impulsive.score.toFixed(0)}% de probabilidade de gastos impulsivos. Tente aguardar 24h antes de compras nao-planejadas.`,
          value: impulsive.score,
          category: 'Comportamento',
          action_label: 'Ver Dicas',
          created_at: now(),
        });
      }
    }

    const recurringExpenses = getRecurringExpenses(userId) as Array<{ isSubscription?: boolean; amount: number }>;
    const subscriptions = recurringExpenses.filter((item) => item.isSubscription);
    if (subscriptions.length >= 3) {
      const totalSubscriptions = subscriptions.reduce((sum, item) => sum + item.amount, 0);
      actions.push({
        id: makeId(),
        type: 'optimization',
        severity: 'low',
        title: 'Multiplas assinaturas detectadas',
        description: `Voce tem ${subscriptions.length} assinaturas ativas totalizando ${formatCurrency(totalSubscriptions)}/mes. Revise quais sao realmente necessarias.`,
        value: totalSubscriptions,
        category: 'Assinaturas',
        action_label: 'Gerenciar',
        created_at: now(),
      });
    }

    const merchants = getMerchantCategories(userId) as Array<{ merchantName: string; frequency: number; avgAmount: number; totalSpent: number; category: string }>;
    const highFrequency = merchants.filter((merchant) => merchant.frequency > 8);
    if (highFrequency.length > 0) {
      const topMerchant = highFrequency[0];
      actions.push({
        id: makeId(),
        type: 'insight',
        severity: 'low',
        title: `Frequencia alta em "${topMerchant.merchantName}"`,
        description: `Voce visita este estabelecimento ${topMerchant.frequency.toFixed(1)} vezes por mes, com gasto medio de ${formatCurrency(topMerchant.avgAmount)}. Total: ${formatCurrency(topMerchant.totalSpent)}.`,
        value: topMerchant.totalSpent,
        category: topMerchant.category,
        action_label: 'Ver Detalhes',
        created_at: now(),
      });
    }
  } catch (error) {
    logWarn('[Autopilot] Error loading AI memories; continuing without behavioral context', {
      error,
      userId: 'local',
    });
  }

  pushDefaultAction(actions);

  return sortAutopilotActions(actions);
}

export async function learnAutopilotPatterns(): Promise<void> {
  return Promise.resolve();
}
