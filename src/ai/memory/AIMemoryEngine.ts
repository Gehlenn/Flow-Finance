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
import {
  analyzeSpendingPatterns,
  analyzeMerchantCategories,
  analyzeRecurringExpenses,
  analyzeUserBehavior,
  analyzeFinancialProfile,
  analyzeIncomePatterns,
  analyzeTimePatterns,
} from './memoryAnalyzer';

const DEFAULT_LEARNING_CONFIG: MemoryLearningConfig = {
  minOccurrences: 3,
  confidenceThreshold: 0.3,
  strengthIncrement: 10,
  maxMemoriesPerType: 50,
};

class AIMemoryEngine {
  private learningConfig: MemoryLearningConfig = DEFAULT_LEARNING_CONFIG;

  /**
   * Simple update path used by event-driven/orchestrator flow.
   */
  updateMemory(patterns: FinancialPatterns, userId: string = 'local'): void {
    if (patterns.recurring.length > 0) {
      aiMemoryStore.save({
        userId,
        type: AIMemoryType.RECURRING_EXPENSE,
        key: 'recurring_expenses',
        value: patterns.recurring,
        confidence: 0.85,
        strength: Math.min(100, patterns.recurring.length * 15),
      });
    }

    if (patterns.weeklySpikes.length > 0) {
      aiMemoryStore.save({
        userId,
        type: AIMemoryType.SPENDING_PATTERN,
        key: 'weekly_spikes',
        value: patterns.weeklySpikes,
        confidence: 0.75,
        strength: Math.min(100, patterns.weeklySpikes.length * 5),
      });
    }

    if (patterns.categoryDominance) {
      aiMemoryStore.save({
        userId,
        type: AIMemoryType.SPENDING_PATTERN,
        key: 'category_dominance',
        value: {
          category: patterns.categoryDominance[0],
          amount: patterns.categoryDominance[1],
        },
        confidence: 0.8,
        strength: 60,
      });
    }
  }

  /**
   * Main function to update AI memory based on transactions
   */
  async updateAIMemory(userId: string, transactions: Transaction[]): Promise<number> {
    if (transactions.length < this.learningConfig.minOccurrences) {
      console.log('[AI Memory Engine] Not enough transactions to learn from');
      return 0;
    }

    let memoriesUpdated = 0;

    try {
      // 1. Analyze spending patterns
      const spendingPatterns = analyzeSpendingPatterns(transactions);
      for (const [key, pattern] of spendingPatterns) {
        this.saveOrUpdateMemory(userId, AIMemoryType.SPENDING_PATTERN, key, pattern, 0.7);
        memoriesUpdated++;
      }

      // 2. Analyze merchant categories
      const merchantCategories = analyzeMerchantCategories(transactions);
      for (const [key, merchant] of merchantCategories) {
        const confidence = Math.min(1, merchant.frequency / 4); // 4+ visits/month = high confidence
        this.saveOrUpdateMemory(userId, AIMemoryType.MERCHANT_CATEGORY, key, merchant, confidence);
        memoriesUpdated++;
      }

      // 3. Analyze recurring expenses
      const recurringExpenses = analyzeRecurringExpenses(transactions);
      for (const [key, recurring] of recurringExpenses) {
        this.saveOrUpdateMemory(
          userId,
          AIMemoryType.RECURRING_EXPENSE,
          key,
          recurring,
          recurring.confidence
        );
        memoriesUpdated++;
      }

      // 4. Analyze user behavior
      const userBehaviors = analyzeUserBehavior(transactions);
      for (const [key, behavior] of userBehaviors) {
        const confidence = behavior.score / 100;
        this.saveOrUpdateMemory(userId, AIMemoryType.USER_BEHAVIOR, key, behavior, confidence);
        memoriesUpdated++;
      }

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
      for (const [key, pattern] of incomePatterns) {
        const confidence = pattern.isStable ? 0.9 : 0.6;
        this.saveOrUpdateMemory(userId, AIMemoryType.INCOME_PATTERN, key, pattern, confidence);
        memoriesUpdated++;
      }

      // 7. Analyze time patterns
      const timePatterns = analyzeTimePatterns(transactions);
      for (const [key, pattern] of timePatterns) {
        const confidence = Math.min(1, pattern.frequency / 5);
        this.saveOrUpdateMemory(userId, AIMemoryType.TIME_PATTERN, key, pattern, confidence);
        memoriesUpdated++;
      }

      console.log(`[AI Memory Engine] Updated ${memoriesUpdated} memories for user ${userId}`);
    } catch (error) {
      console.error('[AI Memory Engine] Error updating memories:', error);
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
    value: any,
    confidence: number
  ): void {
    // Check if memory already exists
    const existing = aiMemoryStore
      .getMemoriesByType(userId, type)
      .find((m) => m.key === key);

    const now = Date.now();

    if (existing) {
      // Update existing memory
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
      });
    } else {
      // Create new memory
      const memory: AIMemoryEntry = {
        id: this.generateMemoryId(),
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

  private generateMemoryId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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

export function getUserMemoryProfile(userId: string) {
  return aiMemoryStore.getUserMemoryProfile(userId);
}
