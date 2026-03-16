import { Category, Transaction, TransactionType } from '../../../types';

export type FinancialProfile = 'Saver' | 'Spender' | 'Balanced' | 'Risk Taker' | 'Undefined';

export interface CategoryBreakdown {
  category: Category;
  total: number;
  share: number;
}

export interface FinancialProfileResult {
  profile: FinancialProfile;
  savingsRate: number;
  income: number;
  expenses: number;
  confidence: number;
  topCategories: CategoryBreakdown[];
  insights: string[];
}

const MIN_TRANSACTIONS_FOR_CONFIDENCE = 5;

function buildCategoryBreakdown(transactions: Transaction[]): CategoryBreakdown[] {
  const totals = new Map<Category, number>();

  for (const tx of transactions) {
    if (tx.type !== TransactionType.DESPESA) continue;
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount);
  }

  const grandTotal = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);
  if (grandTotal === 0) return [];

  return Array.from(totals.entries())
    .map(([category, total]) => ({
      category,
      total: Number(total.toFixed(2)),
      share: Number((total / grandTotal).toFixed(4)),
    }))
    .sort((a, b) => b.total - a.total);
}

function buildInsights(profile: FinancialProfile, savingsRate: number, topCategories: CategoryBreakdown[]): string[] {
  const insights: string[] = [];
  const topCat = topCategories[0];

  switch (profile) {
    case 'Saver':
      insights.push(`Parabéns! Você poupa ${(savingsRate * 100).toFixed(0)}% da renda — acima da meta recomendada de 20%.`);
      if (topCat) insights.push(`Maior categoria de gasto: ${topCat.category} (${(topCat.share * 100).toFixed(0)}% das despesas).`);
      insights.push('Considere diversificar investimentos para o excedente poupado.');
      break;
    case 'Spender':
      insights.push(`Atenção: despesas superam renda em ${(Math.abs(savingsRate) * 100).toFixed(0)}%.`);
      if (topCat) insights.push(`Revise os gastos em ${topCat.category} — representa ${(topCat.share * 100).toFixed(0)}% das despesas.`);
      insights.push('Estabeleça um orçamento mensal por categoria para reverter o deficit.');
      break;
    case 'Risk Taker':
      insights.push(`Taxa de poupança muito baixa (${(savingsRate * 100).toFixed(0)}%) — reserva de emergência em risco.`);
      if (topCat) insights.push(`Categoria dominante: ${topCat.category} (${(topCat.share * 100).toFixed(0)}% das despesas).`);
      insights.push('Meta prioritária: construir reserva de 3-6 meses de despesas.');
      break;
    case 'Balanced':
      insights.push(`Perfil equilibrado com poupança de ${(savingsRate * 100).toFixed(0)}% — dentro do intervalo saudável.`);
      if (topCat) insights.push(`Principal despesa: ${topCat.category} (${(topCat.share * 100).toFixed(0)}%).`);
      insights.push('Para evoluir ao perfil Saver, tente aumentar a poupança em 5% ao mês.');
      break;
    case 'Undefined':
      insights.push('Dados insuficientes para análise detalhada.');
      insights.push('Adicione mais transações para receber insights personalizados.');
      break;
  }

  return insights;
}

export function classifyFinancialProfile(transactions: Transaction[]): FinancialProfileResult {
  const income = transactions
    .filter((t) => t.type === TransactionType.RECEITA)
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.type === TransactionType.DESPESA)
    .reduce((sum, t) => sum + t.amount, 0);

  const topCategories = buildCategoryBreakdown(transactions);

  if (transactions.length === 0) {
    return {
      profile: 'Undefined',
      savingsRate: 0,
      income: 0,
      expenses: 0,
      confidence: 0,
      topCategories: [],
      insights: buildInsights('Undefined', 0, []),
    };
  }

  // Confidence scales with transaction volume and data diversity
  const volumeScore = Math.min(1, transactions.length / MIN_TRANSACTIONS_FOR_CONFIDENCE);
  const diversityScore = topCategories.length > 1 ? 1 : 0.6;
  const confidence = Number((volumeScore * diversityScore).toFixed(2));

  if (income <= 0) {
    return {
      profile: 'Risk Taker',
      savingsRate: -1,
      income,
      expenses,
      confidence,
      topCategories,
      insights: buildInsights('Risk Taker', -1, topCategories),
    };
  }

  const savingsRate = (income - expenses) / income;

  let profile: FinancialProfile;
  if (savingsRate >= 0.3) {
    profile = 'Saver';
  } else if (savingsRate < 0) {
    profile = 'Spender';
  } else if (savingsRate <= 0.05) {
    profile = 'Risk Taker';
  } else {
    profile = 'Balanced';
  }

  return {
    profile,
    savingsRate,
    income,
    expenses,
    confidence,
    topCategories,
    insights: buildInsights(profile, savingsRate, topCategories),
  };
}
