/**
 * AI Memory Engine
 * Main engine for learning and updating AI memories
 */

import { Transaction } from '../../../types';
import { aiMemoryStore } from './AIMemoryStore';
import {
  AIMemoryEntry,
  AIMemoryType,
  MemoryLearningConfig,
  SpendingPatternValue,
  MerchantCategoryValue,
  RecurringExpenseValue,
  UserBehaviorValue,
  FinancialProfileValue,
  IncomePatternValue,
  TimePatternValue,
} from './memoryTypes';
import { FinancialPatterns } from '../../engines/finance/patternDetector/financialPatternDetector';
import { logInfo, logWarn } from '../../utils/logger';
import {
  analyzeSpendingPatterns,
  analyzeMerchantCategories,
  analyzeRecurringExpenses,
  analyzeUserBehavior,
  analyzeFinancialProfile,
  analyzeIncomePatterns,
  analyzeTimePatterns,
} from './memoryAnalyzer';
import { MoneyMapSlice } from '../../engines/finance/moneyMap/moneyMapEngine';
import {
  buildFeedbackMetadata,
  buildMemoryUpdateMetadata,
  generateAIMemoryId,
  persistAnalyzedMemorySet,
} from './AIMemoryEngineHelpers';

const DEFAULT_LEARNING_CONFIG: MemoryLearningConfig = {
  minOccurrences: 3,
  confidenceThreshold: 0.3,
  strengthIncrement: 10,
  maxMemoriesPerType: 50,
};

class AIMemoryEngine {
  private learningConfig: MemoryLearningConfig = DEFAULT_LEARNING_CONFIG;

  private readonly feedbackImpact = {
    positive: { confidence: 0.08, strength: 8 },
    negative: { confidence: -0.12, strength: -12 },
  };

  private applyFeedbackToMemory(
    memory: AIMemoryEntry,
    feedback: 'positive' | 'negative',
    context?: string,
  ): void {
    const impact = this.feedbackImpact[feedback];
    const nextConfidence = Math.min(1, Math.max(0, memory.confidence + impact.confidence));
    const nextStrength = Math.min(100, Math.max(0, memory.strength + impact.strength));

    aiMemoryStore.updateMemory(memory.id, {
      confidence: nextConfidence,
      strength: nextStrength,
      metadata: buildFeedbackMetadata(memory, feedback, context),
    });
  }

  /**
   * Simple update path used by event-driven/orchestrator flow.
   */
  updateMemory(
    patterns: FinancialPatterns,
    userId: string = 'local',
    supplemental?: { moneyMap?: MoneyMapSlice[] }
  ): void {
    if (patterns.recurring.length > 0) {
      this.saveOrUpdateMemory(
        userId,
        AIMemoryType.RECURRING_EXPENSE,
        'recurring_expenses',
        patterns.recurring,
        0.85
      );
    }

    if (patterns.weeklySpikes.length > 0) {
      this.saveOrUpdateMemory(
        userId,
        AIMemoryType.SPENDING_PATTERN,
        'weekly_spikes',
        patterns.weeklySpikes,
        0.75
      );
    }

    if (patterns.categoryDominance) {
      this.saveOrUpdateMemory(
        userId,
        AIMemoryType.SPENDING_PATTERN,
        'category_dominance',
        {
          category: patterns.categoryDominance[0],
          amount: patterns.categoryDominance[1],
        },
        0.8
      );
    }

    if (supplemental?.moneyMap && supplemental.moneyMap.length > 0) {
      this.saveOrUpdateMemory(
        userId,
        AIMemoryType.SPENDING_PATTERN,
        'money_map_distribution',
        supplemental.moneyMap,
        0.8
      );
    }
  }

