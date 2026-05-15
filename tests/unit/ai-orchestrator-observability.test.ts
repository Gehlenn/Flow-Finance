import { describe, expect, it, vi } from 'vitest';

const orchestratorMocks = vi.hoisted(() => ({
  runFinancialEngine: vi.fn(),
  detectFinancialProfile: vi.fn(),
  detectFinancialRisks: vi.fn(),
  generateFinancialInsights: vi.fn(),
  runFinancialAutopilot: vi.fn(),
  learnCategoryFromTransactions: vi.fn(),
  detectFinancialLeaks: vi.fn(),
  logWarn: vi.fn(),
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

vi.mock('../../src/ai/financialAutopilot', () => ({
  runFinancialAutopilot: orchestratorMocks.runFinancialAutopilot,
}));

vi.mock('../../src/ai/categoryLearning', () => ({
  learnCategoryFromTransactions: orchestratorMocks.learnCategoryFromTransactions,
}));

vi.mock('../../src/ai/leakDetector', () => ({
  detectFinancialLeaks: orchestratorMocks.detectFinancialLeaks,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: orchestratorMocks.logWarn,
}));

import { runLegacyAIOrchestrator } from '../../src/ai/aiOrchestrator';

describe('legacy AI orchestrator observability', () => {
  it('returns result shape when pipeline dependencies succeed', async () => {
    orchestratorMocks.runFinancialEngine.mockReturnValue({
      summary_all_time: { balance: 1000, income: 2000, expenses: 1000 },
      summary_current_month: { balance: 1000, income: 2000, expenses: 1000 },
      cashflow_prediction: { in7Days: 0, in30Days: 0, in90Days: 0 },
    });
    orchestratorMocks.detectFinancialProfile.mockReturnValue({ profile: 'balanced' });
    orchestratorMocks.detectFinancialRisks.mockReturnValue([]);
    orchestratorMocks.generateFinancialInsights.mockReturnValue([{ message: 'ok', type: 'info', severity: 'low' }]);
    orchestratorMocks.runFinancialAutopilot.mockReturnValue([]);
    orchestratorMocks.learnCategoryFromTransactions.mockResolvedValue(undefined);
    orchestratorMocks.detectFinancialLeaks.mockReturnValue([]);

    const result = await runLegacyAIOrchestrator('user-1', [], []);

    expect(result.profile).toEqual({ profile: 'balanced' });
    expect(result.risks).toEqual([]);
    expect(result.insights).toHaveLength(1);
    expect(result.autopilot_actions).toEqual([]);
    expect(result.leaks).toEqual([]);
  });
});
