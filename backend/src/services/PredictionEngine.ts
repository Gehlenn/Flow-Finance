/**
 * PredictionEngine.ts
 * AI-powered cash flow prediction service
 * Uses time series analysis and pattern recognition
 */

import {
  CashFlowPrediction,
  DailyPrediction,
  ShortfallRisk,
  PredictionFactor,
  SeasonalPattern,
  TrendAnalysis,
  TransactionHistory,
  PredictionConfig,
  DEFAULT_PREDICTION_CONFIG,
  AnomalyDetection,
} from '../types/prediction';

// Simple statistics utilities (no heavy ML deps)
class StatisticsUtils {
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  static stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.mean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = this.mean(squaredDiffs);
    return Math.sqrt(variance);
  }

  static linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
    if (points.length < 2) return { slope: 0, intercept: 0, r2: 0 };
    
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumYY = points.reduce((sum, p) => sum + p.y * p.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
    const ssResidual = points.reduce((sum, p) => {
      const predicted = slope * p.x + intercept;
      return sum + Math.pow(p.y - predicted, 2);
    }, 0);
    const r2 = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

    return { slope, intercept, r2 };
  }

  static exponentialSmoothing(values: number[], alpha: number = 0.3): number[] {
    if (values.length === 0) return [];
    const smoothed = [values[0]];
    for (let i = 1; i < values.length; i++) {
      smoothed[i] = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
    }
    return smoothed;
  }

  static movingAverage(values: number[], period: number): number[] {
    if (period <= 1) return values;
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        result.push(values[i]);
      } else {
        const window = values.slice(i - period + 1, i + 1);
        result.push(this.mean(window));
      }
    }
    return result;
  }
}

export class PredictionEngine {
  private config: PredictionConfig;
  private cache: Map<string, { prediction: CashFlowPrediction; expiresAt: Date }> = new Map();

  constructor(config: Partial<PredictionConfig> = {}) {
    this.config = { ...DEFAULT_PREDICTION_CONFIG, ...config };
  }

  /**
   * Generate cash flow prediction for a user
   */
  async predictCashFlow(
    userId: string,
    historicalData: TransactionHistory,
    days: number = this.config.defaultPredictionDays
  ): Promise<CashFlowPrediction> {
    const startTime = Date.now();
    
    // Check cache first
    const cached = this.getCachedPrediction(userId);
    if (cached) {
      console.log(`[PredictionEngine] Cache hit for user ${userId}`);
      return cached;
    }

    // Validate historical data
    if (historicalData.transactions.length < 10) {
      throw new Error('Insufficient historical data (minimum 10 transactions)');
    }

    const transactions = historicalData.transactions.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate daily balances
    const dailyBalances = this.calculateDailyBalances(transactions);
    
    // Detect patterns
    const seasonalPatterns = this.detectSeasonality(transactions);
    const trend = this.analyzeTrend(dailyBalances);
    
    // Generate daily predictions
    const lastBalance = dailyBalances[dailyBalances.length - 1]?.balance || 0;
    const dailyPredictions = this.generateDailyPredictions(
      dailyBalances,
      transactions,
      seasonalPatterns,
      trend,
      lastBalance,
      days
    );

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(dailyPredictions, trend);

    // Identify prediction factors
    const factors = this.identifyPredictionFactors(transactions, trend, seasonalPatterns);

    const now = new Date();
    const prediction: CashFlowPrediction = {
      userId,
      dateRange: {
        start: now,
        end: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
      },
      dailyPredictions,
      confidence,
      trend: trend.direction,
      factors,
      generatedAt: new Date(),
    };

    // Cache the prediction
    this.cachePrediction(userId, prediction);

    const calcTime = Date.now() - startTime;
    console.log(`[PredictionEngine] Generated prediction for ${userId} in ${calcTime}ms`);

    return prediction;
  }

