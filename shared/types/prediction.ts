/**
 * Prediction Types for Flow Finance
 * AI-powered cash flow forecasting data models
 */

export interface CashFlowPrediction {
  dateRange: { start: Date; end: Date };
  dailyPredictions: DailyPrediction[];
  confidence: number; // 0-1
  trend: 'up' | 'down' | 'stable';
  factors: PredictionFactor[];
  generatedAt: Date;
  userId: string;
}

export interface DailyPrediction {
  date: Date;
  predictedBalance: number;
  confidenceInterval: { min: number; max: number };
  expectedIncome: number;
  expectedExpenses: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ShortfallRisk {
  predictedDate: Date;
  severity: 'low' | 'medium' | 'high';
  projectedDeficit: number;
  suggestions: string[];
  confidence: number;
  daysUntil: number;
}

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number; // 0-1
  description: string;
}

export interface SeasonalPattern {
  type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  month?: number; // 0-11 for yearly
  category: string;
  averageAmount: number;
  confidence: number;
  sampleSize: number;
}

export interface PredictionCache {
  userId: string;
  prediction: CashFlowPrediction;
  expiresAt: Date;
}

export interface PredictionRequest {
  days: number;
  includeSeasonality?: boolean;
  confidenceThreshold?: number;
}

export interface PredictionAlert {
  id: string;
  userId: string;
  type: 'SHORTFALL_WARNING' | 'TREND_CHANGE' | 'SEASONAL_PATTERN';
  severity: 'low' | 'medium' | 'high';
  message: string;
  data: ShortfallRisk | PredictionFactor[] | SeasonalPattern[];
  createdAt: Date;
  read: boolean;
}

// API Response types
export interface PredictionApiResponse {
  success: boolean;
  data?: CashFlowPrediction | ShortfallRisk | SeasonalPattern[];
  error?: string;
  cached?: boolean;
}

// Chart data format for Recharts
export interface ChartDataPoint {
  date: string;
  balance: number;
  predictedMin: number;
  predictedMax: number;
  isPrediction: boolean;
  income: number;
  expenses: number;
}

// Historical data for ML
export interface TransactionHistory {
  userId: string;
  transactions: {
    id: string;
    date: Date;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    description: string;
  }[];
  dateRange: { start: Date; end: Date };
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
}

// Algorithm configuration
export interface PredictionConfig {
  minHistoricalDays: number;
  maxHistoricalDays: number;
  defaultPredictionDays: number;
  confidenceThreshold: number;
  smoothingFactor: number; // 0-1 for exponential smoothing
  seasonalLookbackMonths: number;
  cacheDurationMinutes: number;
}

// Default configuration
export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  minHistoricalDays: 30,
  maxHistoricalDays: 730, // 2 years
  defaultPredictionDays: 30,
  confidenceThreshold: 0.6,
  smoothingFactor: 0.3,
  seasonalLookbackMonths: 12,
  cacheDurationMinutes: 60,
};

// Trend calculation result
export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  slope: number;
  r2: number; // R-squared (goodness of fit)
  changePercent: number;
  confidence: number;
}

// Moving average data
export interface MovingAverage {
  period: number;
  values: { date: Date; value: number }[];
  current: number;
  trend: TrendAnalysis;
}

// Anomaly detection result
export interface AnomalyDetection {
  isAnomaly: boolean;
  anomalyType?: 'spike' | 'drop' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high';
  expectedValue: number;
  actualValue: number;
  deviation: number; // standard deviations from mean
  explanation: string;
}

// Prediction metadata for analytics
export interface PredictionMetadata {
  userId: string;
  generatedAt: Date;
  algorithmVersion: string;
  calculationTimeMs: number;
  historicalDataPoints: number;
  accuracyMetrics?: {
    last7Days: number;
    last30Days: number;
    overall: number;
  };
}
