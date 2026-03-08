import { Transaction, TransactionType, Category } from '../../types';
import { Account } from '../../models/Account';
import { makeId, now, formatCurrency } from '../../utils/helpers';

// ─── Model (PART 1) ───────────────────────────────────────────────────────────

export interface AIInsight {
  id: string;
  user_id: string;
  type: 'spending' | 'saving' | 'warning';
  message: string;
  severity?: 'low' | 'medium' | 'high';
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthTransactions(transactions: Transaction[], monthsAgo: number): Transaction[] {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const targetEnd = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d >= target && d <= targetEnd;
  });
}

function totalExpenses(txs: Transaction[]): number {
  return txs
    .filter(t => t.type === TransactionType.DESPESA && !t.generated)
    .reduce((sum, t) => sum + t.amount, 0);
}

// ─── PART 2: generateFinancialInsights ────────────────────────────────────────

export function generateFinancialInsights(
  transactions: Transaction[],
  userId: string = 'local',
  accounts: Account[] = []
): AIInsight[] {
  const insights: AIInsight[] = [];
  const baseTxs = transactions.filter(t => !t.generated);

  // ── 1. Aumento de gastos mês a mês ──────────────────────────────────────
  const currentMonthTxs = getMonthTransactions(baseTxs, 0);
  const lastMonthTxs = getMonthTransactions(baseTxs, 1);
  const currentExpenses = totalExpenses(currentMonthTxs);
  const lastExpenses = totalExpenses(lastMonthTxs);

  if (lastExpenses > 0 && currentExpenses > lastExpenses * 1.2) {
    const pct = Math.round(((currentExpenses - lastExpenses) / lastExpenses) * 100);
    insights.push({
      id: makeId(), user_id: userId, type: 'warning',
      message: `Seus gastos aumentaram ${pct}% este mês em relação ao mês anterior.`,
      severity: pct > 50 ? 'high' : 'medium',
      created_at: now(),
    });
  }

  // ── 2. Categoria dominante ───────────────────────────────────────────────
  const categoryTotals: Partial<Record<Category, number>> = {};
  for (const t of currentMonthTxs.filter(t => t.type === TransactionType.DESPESA)) {
    categoryTotals[t.category] = (categoryTotals[t.category] ?? 0) + t.amount;
  }
  const entries = Object.entries(categoryTotals) as [Category, number][];
  if (entries.length > 0) {
    const [topCat, topAmt] = entries.sort((a, b) => b[1] - a[1])[0];
    const formatted = formatCurrency(topAmt);
    insights.push({
      id: makeId(), user_id: userId, type: 'spending',
      message: `Sua maior categoria de gastos este mês é "${topCat}" com ${formatted}.`,
      severity: 'low',
      created_at: now(),
    });
  }

  // ── 3. Pequenas compras frequentes ──────────────────────────────────────
  const smallPurchases = baseTxs.filter(t =>
    t.type === TransactionType.DESPESA && t.amount < 50
  );
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentSmall = smallPurchases.filter(t => new Date(t.date) >= last30);

  if (recentSmall.length >= 5) {
    const totalSmall = recentSmall.reduce((sum, t) => sum + t.amount, 0);
    const formatted = formatCurrency(totalSmall);
    insights.push({
      id: makeId(), user_id: userId, type: 'warning',
      message: `Você fez ${recentSmall.length} pequenas compras nos últimos 30 dias, totalizando ${formatted}.`,
      severity: 'medium',
      created_at: now(),
    });
  }

  // ── 4. Saldo positivo / economia ─────────────────────────────────────────
  const allIncome = baseTxs
    .filter(t => t.type === TransactionType.RECEITA)
    .reduce((sum, t) => sum + t.amount, 0);
  const allExpenses = baseTxs
    .filter(t => t.type === TransactionType.DESPESA)
    .reduce((sum, t) => sum + t.amount, 0);
  const savingRate = allIncome > 0 ? (allIncome - allExpenses) / allIncome : 0;

  if (savingRate > 0.3) {
    insights.push({
      id: makeId(), user_id: userId, type: 'saving',
      message: `Excelente! Você está guardando ${Math.round(savingRate * 100)}% do seu rendimento.`,
      severity: 'low',
      created_at: now(),
    });
  } else if (savingRate < 0) {
    insights.push({
      id: makeId(), user_id: userId, type: 'warning',
      message: `Atenção: seus gastos superam suas receitas registradas.`,
      severity: 'high',
      created_at: now(),
    });
  }

  // ── PART 5: Graph-powered insights ───────────────────────────────────────
  // Lazy-import to avoid circular deps; only when accounts available
  if (accounts.length > 0 && baseTxs.length >= 3) {
    try {
      const { buildFinancialGraph, getTopMerchants, getCategorySpending, detectSubscriptionCandidates } =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./financialGraph') as typeof import('./financialGraph');

      const graph    = buildFinancialGraph(userId, accounts, transactions);
      const topMerch = getTopMerchants(graph, 1);
      const catSpend = getCategorySpending(graph);
      const subCands = detectSubscriptionCandidates(graph);

      // Insight: single merchant dominance (>35% of total spending)
      if (topMerch.length > 0 && catSpend.length > 0) {
        const totalSpend = catSpend.reduce((s, c) => s + c.total, 0);
        const topMerchPct = totalSpend > 0 ? topMerch[0].total_spent / totalSpend : 0;
        if (topMerchPct > 0.35) {
          const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
          insights.push({
            id: makeId(), user_id: userId, type: 'spending',
            message: `${Math.round(topMerchPct * 100)}% dos seus gastos concentram-se em "${topMerch[0].name}" (${fmt(topMerch[0].total_spent)}). Considere diversificar.`,
            severity: topMerchPct > 0.5 ? 'high' : 'medium',
            created_at: now(),
          });
        }
      }

      // Insight: category trend alert
      const risingCat = catSpend.find(c => c.trend === 'up' && c.percentage > 20);
      if (risingCat) {
        insights.push({
          id: makeId(), user_id: userId, type: 'warning',
          message: `Gastos em "${risingCat.name}" estão em alta e representam ${risingCat.percentage.toFixed(1)}% das suas despesas.`,
          severity: 'medium',
          created_at: now(),
        });
      }

      // Insight: unreviewed subscription candidates
      const unconfirmed = subCands.filter(s => !s.is_confirmed_subscription && s.visit_count >= 3);
      if (unconfirmed.length > 0) {
        insights.push({
          id: makeId(), user_id: userId, type: 'warning',
          message: `O grafo detectou ${unconfirmed.length} possível(is) assinatura(s) não confirmada(s). Revise: ${unconfirmed.slice(0, 2).map(s => s.name).join(', ')}.`,
          severity: 'low',
          created_at: now(),
        });
      }
    } catch (_) { /* graph not available — skip graph insights */ }
  }

  return insights;
}