  /**
   * Main function to update AI memory based on transactions
   */
  async updateAIMemory(userId: string, transactions: Transaction[]): Promise<number> {
    if (transactions.length < this.learningConfig.minOccurrences) {
      logWarn('[AI Memory Engine] Not enough transactions to learn from', {
        userId,
        transactionCount: transactions.length,
        minOccurrences: this.learningConfig.minOccurrences,
        fallback: 'ai-memory-engine-not-enough-transactions',
      });
      return 0;
    }

    let memoriesUpdated = 0;

    try {
      // 1. Analyze spending patterns
      const spendingPatterns = analyzeSpendingPatterns(transactions);
      memoriesUpdated += persistAnalyzedMemorySet({
        userId,
        type: AIMemoryType.SPENDING_PATTERN,
        values: spendingPatterns,
        saveOrUpdate: this.saveOrUpdateMemory.bind(this),
        confidenceFor: () => 0.7,
      });

      // 2. Analyze merchant categories
      const merchantCategories = analyzeMerchantCategories(transactions);
      memoriesUpdated += persistAnalyzedMemorySet({
        userId,
        type: AIMemoryType.MERCHANT_CATEGORY,
        values: merchantCategories,
        saveOrUpdate: this.saveOrUpdateMemory.bind(this),
        confidenceFor: (merchant) => Math.min(1, merchant.frequency / 4),
      });

      // 3. Analyze recurring expenses
      const recurringExpenses = analyzeRecurringExpenses(transactions);
      memoriesUpdated += persistAnalyzedMemorySet({
        userId,
        type: AIMemoryType.RECURRING_EXPENSE,
        values: recurringExpenses,
        saveOrUpdate: this.saveOrUpdateMemory.bind(this),
        confidenceFor: (recurring) => recurring.confidence,
      });

      // 4. Analyze user behavior
      const userBehaviors = analyzeUserBehavior(transactions);
      memoriesUpdated += persistAnalyzedMemorySet({
        userId,
        type: AIMemoryType.USER_BEHAVIOR,
        values: userBehaviors,
        saveOrUpdate: this.saveOrUpdateMemory.bind(this),
        confidenceFor: (behavior) => behavior.score / 100,
      });

      // 5. Analyze financial profile
      const financialProfile = analyzeFinancialProfile(transactions);
      if (financialProfile) {
        this.saveOrUpdateMemory(
          userId,
          AIMemoryType.FINANCIAL_PROFILE,
          'profile',
          financialProfile,
          0.85
        );
        memoriesUpdated++;
      }

      // 6. Analyze income patterns
      const incomePatterns = analyzeIncomePatterns(transactions);
      memoriesUpdated += persistAnalyzedMemorySet({
        userId,
        type: AIMemoryType.INCOME_PATTERN,
        values: incomePatterns,
        saveOrUpdate: this.saveOrUpdateMemory.bind(this),
        confidenceFor: (pattern) => (pattern.isStable ? 0.9 : 0.6),
      });

      // 7. Analyze time patterns
      const timePatterns = analyzeTimePatterns(transactions);
      memoriesUpdated += persistAnalyzedMemorySet({
        userId,
        type: AIMemoryType.TIME_PATTERN,
        values: timePatterns,
        saveOrUpdate: this.saveOrUpdateMemory.bind(this),
        confidenceFor: (pattern) => Math.min(1, pattern.frequency / 5),
      });

      logInfo('[AI Memory Engine] Updated memories for user', {
        userId,
        memoriesUpdated,
        fallback: 'ai-memory-engine-updated-memories',
      });
    } catch (error) {
      logWarn('[AI Memory Engine] Error updating memories; continuing without persistence', {
        userId,
        error,
      });
    }

    return memoriesUpdated;
  }

  /**
   * Save or update a memory entry
   */
  private saveOrUpdateMemory(
    userId: string,
    type: AIMemoryType,
    key: string,
    value: unknown,
    confidence: number
  ): void {
    const memoriesOfType = aiMemoryStore.getMemoriesByType(userId, type);
    const existing = memoriesOfType.find((m) => m.key === key);

    const now = Date.now();
    const metadata = buildMemoryUpdateMetadata(type, key, confidence, now, existing?.metadata);

    if (existing) {
      const newOccurrences = existing.occurrences + 1;
      const newStrength = Math.min(100, existing.strength + this.learningConfig.strengthIncrement);
      const newConfidence = Math.min(1, (existing.confidence + confidence) / 2);

      aiMemoryStore.updateMemory(existing.id, {
        value,
        confidence: newConfidence,
        strength: newStrength,
        occurrences: newOccurrences,
        updatedAt: now,
        lastObservedAt: now,
        metadata,
      });
    } else {
      const memory: AIMemoryEntry = {
        id: generateAIMemoryId(now),
        userId,
        type,
        key,
        value,
        confidence,
        strength: this.learningConfig.strengthIncrement,
        occurrences: 1,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: now,
        metadata,
      };

      aiMemoryStore.saveMemory(memory);
    }
  }

  /**
   * Get memories for a specific user and type
   */
  getMemories(userId: string, type?: AIMemoryType): AIMemoryEntry[] {
    if (type) {
      return aiMemoryStore.getMemoriesByType(userId, type);
    }
    return aiMemoryStore.getMemoriesByUser(userId);
  }

  /**
   * Get high-confidence memories
   */
  getStrongMemories(userId: string, minStrength: number = 50): AIMemoryEntry[] {
    return aiMemoryStore.queryMemories({
      userId,
      minStrength,
      minConfidence: 0.5,
    });
  }

  /**
   * Get memories by type with minimum confidence
   */
  getMemoriesByType(userId: string, type: AIMemoryType, minConfidence: number = 0.3): AIMemoryEntry[] {
    return aiMemoryStore.queryMemories({
      userId,
      type,
      minConfidence,
    });
  }

