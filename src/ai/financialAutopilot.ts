/**
 * FINANCIAL AUTOPILOT — Análise proativa e sugestões automáticas
 *
 * Analisa dados financeiros e gera ações acionáveis para o usuário.
 * NUNCA modifica dados. Apenas sugere.
 *
 * Camadas de detecção:
 *   1. Saldo negativo projetado
 *   2. Aceleração de gastos
 *   3. Detecção de assinaturas
 *   4. Oportunidades de economia
 *   5. Padrões de comportamento
 *   6. Saúde geral do fluxo
 */

import { Transaction, TransactionType } from '../../types';
import { Account } from '../../models/Account';
import { CashflowPrediction } from './riskAnalyzer';
import { AIInsight } from './insightGenerator';
import { learnMemory } from './aiMemory';
import { buildFinancialGraph, getTopMerchants, getCategorySpending, detectSubscriptionCandidates } from './financialGraph';
import { makeId, formatCurrency } from '../../utils/helpers';
// fmt was previously used, update all instances below to formatCurrency

// ─── PART 2 — Model ───────────────────────────────────────────────────────────

export interface AutopilotAction {
  id: string;
  type: 'warning' | 'suggestion' | 'optimization' | 'insight';
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high';
  category?: string;
  value?: number;        // valor numérico relevante (ex: economia potencial)
  action_label?: string; // label do botão de ação sugerida
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

// Note: `getMonthTxs` remains here because it supports monthsAgo.
function getMonthTxs(txs: Transaction[], monthsAgo: number): Transaction[] {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth() - monthsAgo, 1);
  const to   = new Date(d.getFullYear(), d.getMonth() - monthsAgo + 1, 0, 23, 59, 59);
  return txs.filter(t => { const td = new Date(t.date); return td >= from && td <= to; });
}

function totalExpenses(txs: Transaction[]): number {
  return txs.filter(t => t.type === TransactionType.DESPESA && !t.generated)
            .reduce((s, t) => s + t.amount, 0);
}

// Keywords para detecção de assinaturas e delivery
const SUBSCRIPTION_KEYWORDS = [
  'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'apple',
  'youtube', 'deezer', 'globoplay', 'paramount', 'assinatura',
  'mensalidade', 'plano', 'subscription', 'prime'
];

const DELIVERY_KEYWORDS = [
  'ifood', 'rappi', 'uber eats', 'delivery', '99food',
  'james', 'loggi', 'entrega', 'pedido'
];

function matchKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

// ─── PART 3 — Main Autopilot Engine ──────────────────────────────────────────

