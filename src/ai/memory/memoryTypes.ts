/**
 * AI Memory System 2.0 - Memory Types
 * Structured memory types for behavioral learning
 */

export enum AIMemoryType {
  SPENDING_PATTERN = 'SPENDING_PATTERN',
  MERCHANT_CATEGORY = 'MERCHANT_CATEGORY',
  RECURRING_EXPENSE = 'RECURRING_EXPENSE',
  USER_BEHAVIOR = 'USER_BEHAVIOR',
  FINANCIAL_PROFILE = 'FINANCIAL_PROFILE',
  INCOME_PATTERN = 'INCOME_PATTERN',
  SAVINGS_BEHAVIOR = 'SAVINGS_BEHAVIOR',
  PAYMENT_METHOD = 'PAYMENT_METHOD',
  TIME_PATTERN = 'TIME_PATTERN',
}

export interface AIMemoryEntry {
  id: string;
  userId: string;
  type: AIMemoryType;
  key: string; // Identifier (e.g., merchant name, category, day of week)
  value: any; // Structured data specific to memory type
  confidence: number; // 0-1, how confident the AI is about this pattern
  strength: number; // 0-100, how strong/frequent the pattern is
  occurrences: number; // Number of times pattern was observed
  createdAt: number;
  updatedAt: number;
  lastObservedAt: number;
  metadata?: Record<string, any>;
}

// Structured value types for each memory type

export interface SpendingPatternValue {
  pattern: 'weekend' | 'weekday' | 'monthly' | 'seasonal';
  avgAmount: number;
  frequency: number;
  categories: string[];
  description: string;
}

export interface MerchantCategoryValue {
  merchantName: string;
  category: string;
  avgAmount: number;
  frequency: number; // visits per month
  lastAmount?: number;
  totalSpent: number;
}

export interface RecurringExpenseValue {
  merchantName: string;
  category: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextExpectedDate?: string;
  isSubscription: boolean;
  confidence: number;
}

export interface UserBehaviorValue {
  behavior:
    | 'impulsive_spending'
    | 'budget_conscious'
    | 'weekend_spender'
    | 'online_shopper'
    | 'cash_user'
    | 'credit_user';
  evidence: string[];
  score: number; // 0-100
}

export interface FinancialProfileValue {
  profile: 'conservative' | 'moderate' | 'aggressive';
  savingsRate: number;
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
  debtToIncomeRatio?: number;
  riskTolerance: number; // 0-100
}

export interface IncomePatternValue {
  source: string;
  type: 'salary' | 'freelance' | 'investment' | 'other';
  avgAmount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfMonth?: number;
  isStable: boolean;
}

export interface SavingsBehaviorValue {
  avgMonthlySavings: number;
  savingsRate: number; // percentage
  consistency: number; // 0-100
  growthTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface PaymentMethodValue {
  method: 'credit_card' | 'debit_card' | 'cash' | 'pix' | 'boleto';
  usageRate: number; // percentage of transactions
  categories: string[];
}

export interface TimePatternValue {
  timeframe: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number; // 0-6
  avgAmount: number;
  frequency: number;
  categories: string[];
}

// Memory query filters

export interface MemoryQueryFilter {
  userId: string;
  type?: AIMemoryType;
  minConfidence?: number;
  minStrength?: number;
  startDate?: number;
  endDate?: number;
  limit?: number;
}

// Memory statistics

export interface MemoryStats {
  totalMemories: number;
  byType: Record<AIMemoryType, number>;
  avgConfidence: number;
  avgStrength: number;
  oldestMemory?: number;
  newestMemory?: number;
  lastUpdated: number;
}

// Memory events

export interface MemoryEvent {
  type: 'created' | 'updated' | 'strengthened' | 'weakened' | 'expired';
  memoryId: string;
  timestamp: number;
  changes?: Record<string, any>;
}

// Memory decay configuration

export interface MemoryDecayConfig {
  enabled: boolean;
  decayRate: number; // How much confidence/strength decreases over time
  minConfidence: number; // Below this, memory is deleted
  timeWindow: number; // Days to consider for relevance
}

// Memory learning configuration

export interface MemoryLearningConfig {
  minOccurrences: number; // Minimum observations before creating memory
  confidenceThreshold: number; // Minimum confidence to keep memory
  strengthIncrement: number; // How much to increase strength on observation
  maxMemoriesPerType: number; // Limit memories per type per user
}
