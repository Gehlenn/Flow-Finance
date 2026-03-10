/**
 * Memory Analyzer
 * Analyzes transactions to extract financial patterns
 */

import { Transaction, TransactionType, Category } from '../../../types';
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

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeSpendingPatterns(transactions: Transaction[]): Map<string, SpendingPatternValue> {
  const patterns = new Map<string, SpendingPatternValue>();
  const expenses = transactions.filter((t) => t.type === TransactionType.DESPESA && !t.generated);

  // Weekend pattern
  const weekendExpenses = expenses.filter((t) => {
    const day = new Date(t.date).getDay();
    return day === 0 || day === 6;
  });

  if (weekendExpenses.length > 0) {
    const avgAmount = weekendExpenses.reduce((sum, t) => sum + t.amount, 0) / weekendExpenses.length;
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
  const weekdayExpenses = expenses.filter((t) => {
    const day = new Date(t.date).getDay();
    return day >= 1 && day <= 5;
  });

  if (weekdayExpenses.length > 0) {
    const avgAmount = weekdayExpenses.reduce((sum, t) => sum + t.amount, 0) / weekdayExpenses.length;
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
  const beginningMonth = expenses.filter((t) => new Date(t.date).getDate() <= 10);
  const endMonth = expenses.filter((t) => new Date(t.date).getDate() >= 20);

  if (beginningMonth.length > endMonth.length * 1.5) {
    patterns.set('monthly_beginning', {
      pattern: 'monthly',
      avgAmount: beginningMonth.reduce((s, t) => s + t.amount, 0) / beginningMonth.length,
      frequency: (beginningMonth.length / expenses.length) * 100,
      categories: [...new Set(beginningMonth.map((t) => t.category))],
      description: 'Você tende a gastar mais no início do mês',
    });
  } else if (endMonth.length > beginningMonth.length * 1.5) {
    patterns.set('monthly_end', {
      pattern: 'monthly',
      avgAmount: endMonth.reduce((s, t) => s + t.amount, 0) / endMonth.length,
      frequency: (endMonth.length / expenses.length) * 100,
      categories: [...new Set(endMonth.map((t) => t.category))],
      description: 'Você tende a gastar mais no final do mês',
    });
  }

  return patterns;
}

export function analyzeMerchantCategories(transactions: Transaction[]): Map<string, MerchantCategoryValue> {
  const merchantData = new Map<string, MerchantCategoryValue>();
  const expenses = transactions.filter((t) => t.type === TransactionType.DESPESA && !t.generated);

  const merchantGroups = new Map<string, Transaction[]>();
  for (const tx of expenses) {
    const merchant = (tx.merchant || tx.description).trim().toLowerCase();
    if (!merchantGroups.has(merchant)) {
      merchantGroups.set(merchant, []);
    }
    merchantGroups.get(merchant)!.push(tx);
  }

  // Analyze each merchant
  for (const [merchant, txs] of merchantGroups) {
    if (txs.length >= 2) {
      // At least 2 transactions to establish pattern
      const totalSpent = txs.reduce((sum, t) => sum + t.amount, 0);
      const avgAmount = totalSpent / txs.length;
      const category = txs[0].category || Category.OUTROS;
      
      // Calculate monthly frequency
      const firstDate = Math.min(...txs.map((t) => new Date(t.date).getTime()));
      const lastDate = Math.max(...txs.map((t) => new Date(t.date).getTime()));
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
  const expenses = transactions.filter((t) => t.type === TransactionType.DESPESA && !t.generated);

  // Group by merchant/description
  const merchantGroups = new Map<string, Transaction[]>();
  for (const tx of expenses) {
    const key = (tx.merchant || tx.description).trim().toLowerCase();
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }
    merchantGroups.get(key)!.push(tx);
  }

  // Detect recurring patterns
  for (const [merchant, txs] of merchantGroups) {
    if (txs.length >= 3) {
      // Need at least 3 occurrences
      txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate intervals between transactions
      const intervals: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        const days = (new Date(txs[i].date).getTime() - new Date(txs[i - 1].date).getTime()) / (24 * 60 * 60 * 1000);
        intervals.push(days);
      }

      const avgInterval = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
      const intervalStdDev = Math.sqrt(
        intervals.reduce((sum, d) => sum + Math.pow(d - avgInterval, 2), 0) / intervals.length
      );

      // If intervals are consistent (low std dev), it's likely recurring
      const isRecurring = intervalStdDev < avgInterval * 0.3; // Within 30% variance

      if (isRecurring) {
        let frequency: RecurringExpenseValue['frequency'] = 'monthly';
        if (avgInterval <= 10) frequency = 'weekly';
        else if (avgInterval <= 35) frequency = 'monthly';
        else frequency = 'yearly';

        const amounts = txs.map((t) => t.amount);
        const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const amountStdDev = Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / amounts.length);

        const isSubscription = amountStdDev < avgAmount * 0.1; // Amount varies less than 10%

        // Predict next date
        const lastDate = new Date(txs[txs.length - 1].date);
        const nextDate = new Date(lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);

        const confidence = Math.max(0.5, Math.min(1, 1 - intervalStdDev / avgInterval));

        recurring.set(merchant, {
          merchantName: merchant,
          category: txs[0].category || Category.OUTROS,
          amount: avgAmount,
          frequency,
          nextExpectedDate: nextDate.toISOString(),
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
  const expenses = transactions.filter((t) => t.type === TransactionType.DESPESA && !t.generated);
  const income = transactions.filter((t) => t.type === TransactionType.RECEITA && !t.generated);

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
  const uniqueDays = new Set(expenses.map((t) => new Date(t.date).toDateString())).size;
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
    const day = new Date(t.date).getDay();
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
  const expenses = transactions.filter((t) => t.type === TransactionType.DESPESA && !t.generated);
  const income = transactions.filter((t) => t.type === TransactionType.RECEITA && !t.generated);

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
  const income = transactions.filter((t) => t.type === TransactionType.RECEITA && !t.generated);

  const sourceGroups = new Map<string, Transaction[]>();
  for (const tx of income) {
    const source = (tx.merchant || tx.description).trim().toLowerCase();
    if (!sourceGroups.has(source)) {
      sourceGroups.set(source, []);
    }
    sourceGroups.get(source)!.push(tx);
  }

  for (const [source, txs] of sourceGroups) {
    if (txs.length >= 2) {
      txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const intervals: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        const days = (new Date(txs[i].date).getTime() - new Date(txs[i - 1].date).getTime()) / (24 * 60 * 60 * 1000);
        intervals.push(days);
      }

      const avgInterval = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
      const intervalStdDev = Math.sqrt(intervals.reduce((sum, d) => sum + Math.pow(d - avgInterval, 2), 0) / intervals.length);

      const isStable = intervalStdDev < avgInterval * 0.2;

      let frequency: IncomePatternValue['frequency'] = 'monthly';
      if (avgInterval <= 10) frequency = 'weekly';
      else if (avgInterval <= 17) frequency = 'biweekly';

      const avgAmount = txs.reduce((s, t) => s + t.amount, 0) / txs.length;

      // Determine if it's salary (regular + stable amount)
      const amounts = txs.map((t) => t.amount);
      const amountStdDev = Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / amounts.length);
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
  const expenses = transactions.filter((t) => t.type === TransactionType.DESPESA && !t.generated);

  // Group by day of week
  const dayGroups = new Map<number, Transaction[]>();
  for (const tx of expenses) {
    const day = new Date(tx.date).getDay();
    if (!dayGroups.has(day)) {
      dayGroups.set(day, []);
    }
    dayGroups.get(day)!.push(tx);
  }

  for (const [day, txs] of dayGroups) {
    if (txs.length >= 3) {
      const avgAmount = txs.reduce((s, t) => s + t.amount, 0) / txs.length;
      const frequency = txs.length;
      const categories = [...new Set(txs.map((t) => t.category))];

      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

      patterns.set(`day_${day}`, {
        timeframe: day === 0 || day === 6 ? 'weekend' : 'weekday',
        dayOfWeek: day,
        avgAmount,
        frequency,
        categories,
      });
    }
  }

  return patterns;
}
