import { describe, expect, it, vi } from 'vitest';

const orchestratorMocks = vi.hoisted(() => ({
  detectAndLearnPatterns: vi.fn(),
  learnMemory: vi.fn(),
  updateAIMemory: vi.fn(),
  getAIMemory: vi.fn(),
  getAIMemorySnapshot: vi.fn(),
  runFinancialEngine: vi.fn(),
  detectFinancialProfile: vi.fn(),
  detectFinancialRisks: vi.fn(),
  generateFinancialInsights: vi.fn(),
  adjustCashflowWithPatterns: vi.fn(),
  generateAdaptiveInsights: vi.fn(),
  getAdaptiveLearningStats: vi.fn(),
  runFinancialAutopilot: vi.fn(),
  learnCategoryFromTransactions: vi.fn(),
  detectFinancialLeaks: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('../../src/ai/aiMemory', () => ({
  getAIMemory: orchestratorMocks.getAIMemory,
  getAIMemorySnapshot: orchestratorMocks.getAIMemorySnapshot,
  learnMemory: orchestratorMocks.learnMemory,
  detectAndLearnPatterns: orchestratorMocks.detectAndLearnPatterns,
}));

vi.mock('../../src/ai/financialEngine', () => ({
  runFinancialEngine: orchestratorMocks.runFinancialEngine,
}));

vi.mock('../../src/ai/behaviorAnalyzer', () => ({
  detectFinancialProfile: orchestratorMocks.detectFinancialProfile,
}));

vi.mock('../../src/ai/riskAnalyzer', () => ({
  detectFinancialRisks: orchestratorMocks.detectFinancialRisks,
}));

vi.mock('../../src/ai/insightGenerator', () => ({
  generateFinancialInsights: orchestratorMocks.generateFinancialInsights,
}));

vi.mock('../../src/ai/adaptiveAIEngine', () => ({
  adjustCashflowWithPatterns: orchestratorMocks.adjustCashflowWithPatterns,
  generateAdaptiveInsights: orchestratorMocks.generateAdaptiveInsights,
  getAdaptiveLearningStats: orchestratorMocks.getAdaptiveLearningStats,
}));

vi.mock('../../src/ai/financialAutopilot', () => ({
  runFinancialAutopilot: orchestratorMocks.runFinancialAutopilot,
}));

vi.mock('../../src/ai/categoryLearning', () => ({
  learnCategoryFromTransactions: orchestratorMocks.learnCategoryFromTransactions,
}));

vi.mock('../../src/ai/leakDetector', () => ({
  detectFinancialLeaks: orchestratorMocks.detectFinancialLeaks,
}));

vi.mock('../../src/ai/memory', () => ({
  updateAIMemory: orchestratorMocks.updateAIMemory,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: orchestratorMocks.logWarn,
}));

import { runLegacyAIOrchestrator } from '../../src/ai/aiOrchestrator';

describe('legacy AI orchestrator observability', () => {
  it('logs contextual data when background learning fails', async () => {
    orchestratorMocks.getAIMemory.mockResolvedValue([]);
    orchestratorMocks.runFinancialEngine.mockReturnValue({
      summary_all_time: { balance: 1000, income: 2000, expenses: 1000 },
      summary_current_month: { balance: 1000, income: 2000, expenses: 1000 },
      cashflow_prediction: { in7Days: 0, in30Days: 0, in90Days: 0 },
    });
    orchestratorMocks.adjustCashflowWithPatterns.mockImplementation((prediction) => prediction);
    orchestratorMocks.detectFinancialProfile.mockReturnValue({ profile: 'balanced' });
    orchestratorMocks.detectFinancialRisks.mockReturnValue([]);
    orchestratorMocks.generateFinancialInsights.mockReturnValue([{ message: 'ok', type: 'info', severity: 'low' }]);
    orchestratorMocks.generateAdaptiveInsights.mockReturnValue([]);
    orchestratorMocks.getAdaptiveLearningStats.mockReturnValue({
      is_learning: false,
      pattern_count: 0,
      memory_count: 0,
      last_run: null,
    });
    orchestratorMocks.runFinancialAutopilot.mockReturnValue([]);
    orchestratorMocks.detectFinancialLeaks.mockReturnValue([]);
    orchestratorMocks.learnCategoryFromTransactions.mockResolvedValue(undefined);
    orchestratorMocks.learnMemory.mockResolvedValue(undefined);
    orchestratorMocks.updateAIMemory.mockResolvedValue(undefined);
    orchestratorMocks.detectAndLearnPatterns.mockRejectedValueOnce(new Error('memory engine offline'));

    const result = await runLegacyAIOrchestrator('user-1', [], []);

    expect(result.user_id).toBe('user-1');
    expect(orchestratorMocks.logWarn).toHaveBeenCalledWith(
      '[AI Orchestrator] detectAndLearnPatterns failed',
      expect.objectContaining({
        userId: 'user-1',
        transactionCount: 0,
        error: expect.any(Error),
      }),
    );
  });
});
