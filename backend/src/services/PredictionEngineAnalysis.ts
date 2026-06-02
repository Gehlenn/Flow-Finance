import type {
  DailyPrediction,
  PredictionFactor,
  SeasonalPattern,
  TransactionHistory,
  TrendAnalysis,
} from '../types/prediction';
import { StatisticsUtils } from './PredictionEngineHelpers';

export function calculateDailyBalances(
  transactions: TransactionHistory['transactions'],
): { date: Date; balance: number; income: number; expenses: number }[] {
  const sorted = [...transactions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const dailyMap = new Map<string, { date: Date; income: number; expenses: number }>();

  for (const t of sorted) {
    const dateKey = new Date(t.date).toISOString().split('T')[0];
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { date: new Date(t.date), income: 0, expenses: 0 });
    }
    const day = dailyMap.get(dateKey)!;
    if (t.type === 'income') {
      day.income += t.amount;
    } else {
      day.expenses += Math.abs(t.amount);
    }
  }

  const dailyBalances: { date: Date; balance: number; income: number; expenses: number }[] = [];
  let runningBalance = 0;

  for (const [, day] of dailyMap) {
    runningBalance += day.income - day.expenses;
    dailyBalances.push({
      date: day.date,
      balance: runningBalance,
      income: day.income,
      expenses: day.expenses,
    });
  }

  return dailyBalances;
}

export function groupByCategory(
  transactions: TransactionHistory['transactions'],
): Record<string, TransactionHistory['transactions']> {
  return transactions.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, TransactionHistory['transactions']>);
}

export function detectWeeklyPattern(
  category: string,
  transactions: TransactionHistory['transactions'],
): SeasonalPattern | null {
  if (transactions.length < 4) return null;

  const byDayOfWeek: Record<number, number[]> = {};
  for (const t of transactions) {
    const day = new Date(t.date).getDay();
    if (!byDayOfWeek[day]) byDayOfWeek[day] = [];
    byDayOfWeek[day].push(t.amount);
  }

  let bestDay: number | null = null;
  let bestConfidence = 0;

  for (const [day, amounts] of Object.entries(byDayOfWeek)) {
    if (amounts.length >= 3) {
      const stdDev = StatisticsUtils.stdDev(amounts);
      const mean = StatisticsUtils.mean(amounts);
      const cv = mean === 0 ? Infinity : stdDev / Math.abs(mean);
      const confidence = Math.max(0, 1 - cv);

      if (confidence > bestConfidence && confidence > 0.5) {
        bestConfidence = confidence;
        bestDay = parseInt(day);
      }
    }
  }

  if (bestDay === null) return null;

  return {
    type: 'weekly',
    dayOfWeek: bestDay,
    category,
    averageAmount: StatisticsUtils.mean(byDayOfWeek[bestDay]),
    confidence: Math.round(bestConfidence * 100) / 100,
    sampleSize: byDayOfWeek[bestDay].length,
  };
}

export function detectMonthlyPattern(
  category: string,
  transactions: TransactionHistory['transactions'],
): SeasonalPattern | null {
  if (transactions.length < 3) return null;

  const byDayOfMonth: Record<number, number[]> = {};
  for (const t of transactions) {
    const day = new Date(t.date).getDate();
    if (!byDayOfMonth[day]) byDayOfMonth[day] = [];
    byDayOfMonth[day].push(t.amount);
  }

  let bestDay: number | null = null;
  let bestConfidence = 0;

  for (const [day, amounts] of Object.entries(byDayOfMonth)) {
    if (amounts.length >= 2) {
      const stdDev = StatisticsUtils.stdDev(amounts);
      const mean = StatisticsUtils.mean(amounts);
      const cv = mean === 0 ? Infinity : stdDev / Math.abs(mean);
      const confidence = Math.max(0, 1 - cv);

      if (confidence > bestConfidence && confidence > 0.5) {
        bestConfidence = confidence;
        bestDay = parseInt(day);
      }
    }
  }

  if (bestDay === null) return null;

  return {
    type: 'monthly',
    dayOfMonth: bestDay,
    category,
    averageAmount: StatisticsUtils.mean(byDayOfMonth[bestDay]),
    confidence: Math.round(bestConfidence * 100) / 100,
    sampleSize: byDayOfMonth[bestDay].length,
  };
}

