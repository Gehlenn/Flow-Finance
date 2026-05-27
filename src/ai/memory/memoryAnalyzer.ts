/**
 * Memory Analyzer
 * Analyzes transactions to extract financial patterns
 */

import { Transaction, Category } from '../../../types';
import {
  AIMemoryType,
  SpendingPatternValue,
  MerchantCategoryValue,
  RecurringExpenseValue,
  UserBehaviorValue,
  FinancialProfileValue,
  IncomePatternValue,
  SavingsBehaviorValue,
  TimePatternValue,
} from './memoryTypes';
import {
  formatMemoryAnalyzerDate,
  groupBy,
  average,
  getExpenseTransactions,
  getIncomeTransactions,
  getMemoryAnalyzerDayOfWeek,
  normalizeMemoryAnalyzerMerchant,
  standardDeviation,
  parseMemoryAnalyzerDate,
} from './memoryAnalyzerHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeSpendingPatterns(transactions: Transaction[]): Map<string, SpendingPatternValue> {
  const patterns = new Map<string, SpendingPatternValue>();
  const expenses = getExpenseTransactions(transactions);

  // Weekend pattern
  const weekendExpenses = expenses.filter((transaction) => {
    const day = getMemoryAnalyzerDayOfWeek(transaction);
    return day === 0 || day === 6;
  });

  if (weekendExpenses.length > 0) {
    const avgAmount = average(weekendExpenses.map((t) => t.amount));
    const frequency = (weekendExpenses.length / expenses.length) * 100;
    const categories = [...new Set(weekendExpenses.map((t) => t.category))];

    patterns.set('weekend', {
      pattern: 'weekend',
      avgAmount,
      frequency,
      categories,
      description: `Você gasta em média R$ ${avgAmount.toFixed(2)} aos finais de semana (${frequency.toFixed(1)}% das despesas)`,
    });
  }

  // Weekday pattern
  const weekdayExpenses = expenses.filter((transaction) => {
    const day = getMemoryAnalyzerDayOfWeek(transaction);
    return day !== null && day >= 1 && day <= 5;
  });

  if (weekdayExpenses.length > 0) {
    const avgAmount = average(weekdayExpenses.map((t) => t.amount));
    const frequency = (weekdayExpenses.length / expenses.length) * 100;
    const categories = [...new Set(weekdayExpenses.map((t) => t.category))];

    patterns.set('weekday', {
      pattern: 'weekday',
      avgAmount,
      frequency,
      categories,
      description: `Você gasta em média R$ ${avgAmount.toFixed(2)} durante a semana (${frequency.toFixed(1)}% das despesas)`,
    });
  }

  // Monthly pattern (beginning vs end of month)
  const beginningMonth = expenses.filter((transaction) => (parseMemoryAnalyzerDate(transaction.date)?.getDate() ?? 0) <= 10);
  const endMonth = expenses.filter((transaction) => (parseMemoryAnalyzerDate(transaction.date)?.getDate() ?? 0) >= 20);

  if (beginningMonth.length > endMonth.length * 1.5) {
    patterns.set('monthly_beginning', {
      pattern: 'monthly',
      avgAmount: average(beginningMonth.map((t) => t.amount)),
      frequency: (beginningMonth.length / expenses.length) * 100,
      categories: [...new Set(beginningMonth.map((t) => t.category))],
      description: 'Você tende a gastar mais no início do mês',
    });
  } else if (endMonth.length > beginningMonth.length * 1.5) {
    patterns.set('monthly_end', {
      pattern: 'monthly',
      avgAmount: average(endMonth.map((t) => t.amount)),
      frequency: (endMonth.length / expenses.length) * 100,
      categories: [...new Set(endMonth.map((t) => t.category))],
      description: 'Você tende a gastar mais no final do mês',
    });
  }

  return patterns;
}

export function analyzeMerchantCategories(transactions: Transaction[]): Map<string, MerchantCategoryValue> {
  const merchantData = new Map<string, MerchantCategoryValue>();
  const expenses = getExpenseTransactions(transactions);

  const merchantGroups = groupBy(expenses, (tx) => normalizeMemoryAnalyzerMerchant(tx));

  // Analyze each merchant
  for (const [merchant, txs] of merchantGroups) {
    if (txs.length >= 2) {
      // At least 2 transactions to establish pattern
      const totalSpent = txs.reduce((sum, t) => sum + t.amount, 0);
      const avgAmount = average(txs.map((t) => t.amount));
      const category = txs[0].category || Category.PESSOAL;

      // Calculate monthly frequency
      const parsedDates = txs
        .map((t) => parseMemoryAnalyzerDate(t.date))
        .filter((d): d is Date => d !== null)
        .map((d) => d.getTime());
      if (parsedDates.length === 0) continue;
      const firstDate = Math.min(...parsedDates);
      const lastDate = Math.max(...parsedDates);
      const monthsSpan = Math.max(1, (lastDate - firstDate) / (30 * 24 * 60 * 60 * 1000));
      const frequency = txs.length / monthsSpan;

      merchantData.set(merchant, {
        merchantName: merchant,
        category,
        avgAmount,
        frequency,
        lastAmount: txs[txs.length - 1].amount,
        totalSpent,
      });
    }
  }

  return merchantData;
}