export function runFinancialAutopilot(
  accounts: Account[],
  transactions: Transaction[],
  prediction: CashflowPrediction,
  insights: AIInsight[]
): AutopilotAction[] {
  const actions: AutopilotAction[] = [];
  const base = transactions.filter(t => !t.generated);

  const currentMonthTxs = getMonthTxs(base, 0);
  const lastMonthTxs    = getMonthTxs(base, 1);
  const currentExpenses = totalExpenses(currentMonthTxs);
  const lastExpenses    = totalExpenses(lastMonthTxs);

  // ── PART 4: Saldo negativo projetado ───────────────────────────────────────
  if (prediction.balance_30_days < 0) {
    actions.push({
      id: makeId(), type: 'warning', severity: 'high',
      title: 'Saldo negativo possível',
      description: `Sua projeção para os próximos 30 dias é de ${formatCurrency(prediction.balance_30_days)}. Considere reduzir gastos ou antecipar receitas.`,
      value: prediction.balance_30_days,
      action_label: 'Ver Projeção',
      created_at: now(),
    });
  } else if (prediction.balance_7_days < prediction.current_balance * 0.2) {
    actions.push({
      id: makeId(), type: 'warning', severity: 'medium',
      title: 'Saldo caindo nos próximos 7 dias',
      description: `Em 7 dias seu saldo pode cair para ${formatCurrency(prediction.balance_7_days)} — abaixo de 20% do valor atual.`,
      value: prediction.balance_7_days,
      action_label: 'Ver Fluxo',
      created_at: now(),
    });
  }

  // ── PART 5: Aceleração de gastos ──────────────────────────────────────────
  if (lastExpenses > 0 && currentExpenses > lastExpenses * 1.15) {
    const pct = Math.round(((currentExpenses - lastExpenses) / lastExpenses) * 100);
    const sev = pct > 40 ? 'high' : pct > 20 ? 'medium' : 'low';
    actions.push({
      id: makeId(), type: 'warning', severity: sev,
      title: 'Aumento de gastos detectado',
      description: `Seus gastos este mês (${formatCurrency(currentExpenses)}) estão ${pct}% acima do mês anterior (${formatCurrency(lastExpenses)}).`,

      value: currentExpenses - lastExpenses,
      action_label: 'Ver Histórico',
      created_at: now(),
    });
  }

  // ── PART 6: Detecção de assinaturas ──────────────────────────────────────
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentTxs = base.filter(t => new Date(t.date) >= last90);

  const subTxs = recentTxs.filter(t =>
    t.type === TransactionType.DESPESA &&
    (matchKeywords(t.description, SUBSCRIPTION_KEYWORDS) ||
     matchKeywords(t.merchant ?? '', SUBSCRIPTION_KEYWORDS) ||
     t.recurring === true)
  );

  if (subTxs.length > 0) {
    const subTotal = subTxs.reduce((s, t) => s + t.amount, 0);
    const monthlyEst = subTotal / 3; // média 3 meses
    const uniqueSubs = new Set(subTxs.map(t => t.description.toLowerCase())).size;
    actions.push({
      id: makeId(), type: 'insight', severity: 'low',
      title: 'Gastos com assinaturas',
      description: `Você tem ${uniqueSubs} assinatura(s) recorrente(s) com custo estimado de ${formatCurrency(monthlyEst)}/mês. Revise se todas estão sendo usadas.`,

      value: monthlyEst,
      category: 'Assinaturas',
      action_label: 'Revisar',
      created_at: now(),
    });
  }

  // ── Delivery / conveniência ────────────────────────────────────────────────
  const deliveryTxs = recentTxs.filter(t =>
    t.type === TransactionType.DESPESA &&
    matchKeywords(t.description, DELIVERY_KEYWORDS)
  );
  if (deliveryTxs.length >= 4) {
    const deliveryTotal = deliveryTxs.reduce((s, t) => s + t.amount, 0);
    const monthlyEst = deliveryTotal / 3;
    actions.push({
      id: makeId(), type: 'suggestion', severity: 'medium',
      title: 'Alto gasto com delivery',
      description: `Você gastou ${formatCurrency(deliveryTotal)} com delivery nos últimos 90 dias (~${formatCurrency(monthlyEst)}/mês). Preparar refeições em casa pode gerar economia significativa.`,

      value: monthlyEst,
      category: 'Alimentação',
      action_label: 'Ver Gastos',
      created_at: now(),
    });
  }

  // ── PART 7: Oportunidade de economia por categoria ────────────────────────
  const catMap: Record<string, number> = {};
  for (const t of base.filter(t => t.type === TransactionType.DESPESA)) {
    catMap[t.category] = (catMap[t.category] ?? 0) + t.amount;
  }
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  if (topCats.length > 0) {
    const [topCat, topAmt] = topCats[0];
    const totalAll = Object.values(catMap).reduce((s, v) => s + v, 0);
    const pct = totalAll > 0 ? Math.round((topAmt / totalAll) * 100) : 0;

    if (pct > 40) {
      const potential = topAmt * 0.1;
      actions.push({
        id: makeId(), type: 'optimization', severity: 'medium',
        title: 'Potencial de economia identificado',
        description: `"${topCat}" representa ${pct}% dos seus gastos totais (${formatCurrency(topAmt)}). Reduzir 10% nessa categoria pouparia ${formatCurrency(potential)}.`,

        value: potential,
        category: topCat,
        action_label: 'Criar Meta',
        created_at: now(),
      });
    }
  }

  // ── Sem reserva de emergência ──────────────────────────────────────────────
  const totalIncome = base
    .filter(t => t.type === TransactionType.RECEITA)
    .reduce((s, t) => s + t.amount, 0);
  const emergencyTarget = prediction.projected_expenses * 3;

  if (prediction.current_balance < emergencyTarget && prediction.current_balance > 0) {
    actions.push({
      id: makeId(), type: 'suggestion', severity: 'low',
      title: 'Reserva de emergência abaixo do ideal',
      description: `O recomendado é ter ${formatCurrency(emergencyTarget)} de reserva (3 meses de despesas). Seu saldo atual é ${formatCurrency(prediction.current_balance)}.`,

      value: emergencyTarget - prediction.current_balance,
      action_label: 'Criar Meta',
      created_at: now(),
    });
  }

  // ── Receita vs despesa saudável ────────────────────────────────────────────
  if (prediction.projected_income > 0 && prediction.projected_expenses > 0) {
    const savingRate = (prediction.projected_income - prediction.projected_expenses) / prediction.projected_income;
    if (savingRate > 0.25) {
      actions.push({
        id: makeId(), type: 'insight', severity: 'low',
        title: 'Fluxo financeiro saudável',
        description: `Com base nos seus dados, você está poupando cerca de ${Math.round(savingRate * 100)}% da sua renda projetada. Continue assim!`,
        value: savingRate,
        action_label: 'Ver Insights',
        created_at: now(),
      });
    }
  }

  // ── Muitas transações pequenas ────────────────────────────────────────────
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const smallRecent = base.filter(t =>
    t.type === TransactionType.DESPESA &&
    t.amount < 30 &&
    new Date(t.date) >= last30
  );
  if (smallRecent.length >= 8) {
    const smallTotal = smallRecent.reduce((s, t) => s + t.amount, 0);
    actions.push({
      id: makeId(), type: 'optimization', severity: 'low',
      title: 'Microgastos acumulados',
      description: `${smallRecent.length} compras abaixo de R$30 nos últimos 30 dias totalizaram ${formatCurrency(smallTotal)}. Pequenos gastos frequentes somam mais do que parecem.`,

      value: smallTotal,
      action_label: 'Ver Histórico',
      created_at: now(),
    });
  }

  // ── PART 5: Graph-powered actions ─────────────────────────────────────────
  try {
    const graph    = buildFinancialGraph('local', accounts, base);
    const topMerch = getTopMerchants(graph, 3);
    const catSpend = getCategorySpending(graph);
    const subCands = detectSubscriptionCandidates(graph);

    // Action: merchant concentration risk
    if (topMerch.length > 0) {
      const totalSpend = catSpend.reduce((s, c) => s + c.total, 0);
      const topPct = totalSpend > 0 ? topMerch[0].total_spent / totalSpend : 0;
      if (topPct > 0.4) {
        actions.push({
          id: makeId(), type: 'optimization', severity: 'medium',
          title: 'Alta concentração em único estabelecimento',
          description: `${Math.round(topPct * 100)}% dos seus gastos estão concentrados em "${topMerch[0].name}". Diversifique para ter melhor controle financeiro.`,
          value: topMerch[0].total_spent,
          category: 'Grafo',
          action_label: 'Ver Detalhes',
          created_at: now(),
        });
      }
    }

    // Action: rising category from graph trend
    const risingCat = catSpend.find(c => c.trend === 'up' && c.percentage > 15);
    if (risingCat) {
      actions.push({
        id: makeId(), type: 'warning', severity: 'medium',
        title: `Categoria "${risingCat.name}" em crescimento`,
        description: `O grafo detectou tendência de alta nesta categoria (${risingCat.percentage.toFixed(1)}% dos gastos). Principais estabelecimentos: ${risingCat.top_merchants.slice(0, 2).join(', ')}.`,
        value: risingCat.total,
        category: risingCat.name,
        action_label: 'Revisar',
        created_at: now(),
      });
    }

    // Action: unconfirmed subscription candidates
    const unconfirmed = subCands.filter(s => !s.is_confirmed_subscription && s.visit_count >= 3);
    if (unconfirmed.length > 0) {
      const estimatedMonthly = unconfirmed.reduce((s, c) => s + c.estimated_amount, 0);
      actions.push({
        id: makeId(), type: 'suggestion', severity: 'low',
        title: 'Possíveis assinaturas não categorizadas',
        description: `O grafo identificou ${unconfirmed.length} pagamento(s) recorrente(s) que pode(m) ser assinatura(s): ${unconfirmed.slice(0, 2).map(s => s.name).join(', ')}. Custo estimado: ${formatCurrency(estimatedMonthly)}/mês.`,

        value: estimatedMonthly,
        category: 'Assinaturas',
        action_label: 'Revisar',
        created_at: now(),
      });
    }
  } catch (_) { /* graph unavailable — skip */ }

  // Ordenar: high → medium → low, warnings primeiro
  const severityOrder = { high: 0, medium: 1, low: 2 };
  const typeOrder = { warning: 0, suggestion: 1, optimization: 2, insight: 3 };
  actions.sort((a, b) => {
    const tDiff = typeOrder[a.type] - typeOrder[b.type];
    if (tDiff !== 0) return tDiff;
    return (severityOrder[a.severity ?? 'low']) - (severityOrder[b.severity ?? 'low']);
  });

  return actions;
}

