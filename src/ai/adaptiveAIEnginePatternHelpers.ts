import { Transaction, TransactionType } from '../../types';
import { makeId } from '../../utils/helpers';
import { parseAdaptiveDate, getRecentTxs } from './adaptiveAIEngineHelpers';
import type { FinancialPattern } from './adaptiveAIEngine';

function buildPattern(
  type: FinancialPattern['type'],
  value: string,
  confidence: number,
): FinancialPattern {
  return {
    id: makeId(),
    type,
    value,
    confidence,
    updated_at: new Date().toISOString(),
  };
}

export function detectWeekendSpendingPattern(expenses: Transaction[]): FinancialPattern[] {
  const patterns: FinancialPattern[] = [];
  const weekendExp = expenses.filter((transaction) => {
    const day = parseAdaptiveDate(transaction.date)?.getDay();
    return day === 0 || day === 6;
  });
  const weekdayExp = expenses.filter((transaction) => {
    const day = parseAdaptiveDate(transaction.date)?.getDay();
    return typeof day === 'number' && day >= 1 && day <= 5;
  });

  if (weekdayExp.length === 0 || weekendExp.length === 0) return patterns;

  const avgWeekend = weekendExp.reduce((sum, transaction) => sum + transaction.amount, 0) / weekendExp.length;
  const avgWeekday = weekdayExp.reduce((sum, transaction) => sum + transaction.amount, 0) / weekdayExp.length;
  const ratio = avgWeekend / avgWeekday;

  if (ratio > 1.3) {
    patterns.push(
      buildPattern('weekend_spending', ratio > 2 ? 'very_high' : 'high', Math.min(0.95, 0.5 + weekendExp.length * 0.03)),
    );
  } else if (ratio < 0.7) {
    patterns.push(buildPattern('weekend_spending', 'low', Math.min(0.9, 0.5 + weekendExp.length * 0.03)));
  }

  return patterns;
}

export function detectFrequentMerchantPatterns(base: Transaction[]): FinancialPattern[] {
  const patterns: FinancialPattern[] = [];
  const merchantFreq: Record<string, { count: number; total: number; category: string }> = {};

  for (const transaction of base) {
    const key = (transaction.merchant || transaction.description).toLowerCase().replace(/\s+/g, '_').slice(0, 30);
    if (!merchantFreq[key]) merchantFreq[key] = { count: 0, total: 0, category: transaction.category };
    merchantFreq[key].count += 1;
    merchantFreq[key].total += transaction.amount;
  }

  const topMerchants = Object.entries(merchantFreq)
    .filter(([, value]) => value.count >= 3)
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 5);

  for (const [name, data] of topMerchants) {
    patterns.push(
      buildPattern('frequent_merchant', name, Math.min(0.95, 0.5 + data.count * 0.05)),
    );
  }

  return patterns;
}

export function detectSalaryPattern(base: Transaction[]): FinancialPattern[] {
  const patterns: FinancialPattern[] = [];
  const incomes = base
    .filter((transaction) => transaction.type === TransactionType.RECEITA)
    .map((transaction) => parseAdaptiveDate(transaction.date)?.getDate())
    .filter((day): day is number => typeof day === 'number')
    .sort((left, right) => left - right);

  if (incomes.length < 2) return patterns;

  const dayFreq: Record<number, number> = {};
  for (const day of incomes) dayFreq[day] = (dayFreq[day] ?? 0) + 1;
  const topDay = Object.entries(dayFreq).sort((left, right) => right[1] - left[1])[0];
  const topDayCount = topDay ? Number(topDay[1]) : 0;

  if (topDay && topDayCount >= 2) {
    patterns.push(buildPattern('salary_day', topDay[0], Math.min(0.95, 0.5 + topDayCount * 0.1)));
  }

  return patterns;
}

export function detectDeliveryPattern(base: Transaction[]): FinancialPattern[] {
  const patterns: FinancialPattern[] = [];
  const deliveryKeywords = ['ifood', 'rappi', 'uber eats', 'delivery', 'james', '99food', 'entrega', 'pedido'];
  const deliveryTxs = getRecentTxs(base, 90).filter(
    (transaction) =>
      transaction.type === TransactionType.DESPESA &&
      deliveryKeywords.some((keyword) => (transaction.description + (transaction.merchant ?? '')).toLowerCase().includes(keyword)),
  );

  if (deliveryTxs.length >= 3) {
    const monthlyEst = deliveryTxs.reduce((sum, transaction) => sum + transaction.amount, 0) / 3;
    patterns.push(
      buildPattern('delivery_pattern', monthlyEst > 200 ? 'heavy' : monthlyEst > 80 ? 'moderate' : 'light', Math.min(0.95, 0.5 + deliveryTxs.length * 0.05)),
    );
  }

  return patterns;
}

export function detectCategoryPreferencePattern(expenses: Transaction[]): FinancialPattern[] {
  const patterns: FinancialPattern[] = [];
  const catTotals: Record<string, number> = {};
  for (const transaction of expenses) {
    catTotals[transaction.category] = (catTotals[transaction.category] ?? 0) + transaction.amount;
  }

  const totalExp = Object.values(catTotals).reduce((sum, value) => sum + value, 0);
  if (totalExp <= 0) return patterns;

  const dominantCat = Object.entries(catTotals).sort((left, right) => right[1] - left[1])[0];
  if (dominantCat && dominantCat[1] / totalExp > 0.35) {
    patterns.push(
      buildPattern('category_preference', dominantCat[0], Math.min(0.9, dominantCat[1] / totalExp)),
    );
  }

  return patterns;
}