  /**
   * Predict potential shortfall risks
   */
  async predictShortfall(
    userId: string,
    prediction: CashFlowPrediction
  ): Promise<ShortfallRisk | null> {
    const negativeBalances = prediction.dailyPredictions.filter(
      p => p.predictedBalance < 0
    );

    if (negativeBalances.length === 0) {
      return null;
    }

    const firstNegative = negativeBalances[0];
    const projectedDeficit = Math.abs(firstNegative.predictedBalance);
    const now = new Date();
    const daysUntil = Math.ceil(
      (new Date(firstNegative.date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Determine severity
    let severity: 'low' | 'medium' | 'high';
    if (projectedDeficit > 1000 || daysUntil < 7) {
      severity = 'high';
    } else if (projectedDeficit > 500 || daysUntil < 14) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    // Generate suggestions
    const suggestions = this.generateShortfallSuggestions(
      prediction,
      projectedDeficit,
      daysUntil
    );

    return {
      predictedDate: new Date(firstNegative.date),
      severity,
      projectedDeficit,
      suggestions,
      confidence: prediction.confidence,
      daysUntil,
    };
  }

  /**
   * Detect seasonal patterns in transactions
   */
  detectSeasonality(transactions: TransactionHistory['transactions']): SeasonalPattern[] {
    const patterns: SeasonalPattern[] = [];

    // Group by category
    const byCategory = this.groupByCategory(transactions);

    for (const [category, categoryTransactions] of Object.entries(byCategory)) {
      // Weekly patterns
      const weeklyPattern = this.detectWeeklyPattern(category, categoryTransactions);
      if (weeklyPattern) patterns.push(weeklyPattern);

      // Monthly patterns
      const monthlyPattern = this.detectMonthlyPattern(category, categoryTransactions);
      if (monthlyPattern) patterns.push(monthlyPattern);
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze trend in balance history
   */
  analyzeTrend(dailyBalances: { date: Date; balance: number }[]): TrendAnalysis {
    if (dailyBalances.length < 7) {
      return { direction: 'stable', slope: 0, r2: 0, changePercent: 0, confidence: 0 };
    }

    const points = dailyBalances.map((d, i) => ({ x: i, y: d.balance }));
    const regression = StatisticsUtils.linearRegression(points);

    // Determine direction
    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(regression.slope) < 0.01) {
      direction = 'stable';
    } else {
      direction = regression.slope > 0 ? 'up' : 'down';
    }

    // Calculate change percentage
    const firstBalance = dailyBalances[0].balance;
    const lastBalance = dailyBalances[dailyBalances.length - 1].balance;
    const changePercent = firstBalance === 0 ? 0 : ((lastBalance - firstBalance) / Math.abs(firstBalance)) * 100;

    // Calculate confidence based on R-squared and data size
    const dataQuality = Math.min(dailyBalances.length / 30, 1); // Max at 30 days
    const confidence = regression.r2 * dataQuality;

    return {
      direction,
      slope: regression.slope,
      r2: regression.r2,
      changePercent,
      confidence,
    };
  }

  /**
   * Detect anomalies in recent transactions
   */
  detectAnomalies(
    recentTransactions: TransactionHistory['transactions'],
    historicalAverage: number
  ): AnomalyDetection[] {
    const stdDev = StatisticsUtils.stdDev(
      recentTransactions.map(t => Math.abs(t.amount))
    );
    const mean = historicalAverage;

    return recentTransactions.map(t => {
      const deviation = stdDev === 0 ? 0 : (Math.abs(t.amount) - mean) / stdDev;
      const isAnomaly = Math.abs(deviation) > 2; // 2 standard deviations

      if (!isAnomaly) {
        return {
          isAnomaly: false,
          severity: 'low',
          expectedValue: mean,
          actualValue: Math.abs(t.amount),
          deviation: 0,
          explanation: '',
        };
      }

      const severity: 'low' | 'medium' | 'high' = 
        Math.abs(deviation) > 3 ? 'high' : Math.abs(deviation) > 2.5 ? 'medium' : 'low';

      return {
        isAnomaly: true,
        anomalyType: t.amount > mean ? 'spike' : 'drop',
        severity,
        expectedValue: mean,
        actualValue: Math.abs(t.amount),
        deviation,
        explanation: `${t.type === 'income' ? 'Income' : 'Expense'} of ${Math.abs(t.amount).toFixed(2)} is ${Math.abs(deviation).toFixed(1)} standard deviations from average`,
      };
    });
  }

  // ==================== PRIVATE METHODS ====================

  private calculateDailyBalances(
    transactions: TransactionHistory['transactions']
  ): { date: Date; balance: number; income: number; expenses: number }[] {
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
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

    // Calculate running balance
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

  private generateDailyPredictions(
    dailyBalances: { date: Date; balance: number; income: number; expenses: number }[],
    transactions: TransactionHistory['transactions'],
    seasonalPatterns: SeasonalPattern[],
    trend: TrendAnalysis,
    startingBalance: number,
    days: number
  ): DailyPrediction[] {
    const predictions: DailyPrediction[] = [];
    let currentBalance = startingBalance;
    const now = new Date();

    // Calculate average daily income/expense from history
    const avgDailyIncome = StatisticsUtils.mean(
      dailyBalances.map(d => d.income).filter(v => v > 0)
    ) || 0;
    const avgDailyExpense = StatisticsUtils.mean(
      dailyBalances.map(d => d.expenses).filter(v => v > 0)
    ) || 0;

    for (let i = 1; i <= days; i++) {
      const predictionDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      
      // Apply trend
      const trendAdjustment = trend.slope * i;
      
      // Apply seasonal adjustments
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

      // Calculate confidence interval (wider for further predictions)
      const confidenceDecay = Math.pow(0.95, i); // 5% decay per day
      const baseStdDev = StatisticsUtils.stdDev(dailyBalances.map(d => d.balance)) || 100;
      const intervalWidth = baseStdDev * (1 + i / 30) * (1 - confidenceDecay + 0.1);

      // Determine risk level
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

  private calculateOverallConfidence(
    dailyPredictions: DailyPrediction[],
    trend: TrendAnalysis
  ): number {
    // Base confidence from trend R-squared
    let confidence = trend.r2;
    
    // Adjust based on prediction stability
    const balances = dailyPredictions.map(p => p.predictedBalance);
    const volatility = StatisticsUtils.stdDev(balances);
    const avgBalance = StatisticsUtils.mean(balances);
    const stabilityScore = avgBalance === 0 ? 0.5 : 1 - Math.min(volatility / Math.abs(avgBalance), 1);
    
    confidence = confidence * 0.6 + stabilityScore * 0.4;
    
    // Cap based on historical data quality
    return Math.round(Math.min(confidence, 0.95) * 100) / 100;
  }

  private identifyPredictionFactors(
    transactions: TransactionHistory['transactions'],
    trend: TrendAnalysis,
    seasonalPatterns: SeasonalPattern[]
  ): PredictionFactor[] {
    const factors: PredictionFactor[] = [];

    // Trend factor
    factors.push({
      name: 'Balance Trend',
      impact: trend.direction === 'up' ? 'positive' : trend.direction === 'down' ? 'negative' : 'neutral',
      weight: trend.r2,
      description: `Your balance is trending ${trend.direction} (${trend.changePercent.toFixed(1)}% change)`,
    });

    // Seasonality factor
    if (seasonalPatterns.length > 0) {
      const avgConfidence = StatisticsUtils.mean(seasonalPatterns.map(p => p.confidence));
      factors.push({
        name: 'Seasonal Patterns',
        impact: 'positive',
        weight: avgConfidence,
        description: `Detected ${seasonalPatterns.length} recurring patterns in your spending`,
      });
    }

    // Transaction consistency factor
    const categories = this.groupByCategory(transactions);
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

  private groupByCategory(
    transactions: TransactionHistory['transactions']
  ): Record<string, TransactionHistory['transactions']> {
    return transactions.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    }, {} as Record<string, TransactionHistory['transactions']>);
  }

  private detectWeeklyPattern(
    category: string,
    transactions: TransactionHistory['transactions']
  ): SeasonalPattern | null {
    if (transactions.length < 4) return null;

    const byDayOfWeek: Record<number, number[]> = {};
    for (const t of transactions) {
      const day = new Date(t.date).getDay();
      if (!byDayOfWeek[day]) byDayOfWeek[day] = [];
      byDayOfWeek[day].push(t.amount);
    }

    // Find day with most consistent transactions
    let bestDay: number | null = null;
    let bestConfidence = 0;

    for (const [day, amounts] of Object.entries(byDayOfWeek)) {
      if (amounts.length >= 3) {
        const stdDev = StatisticsUtils.stdDev(amounts);
        const mean = StatisticsUtils.mean(amounts);
        const cv = mean === 0 ? Infinity : stdDev / Math.abs(mean); // Coefficient of variation
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

  private detectMonthlyPattern(
    category: string,
    transactions: TransactionHistory['transactions']
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

  private generateShortfallSuggestions(
    prediction: CashFlowPrediction,
    deficit: number,
    daysUntil: number
  ): string[] {
    const suggestions: string[] = [];

    if (daysUntil > 7) {
      suggestions.push(`You have ${daysUntil} days to adjust your spending`);
    } else {
      suggestions.push(`Urgent: Only ${daysUntil} days until projected shortfall`);
    }

    // Find categories with highest expenses
    const factors = prediction.factors.filter(f => f.impact === 'negative');
    if (factors.length > 0) {
      suggestions.push(`Consider reducing spending in: ${factors[0].name}`);
    }

    if (deficit > 500) {
      suggestions.push(`Look for ways to increase income by $${Math.ceil(deficit / 100) * 100}`);
    }

    suggestions.push('Review upcoming scheduled payments and consider deferring non-essential ones');

    return suggestions;
  }

  private getCachedPrediction(userId: string): CashFlowPrediction | null {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.prediction;
    }
    return null;
  }

  private cachePrediction(userId: string, prediction: CashFlowPrediction): void {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.config.cacheDurationMinutes);
    
    this.cache.set(userId, { prediction, expiresAt });
    console.log(`[PredictionEngine] Cached prediction for ${userId}, expires at ${expiresAt.toISOString()}`);
  }

  /**
   * Clear cache for a user (call when new transactions added)
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
      console.log(`[PredictionEngine] Cleared cache for ${userId}`);
    } else {
      this.cache.clear();
      console.log('[PredictionEngine] Cleared all cache');
    }
  }
}

export default PredictionEngine;
