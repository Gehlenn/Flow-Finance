/**
 * AI Memory System 2.0 - Public exports
 */

export { aiMemoryStore } from './AIMemoryStore';
export { aiMemoryEngine } from './AIMemoryEngine';

export {
  updateAIMemory,
  getAIMemories,
  getSpendingPatterns,
  getMerchantCategories,
  getRecurringExpenses,
  getUserBehaviors,
  getFinancialProfile,
  getIncomePatterns,
  hasBehavior,
  getMemoryStats,
} from './AIMemoryEngine';

export * from './memoryTypes';
export * from './memoryAnalyzer';