  /**
   * Get spending pattern memories
   */
  getSpendingPatterns(userId: string): SpendingPatternValue[] {
    return this.getMemoriesByType(userId, AIMemoryType.SPENDING_PATTERN).map(
      (m) => m.value as SpendingPatternValue
    );
  }

  /**
   * Get merchant category memories
   */
  getMerchantCategories(userId: string): MerchantCategoryValue[] {
    return this.getMemoriesByType(userId, AIMemoryType.MERCHANT_CATEGORY).map(
      (m) => m.value as MerchantCategoryValue
    );
  }

  /**
   * Get recurring expense memories
   */
  getRecurringExpenses(userId: string): RecurringExpenseValue[] {
    return this.getMemoriesByType(userId, AIMemoryType.RECURRING_EXPENSE).map(
      (m) => m.value as RecurringExpenseValue
    );
  }

  /**
   * Get user behavior memories
   */
  getUserBehaviors(userId: string): UserBehaviorValue[] {
    return this.getMemoriesByType(userId, AIMemoryType.USER_BEHAVIOR).map(
      (m) => m.value as UserBehaviorValue
    );
  }

  /**
   * Get financial profile
   */
  getFinancialProfile(userId: string): FinancialProfileValue | null {
    const memories = this.getMemoriesByType(userId, AIMemoryType.FINANCIAL_PROFILE);
    return memories.length > 0 ? (memories[0].value as FinancialProfileValue) : null;
  }

  /**
   * Get income patterns
   */
  getIncomePatterns(userId: string): IncomePatternValue[] {
    return this.getMemoriesByType(userId, AIMemoryType.INCOME_PATTERN).map(
      (m) => m.value as IncomePatternValue
    );
  }

  /**
   * Check if user has a specific behavior pattern
   */
  hasBehavior(userId: string, behavior: UserBehaviorValue['behavior']): boolean {
    const behaviors = this.getUserBehaviors(userId);
    return behaviors.some((b) => b.behavior === behavior && b.score > 50);
  }

  /**
   * Get memory statistics for user
   */
  getStats(userId: string) {
    return aiMemoryStore.getStats(userId);
  }

  recordMemoryFeedback(
    userId: string,
    type: AIMemoryType,
    key: string,
    feedback: 'positive' | 'negative',
    context?: string,
  ): boolean {
    const memory = aiMemoryStore
      .getMemoriesByType(userId, type)
      .find((entry) => entry.key === key);

    if (!memory) {
      return false;
    }

    this.applyFeedbackToMemory(memory, feedback, context);
    return true;
  }

  /**
   * Clear all memories for a user
   */
  clearUserMemories(userId: string): void {
    aiMemoryStore.clearUserMemories(userId);
  }

  /**
   * Set learning configuration
   */
  setLearningConfig(config: Partial<MemoryLearningConfig>): void {
    this.learningConfig = { ...this.learningConfig, ...config };
  }

}

// Singleton instance
export const aiMemoryEngine = new AIMemoryEngine();

// Export convenience functions
export async function updateAIMemory(userId: string, transactions: Transaction[]): Promise<number> {
  return aiMemoryEngine.updateAIMemory(userId, transactions);
}

export function getAIMemories(userId: string, type?: AIMemoryType): AIMemoryEntry[] {
  return aiMemoryEngine.getMemories(userId, type);
}

export function getSpendingPatterns(userId: string): SpendingPatternValue[] {
  return aiMemoryEngine.getSpendingPatterns(userId);
}

export function getMerchantCategories(userId: string): MerchantCategoryValue[] {
  return aiMemoryEngine.getMerchantCategories(userId);
}

export function getRecurringExpenses(userId: string): RecurringExpenseValue[] {
  return aiMemoryEngine.getRecurringExpenses(userId);
}

export function getUserBehaviors(userId: string): UserBehaviorValue[] {
  return aiMemoryEngine.getUserBehaviors(userId);
}

export function getFinancialProfile(userId: string): FinancialProfileValue | null {
  return aiMemoryEngine.getFinancialProfile(userId);
}

export function getIncomePatterns(userId: string): IncomePatternValue[] {
  return aiMemoryEngine.getIncomePatterns(userId);
}

export function hasBehavior(userId: string, behavior: UserBehaviorValue['behavior']): boolean {
  return aiMemoryEngine.hasBehavior(userId, behavior);
}

export function getMemoryStats(userId: string) {
  return aiMemoryEngine.getStats(userId);
}

export function recordMemoryFeedback(
  userId: string,
  type: AIMemoryType,
  key: string,
  feedback: 'positive' | 'negative',
  context?: string,
): boolean {
  return aiMemoryEngine.recordMemoryFeedback(userId, type, key, feedback, context);
}

export function getUserMemoryProfile(userId: string) {
  return aiMemoryStore.getUserMemoryProfile(userId);
}
