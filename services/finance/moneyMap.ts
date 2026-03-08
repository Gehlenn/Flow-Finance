import { Transaction, TransactionType, Category } from '../../types';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface MoneyDistributionItem {
  category: string;
  percentage: number;
  amount: number;
  count: number;
  color: string;
  trend: 'up' | 'down' | 'stable';  // vs. mês anterior
}

export interface MoneyMapData {
  distribution: MoneyDistributionItem[];
  total_expenses: number;
  total_income: number;
  net: number;
  period_label: string;
  top_category: MoneyDistributionItem | null;
  income_distribution: MoneyDistributionItem[];
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  [Category.PESSOAL]:    '#6366f1',
  [Category.CONSULTORIO]:'#8b5cf6',
  [Category.NEGOCIO]:    '#0ea5e9',
  [Category.INVESTIMENTO]:'#10b981',
  'Outros':              '#94a3b8',
};

// ─── PART 6 — calculateMoneyDistribution ─────────────────────────────────────

export function calculateMoneyDistribution(
  transactions: Transaction[],
  periodDays: number = 30
): MoneyMapData {
  const base = transactions.filter(t => !t.generated);
  const now = new Date();
  const cutoff = new Date(now.getTime() - periodDays * 86400000);
  const prevCutoff = new Date(cutoff.getTime() - periodDays * 86400000);

  // Transações do período atual
  const current = base.filter(t => new Date(t.date) >= cutoff);
  // Transações do período anterior (para trend)
  const previous = base.filter(t => {
    const d = new Date(t.date);
    return d >= prevCutoff && d < cutoff;
  });

  const expenses  = current.filter(t => t.type === TransactionType.DESPESA);
  const incomes   = current.filter(t => t.type === TransactionType.RECEITA);
  const prevExpenses = previous.filter(t => t.type === TransactionType.DESPESA);

  const total_expenses = expenses.reduce((s, t) => s + t.amount, 0);
  const total_income   = incomes.reduce((s, t) => s + t.amount, 0);

  // Agrupar despesas por categoria
  const catMap: Record<string, { amount: number; count: number }> = {};
  for (const t of expenses) {
    const cat = t.category ?? 'Outros';
    if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
    catMap[cat].amount += t.amount;
    catMap[cat].count++;
  }

  // Agrupar despesas anteriores por categoria
  const prevCatMap: Record<string, number> = {};
  for (const t of prevExpenses) {
    const cat = t.category ?? 'Outros';
    prevCatMap[cat] = (prevCatMap[cat] ?? 0) + t.amount;
  }

  // Construir distribution
  const distribution: MoneyDistributionItem[] = Object.entries(catMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([category, data]) => {
      const prevAmt = prevCatMap[category] ?? 0;
      const trend: MoneyDistributionItem['trend'] =
        prevAmt === 0    ? 'stable'
        : data.amount > prevAmt * 1.05 ? 'up'
        : data.amount < prevAmt * 0.95 ? 'down'
        : 'stable';

      return {
        category,
        percentage: total_expenses > 0
          ? parseFloat(((data.amount / total_expenses) * 100).toFixed(1))
          : 0,
        amount: data.amount,
        count: data.count,
        color: CATEGORY_COLORS[category] ?? '#94a3b8',
        trend,
      };
    });

  // Distribuição de receitas
  const incomeCatMap: Record<string, { amount: number; count: number }> = {};
  for (const t of incomes) {
    const cat = t.category ?? 'Outros';
    if (!incomeCatMap[cat]) incomeCatMap[cat] = { amount: 0, count: 0 };
    incomeCatMap[cat].amount += t.amount;
    incomeCatMap[cat].count++;
  }

  const income_distribution: MoneyDistributionItem[] = Object.entries(incomeCatMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([category, data]) => ({
      category,
      percentage: total_income > 0
        ? parseFloat(((data.amount / total_income) * 100).toFixed(1))
        : 0,
      amount: data.amount,
      count: data.count,
      color: CATEGORY_COLORS[category] ?? '#94a3b8',
      trend: 'stable',
    }));

  const period_label = periodDays === 7  ? 'Últimos 7 dias'
                     : periodDays === 30 ? 'Últimos 30 dias'
                     : periodDays === 90 ? 'Últimos 90 dias'
                     : `Últimos ${periodDays} dias`;

  return {
    distribution,
    total_expenses,
    total_income,
    net: total_income - total_expenses,
    period_label,
    top_category: distribution[0] ?? null,
    income_distribution,
  };
}

// ─── Mini chart data (para sparklines no dashboard) ──────────────────────────

export function getWeeklySpendingByCategory(
  transactions: Transaction[],
  weeks: number = 4
): { week: string; [category: string]: number | string }[] {
  const base = transactions.filter(t => !t.generated && t.type === TransactionType.DESPESA);
  const result: { week: string; [category: string]: number | string }[] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const end   = new Date(Date.now() - w * 7 * 86400000);
    const start = new Date(Date.now() - (w + 1) * 7 * 86400000);
    const weekTxs = base.filter(t => {
      const d = new Date(t.date);
      return d >= start && d < end;
    });
    const entry: { week: string; [cat: string]: number | string } = {
      week: `S${weeks - w}`,
    };
    for (const t of weekTxs) {
      const cat = t.category ?? 'Outros';
      entry[cat] = ((entry[cat] as number) ?? 0) + t.amount;
    }
    result.push(entry);
  }

  return result;
}
