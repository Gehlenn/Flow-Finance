/**
 * FINANCIAL REPORT ENGINE — Geração de relatórios financeiros automáticos
 *
 * Gera relatórios mensais com insights e análises.
 */

import { Transaction, TransactionType } from '../../types';
import { sumTransactions } from '../security/moneyMath';

export interface FinancialReport {
  month: string; // YYYY-MM
  total_income: number;
  total_expenses: number;
  top_categories: Array<{ category: string; amount: number; percentage: number }>;
  insights: string[];
}

/**
 * Gera relatório financeiro mensal.
 */
export function generateMonthlyReport(transactions: Transaction[]): FinancialReport {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Filtrar transações do mês atual
  const monthTxs = transactions.filter(tx => tx.date.startsWith(currentMonth));

  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals: Record<string, number> = {};

  for (const tx of monthTxs) {
    if (tx.type === TransactionType.RECEITA) {
      totalIncome += tx.amount;
    } else if (tx.type === TransactionType.DESPESA) {
      totalExpenses += tx.amount;
      const category = tx.category || 'Outros';
      categoryTotals[category] = (categoryTotals[category] || 0) + tx.amount;
    }
  }

  // Top categorias
  const topCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Insights
  const insights: string[] = [];

  if (totalIncome > 0) {
    const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;
    if (savingsRate > 20) {
      insights.push(`Taxa de poupança excelente: ${savingsRate.toFixed(1)}%`);
    } else if (savingsRate < 0) {
      insights.push(`Atenção: gastos superam receitas em ${(savingsRate * -1).toFixed(1)}%`);
    }
  }

  // Comparar com mês anterior
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthTxs = transactions.filter(tx => tx.date.startsWith(prevMonthStr));
  const prevExpenses = prevMonthTxs
    .filter(tx => tx.type === TransactionType.DESPESA)
    .reduce((s, tx) => s + tx.amount, 0);

  if (prevExpenses > 0) {
    const change = ((totalExpenses - prevExpenses) / prevExpenses) * 100;
    if (Math.abs(change) > 10) {
      const direction = change > 0 ? 'aumentaram' : 'diminuíram';
      insights.push(`Seus gastos ${direction} ${Math.abs(change).toFixed(1)}% em relação ao mês passado.`);
    }
  }

  return {
    month: currentMonth,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    top_categories: topCategories,
    insights,
  };
}