export function analyzeRecurringExpenses(transactions: Transaction[]): Map<string, RecurringExpenseValue> {
  const recurring = new Map<string, RecurringExpenseValue>();
  const expenses = getExpenseTransactions(transactions);

  // Group by merchant/description
  const merchantGroups = new Map<string, Transaction[]>();
  for (const tx of expenses) {
    const key = normalizeMemoryAnalyzerMerchant(tx);
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }
    merchantGroups.get(key)!.push(tx);
  }

  // Detect recurring patterns
  for (const [merchant, txs] of merchantGroups) {
    if (txs.length >= 3) {
      // Need at least 3 occurrences
      txs.sort((a, b) => {
        const left = parseMemoryAnalyzerDate(a.date)?.getTime() ?? 0;
        const right = parseMemoryAnalyzerDate(b.date)?.getTime() ?? 0;
        return left - right;
      });

      // Calculate intervals between transactions
      const intervals: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        const current = parseMemoryAnalyzerDate(txs[i].date)?.getTime();
        const previous = parseMemoryAnalyzerDate(txs[i - 1].date)?.getTime();
        if (current == null || previous == null) continue;
        const days = (current - previous) / (24 * 60 * 60 * 1000);
        intervals.push(days);
      }

      const avgInterval = average(intervals);
      const intervalStdDev = standardDeviation(intervals);

      // If intervals are consistent (low std dev), it's likely recurring
      const isRecurring = intervalStdDev < avgInterval * 0.3; // Within 30% variance

      if (isRecurring) {
        let frequency: RecurringExpenseValue['frequency'] = 'monthly';
        if (avgInterval <= 10) frequency = 'weekly';
        else if (avgInterval <= 35) frequency = 'monthly';
        else frequency = 'yearly';

        const amounts = txs.map((t) => t.amount);
        const avgAmount = average(amounts);
        const amountStdDev = standardDeviation(amounts);

        const isSubscription = amountStdDev < avgAmount * 0.1; // Amount varies less than 10%

        // Predict next date
        const lastDate = parseMemoryAnalyzerDate(txs[txs.length - 1].date);
        if (!lastDate) continue;
        const nextDate = new Date(lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);

        const confidence = Math.max(0.5, Math.min(1, 1 - intervalStdDev / avgInterval));

        recurring.set(merchant, {
          merchantName: merchant,
          category: txs[0].category || Category.PESSOAL,
          amount: avgAmount,
          frequency,
          nextExpectedDate: formatMemoryAnalyzerDate(nextDate),
          isSubscription,
          confidence,
        });
      }
    }
  }

  return recurring;
}

export function analyzeUserBehavior(transactions: Transaction[]): Map<string, UserBehaviorValue> {
  const behaviors = new Map<string, UserBehaviorValue>();
  const expenses = getExpenseTransactions(transactions);
  const income = getIncomeTransactions(transactions);

  if (expenses.length === 0) return behaviors;

  // Impulsive spending (many small transactions, especially weekends/nights)
  const smallExpenses = expenses.filter((t) => t.amount < 50);
  const impulsiveScore = (smallExpenses.length / expenses.length) * 100;

  if (impulsiveScore > 40) {
    behaviors.set('impulsive_spending', {
      behavior: 'impulsive_spending',
      evidence: [`${smallExpenses.length} transações pequenas (<R$50)`],
      score: Math.min(100, impulsiveScore),
    });
  }

  // Budget conscious (consistent spending, tracks expenses)
  const uniqueDays = new Set(
    expenses
      .map((t) => parseMemoryAnalyzerDate(t.date))
      .filter((d): d is Date => d !== null)
      .map((d) => d.toDateString()),
  ).size;
  const avgPerDay = expenses.length / Math.max(1, uniqueDays);

  if (avgPerDay < 3 && expenses.length > 10) {
    behaviors.set('budget_conscious', {
      behavior: 'budget_conscious',
      evidence: [`Média de ${avgPerDay.toFixed(1)} transações por dia`, 'Gastos controlados'],
      score: 75,
    });
  }

  // Weekend spender
  const weekendCount = expenses.filter((t) => {
    const day = getMemoryAnalyzerDayOfWeek(t) ?? -1;
    return day === 0 || day === 6;
  }).length;
  const weekendRatio = (weekendCount / expenses.length) * 100;

  if (weekendRatio > 35) {
    behaviors.set('weekend_spender', {
      behavior: 'weekend_spender',
      evidence: [`${weekendRatio.toFixed(1)}% dos gastos ocorrem aos finais de semana`],
      score: Math.min(100, weekendRatio * 2),
    });
  }

  // Savings behavior
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);

  if (totalIncome > 0) {
    const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;

    if (savingsRate > 20) {
      behaviors.set('budget_conscious', {
        behavior: 'budget_conscious',
        evidence: [`Taxa de poupança de ${savingsRate.toFixed(1)}%`],
        score: Math.min(100, savingsRate * 3),
      });
    }
  }

  return behaviors;
}