// ─── PART 8 — Memory learning ─────────────────────────────────────────────────

export async function learnAutopilotPatterns(
  userId: string,
  accounts: Account[],
  transactions: Transaction[],
  prediction: CashflowPrediction
): Promise<void> {
  const base = transactions.filter(t => !t.generated);
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recent = base.filter(t => new Date(t.date) >= last90);

  const hasDelivery = recent.some(t => matchKeywords(t.description, DELIVERY_KEYWORDS));
  if (hasDelivery) {
    await learnMemory(userId, 'high_delivery_spending', 'true', 0.8);
  }

  const hasSubs = recent.some(t =>
    matchKeywords(t.description, SUBSCRIPTION_KEYWORDS) || t.recurring
  );
  if (hasSubs) {
    await learnMemory(userId, 'subscription_user', 'true', 0.9);
  }

  if (prediction.balance_30_days < 0) {
    await learnMemory(userId, 'negative_forecast_risk', 'true', 0.95);
  }

  const totalAccountBalance = accounts.reduce((s, a) => s + a.balance, 0);
  if (totalAccountBalance > 0) {
    await learnMemory(userId, 'has_accounts', String(accounts.length), 0.9);
  }

  const recurrings = base.filter(t => t.recurring).length;
  if (recurrings >= 3) {
    await learnMemory(userId, 'uses_recurring', 'true', 0.85);
  }
}
