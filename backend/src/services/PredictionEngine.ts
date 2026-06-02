/**
 * PredictionEngine.ts
 * AI-powered cash flow prediction service
 * Uses time series analysis and pattern recognition
 */

import {
  CashFlowPrediction,
  ShortfallRisk,
  SeasonalPattern,
  TrendAnalysis,
  TransactionHistory,
  PredictionConfig,
  DEFAULT_PREDICTION_CONFIG,
  AnomalyDetection,
} from '../types/prediction';
import { cache as redisCache } from '../config/redis';
import logger from '../config/logger';
import { StatisticsUtils } from './PredictionEngineHelpers';
import {
  calculateDailyBalances,
  calculateOverallConfidence,
  detectMonthlyPattern,
  detectWeeklyPattern,
  generateDailyPredictions,
  generateShortfallSuggestions,
  groupByCategory,
  identifyPredictionFactors,
} from './PredictionEngineAnalysis';

const REDIS_CACHE_PREFIX = 'prediction:v1:';

export class PredictionEngine {
  private config: PredictionConfig;
  /** In-memory fallback — used when Redis is unavailable (unit tests, local dev without Redis). */
  private memCache: Map<string, { prediction: CashFlowPrediction; expiresAt: Date }> = new Map();

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
    // Check Redis cache first (serverless-safe), fall back to memory
    const cached = await this.getCachedPredictionAsync(userId);
    if (cached) {
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
    const dailyBalances = calculateDailyBalances(transactions);
    
    // Detect patterns
    const seasonalPatterns = this.detectSeasonality(transactions);
    const trend = this.analyzeTrend(dailyBalances);
    
    // Generate daily predictions
    const lastBalance = dailyBalances[dailyBalances.length - 1]?.balance || 0;
    const dailyPredictions = generateDailyPredictions(
      dailyBalances,
      seasonalPatterns,
      trend,
      lastBalance,
      days,
    );

    // Calculate overall confidence
    const confidence = calculateOverallConfidence(dailyPredictions, trend);

    // Identify prediction factors
    const factors = identifyPredictionFactors(transactions, trend, seasonalPatterns);

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

    return prediction;
  }

  /**
   * Predict potential shortfall risks
   */
  async predictShortfall(
    userId: string,
    prediction: CashFlowPrediction
  ): Promise<ShortfallRisk | null> {
    // Keep signature stable; some callers may pass userId for correlation/logging.
    void userId;

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
    const suggestions = generateShortfallSuggestions(
      prediction.factors,
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
    const byCategory = groupByCategory(transactions);

    for (const [category, categoryTransactions] of Object.entries(byCategory)) {
      const weeklyPattern = detectWeeklyPattern(category, categoryTransactions);
      if (weeklyPattern) patterns.push(weeklyPattern);

      const monthlyPattern = detectMonthlyPattern(category, categoryTransactions);
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


  private getCachedPrediction(userId: string): CashFlowPrediction | null {
    // Memory-only path (sync) — Redis path is async and handled separately
    const cached = this.memCache.get(userId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.prediction;
    }
    return null;
  }

  /** Async lookup that checks Redis first, falls back to memory. */
  private async getCachedPredictionAsync(userId: string): Promise<CashFlowPrediction | null> {
    try {
      const raw = await redisCache.get(`${REDIS_CACHE_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { prediction: CashFlowPrediction; expiresAt: string };
        if (new Date(parsed.expiresAt) > new Date()) {
          return parsed.prediction;
        }
      }
    } catch (err) {
      logger.warn({
        err,
        userId,
        cacheKey: `${REDIS_CACHE_PREFIX}${userId}`,
        fallback: 'prediction-engine-cache-read-failed',
      }, 'PredictionEngine: Redis cache read failed, falling back to memory');
    }
    return this.getCachedPrediction(userId);
  }

  private cachePrediction(userId: string, prediction: CashFlowPrediction): void {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.config.cacheDurationMinutes);
    const ttlSeconds = this.config.cacheDurationMinutes * 60;

    // Always write to memory as fast fallback
    this.memCache.set(userId, { prediction, expiresAt });

    // Best-effort write to Redis (non-blocking)
    redisCache
      .set(`${REDIS_CACHE_PREFIX}${userId}`, JSON.stringify({ prediction, expiresAt }), ttlSeconds)
      .catch((err: unknown) => {
        logger.warn({
          err,
          userId,
          cacheKey: `${REDIS_CACHE_PREFIX}${userId}`,
          fallback: 'prediction-engine-cache-write-failed',
        }, 'PredictionEngine: Redis cache write failed, memory-only cache active');
      });
  }

  /**
   * Clear cache for a user (call when new transactions added).
   * Clears both Redis and memory.
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.memCache.delete(userId);
      redisCache.del(`${REDIS_CACHE_PREFIX}${userId}`).catch(() => undefined);
    } else {
      this.memCache.clear();
      // Cannot enumerate all Redis keys here without pattern scan — acceptable trade-off.
      // Individual keys expire by TTL.
    }
  }
}

export default PredictionEngine;