export function analyzeFinancialProfile(transactions: Transaction[]): FinancialProfileValue | null {
  const expenses = getExpenseTransactions(transactions);
  const income = getIncomeTransactions(transactions);

  if (income.length === 0 || expenses.length === 0) return null;

  const avgMonthlyIncome = income.reduce((s, t) => s + t.amount, 0) / Math.max(1, income.length / 30);
  const avgMonthlyExpenses = expenses.reduce((s, t) => s + t.amount, 0) / Math.max(1, expenses.length / 30);
  const savingsRate = ((avgMonthlyIncome - avgMonthlyExpenses) / avgMonthlyIncome) * 100;

  let profile: FinancialProfileValue['profile'];
  let riskTolerance: number;

  if (savingsRate > 30) {
    profile = 'conservative';
    riskTolerance = 30;
  } else if (savingsRate > 10) {
    profile = 'moderate';
    riskTolerance = 60;
  } else {
    profile = 'aggressive';
    riskTolerance = 85;
  }

  return {
    profile,
    savingsRate,
    averageMonthlyIncome: avgMonthlyIncome,
    averageMonthlyExpenses: avgMonthlyExpenses,
    riskTolerance,
  };
}

export function analyzeIncomePatterns(transactions: Transaction[]): Map<string, IncomePatternValue> {
  const patterns = new Map<string, IncomePatternValue>();
  const income = getIncomeTransactions(transactions);

  const sourceGroups = groupBy(income, (tx) => normalizeMemoryAnalyzerMerchant(tx));

  for (const [source, txs] of sourceGroups) {
    if (txs.length >= 2) {
      txs.sort((a, b) => {
        const left = parseMemoryAnalyzerDate(a.date)?.getTime() ?? 0;
        const right = parseMemoryAnalyzerDate(b.date)?.getTime() ?? 0;
        return left - right;
      });

      const intervals: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        const current = parseMemoryAnalyzerDate(txs[i].date)?.getTime();
        const previous = parseMemoryAnalyzerDate(txs[i - 1].date)?.getTime();
        if (current == null || previous == null) continue;
        const days = (current - previous) / (24 * 60 * 60 * 1000);
        intervals.push(days);
      }

      const avgInterval = average(intervals);
      const intervalStdDev = standardDeviation(intervals);

      const isStable = intervalStdDev < avgInterval * 0.2;

      let frequency: IncomePatternValue['frequency'] = 'monthly';
      if (avgInterval <= 10) frequency = 'weekly';
      else if (avgInterval <= 17) frequency = 'biweekly';

      const avgAmount = average(txs.map((t) => t.amount));

      // Determine if it's salary (regular + stable amount)
      const amounts = txs.map((t) => t.amount);
      const amountStdDev = standardDeviation(amounts);
      const isSalary = isStable && amountStdDev < avgAmount * 0.1;

      patterns.set(source, {
        source,
        type: isSalary ? 'salary' : 'other',
        avgAmount,
        frequency,
        isStable,
      });
    }
  }

  return patterns;
}

export function analyzeTimePatterns(transactions: Transaction[]): Map<string, TimePatternValue> {
  const patterns = new Map<string, TimePatternValue>();
  const expenses = getExpenseTransactions(transactions);

  // Group by day of week
  const dayGroups = groupBy(
    expenses.filter((tx) => getMemoryAnalyzerDayOfWeek(tx) !== null),
    (tx) => getMemoryAnalyzerDayOfWeek(tx) ?? -1,
  );

  for (const [day, txs] of dayGroups) {
    if (txs.length >= 3) {
      const avgAmount = average(txs.map((t) => t.amount));
      const frequency = txs.length;
      const categories = [...new Set(txs.map((t) => t.category))];
      const avgHour = average(txs.map((t) => parseMemoryAnalyzerDate(t.date)?.getHours() ?? 0));
      const timeframe: TimePatternValue['timeframe'] = avgHour < 12
        ? 'morning'
        : avgHour < 18
          ? 'afternoon'
          : avgHour < 22
            ? 'evening'
            : 'night';

      patterns.set(`day_${day}`, {
        timeframe,
        dayOfWeek: day,
        avgAmount,
        frequency,
        categories,
      });
    }
  }

  return patterns;
}