export function generateDailyPredictions(
  dailyBalances: { date: Date; balance: number; income: number; expenses: number }[],
  seasonalPatterns: SeasonalPattern[],
  trend: TrendAnalysis,
  startingBalance: number,
  days: number,
): DailyPrediction[] {
  const predictions: DailyPrediction[] = [];
  let currentBalance = startingBalance;
  const now = new Date();

  const avgDailyIncome = StatisticsUtils.mean(
    dailyBalances.map(d => d.income).filter(v => v > 0),
  ) || 0;
  const avgDailyExpense = StatisticsUtils.mean(
    dailyBalances.map(d => d.expenses).filter(v => v > 0),
  ) || 0;

  for (let i = 1; i <= days; i++) {
    const predictionDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const trendAdjustment = trend.slope * i;

    let seasonalIncomeAdjustment = 0;
    let seasonalExpenseAdjustment = 0;

    for (const pattern of seasonalPatterns) {
      if (pattern.type === 'weekly' && pattern.dayOfWeek === predictionDate.getDay()) {
        if (pattern.averageAmount > 0) {
          seasonalIncomeAdjustment += pattern.averageAmount * pattern.confidence;
        } else {
          seasonalExpenseAdjustment += Math.abs(pattern.averageAmount) * pattern.confidence;
        }
      }
      if (pattern.type === 'monthly' && pattern.dayOfMonth === predictionDate.getDate()) {
        if (pattern.averageAmount > 0) {
          seasonalIncomeAdjustment += pattern.averageAmount * pattern.confidence;
        } else {
          seasonalExpenseAdjustment += Math.abs(pattern.averageAmount) * pattern.confidence;
        }
      }
    }

    const expectedIncome = avgDailyIncome + seasonalIncomeAdjustment;
    const expectedExpenses = avgDailyExpense + seasonalExpenseAdjustment;
    const netChange = expectedIncome - expectedExpenses + trendAdjustment;

    currentBalance += netChange;

    const confidenceDecay = Math.pow(0.95, i);
    const baseStdDev = StatisticsUtils.stdDev(dailyBalances.map(d => d.balance)) || 100;
    const intervalWidth = baseStdDev * (1 + i / 30) * (1 - confidenceDecay + 0.1);

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (currentBalance < 0) {
      riskLevel = 'high';
    } else if (currentBalance < avgDailyExpense * 7) {
      riskLevel = 'medium';
    }

    predictions.push({
      date: predictionDate,
      predictedBalance: Math.round(currentBalance * 100) / 100,
      confidenceInterval: {
        min: Math.round((currentBalance - intervalWidth) * 100) / 100,
        max: Math.round((currentBalance + intervalWidth) * 100) / 100,
      },
      expectedIncome: Math.round(expectedIncome * 100) / 100,
      expectedExpenses: Math.round(expectedExpenses * 100) / 100,
      riskLevel,
    });
  }

  return predictions;
}

export function calculateOverallConfidence(
  dailyPredictions: DailyPrediction[],
  trend: TrendAnalysis,
): number {
  let confidence = trend.r2;

  const balances = dailyPredictions.map(p => p.predictedBalance);
  const volatility = StatisticsUtils.stdDev(balances);
  const avgBalance = StatisticsUtils.mean(balances);
  const stabilityScore = avgBalance === 0 ? 0.5 : 1 - Math.min(volatility / Math.abs(avgBalance), 1);

  confidence = confidence * 0.6 + stabilityScore * 0.4;

  return Math.round(Math.min(confidence, 0.95) * 100) / 100;
}

export function identifyPredictionFactors(
  transactions: TransactionHistory['transactions'],
  trend: TrendAnalysis,
  seasonalPatterns: SeasonalPattern[],
): PredictionFactor[] {
  const factors: PredictionFactor[] = [];

  factors.push({
    name: 'Balance Trend',
    impact: trend.direction === 'up' ? 'positive' : trend.direction === 'down' ? 'negative' : 'neutral',
    weight: trend.r2,
    description: `Your balance is trending ${trend.direction} (${trend.changePercent.toFixed(1)}% change)`,
  });

  if (seasonalPatterns.length > 0) {
    const avgConfidence = StatisticsUtils.mean(seasonalPatterns.map(p => p.confidence));
    factors.push({
      name: 'Seasonal Patterns',
      impact: 'positive',
      weight: avgConfidence,
      description: `Detected ${seasonalPatterns.length} recurring patterns in your spending`,
    });
  }

  const categories = groupByCategory(transactions);
  const recurringCategories = Object.entries(categories).filter(([_, txs]) => txs.length >= 3);
  if (recurringCategories.length > 0) {
    factors.push({
      name: 'Recurring Transactions',
      impact: 'positive',
      weight: Math.min(recurringCategories.length / 5, 0.8),
      description: `${recurringCategories.length} categories show predictable patterns`,
    });
  }

  return factors;
}

export function generateShortfallSuggestions(
  predictionFactors: PredictionFactor[],
  deficit: number,
  daysUntil: number,
): string[] {
  const suggestions: string[] = [];

  if (daysUntil > 7) {
    suggestions.push(`You have ${daysUntil} days to adjust your spending`);
  } else {
    suggestions.push(`Urgent: Only ${daysUntil} days until projected shortfall`);
  }

  const negativeFactors = predictionFactors.filter(f => f.impact === 'negative');
  if (negativeFactors.length > 0) {
    suggestions.push(`Consider reducing spending in: ${negativeFactors[0].name}`);
  }

  if (deficit > 500) {
    suggestions.push(`Look for ways to increase income by $${Math.ceil(deficit / 100) * 100}`);
  }

  suggestions.push('Review upcoming scheduled payments and consider deferring non-essential ones');

  return suggestions;
}
