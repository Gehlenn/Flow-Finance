import { describe, expect, it, vi } from 'vitest';

const orchestratorMocks = vi.hoisted(() => ({
  runFinancialEngine: vi.fn(),
  getAIMemory: vi.fn(),
  getAIMemorySnapshot: vi.fn(),
  computeFinancialSignals: vi.fn(),
  signalsToInsights: vi.fn(),
  signalsToRisks: vi.fn(),
  buildConsultantProfile: vi.fn(),
  toLegacyAutopilotActions: vi.fn(),
}));

vi.mock('../../src/ai/financialEngine', () => ({
  runFinancialEngine: orchestratorMocks.runFinancialEngine,
}));

vi.mock('../../src/ai/aiMemory', () => ({
  getAIMemory: orchestratorMocks.getAIMemory,
  getAIMemorySnapshot: orchestratorMocks.getAIMemorySnapshot,
}));

vi.mock('../../src/ai/signalEngine', () => ({
  computeFinancialSignals: orchestratorMocks.computeFinancialSignals,
  signalsToInsights: orchestratorMocks.signalsToInsights,
  signalsToRisks: orchestratorMocks.signalsToRisks,
  buildConsultantProfile: orchestratorMocks.buildConsultantProfile,
  toLegacyAutopilotActions: orchestratorMocks.toLegacyAutopilotActions,
}));

import { runLegacyAIOrchestrator, runAIPipelineSync } from '../../src/ai/aiOrchestrator';

describe('legacy AI orchestrator observability', () => {
  it('returns the consultative shape with compatibility actions', async () => {
    orchestratorMocks.runFinancialEngine.mockReturnValue({
      cashflow_prediction: {
        current_balance: 1000,
        balance_7_days: 900,
        balance_30_days: 800,
        projected_income: 3000,
        projected_expenses: 2200,
      },
    });
    orchestratorMocks.computeFinancialSignals.mockReturnValue([
      {
        id: 'signal-1',
        kind: 'expense_pattern',
        severity: 'attention',
        title: 'Aceleracao de despesas',
        description: 'Despesas acima da referencia recente.',
        evidence: {},
        computed_at: '2026-05-15T00:00:00.000Z',
      },
    ]);
    orchestratorMocks.signalsToInsights.mockReturnValue([
      {
        id: 'signal-1',
        user_id: 'user-1',
        type: 'spending',
        message: 'Despesas acima da referencia recente.',
        severity: 'medium',
        created_at: '2026-05-15T00:00:00.000Z',
      },
    ]);
    orchestratorMocks.signalsToRisks.mockReturnValue([
      {
        id: 'risk-1',
        type: 'spending_acceleration',
        message: 'Despesas acima da referencia recente.',
        severity: 'medium',
      },
    ]);
    orchestratorMocks.buildConsultantProfile.mockReturnValue({
      emoji: '📊',
      label: 'Fluxo em observacao',
      profile: 'observacao',
      description: 'Descricao curta.',
      score: {
        disciplina: 7,
        previsibilidade: 6,
      },
    });
    orchestratorMocks.toLegacyAutopilotActions.mockReturnValue([
      {
        id: 'signal-1',
        type: 'warning',
        title: 'Aceleracao de despesas',
        description: 'Despesas acima da referencia recente.',
        severity: 'medium',
        created_at: '2026-05-15T00:00:00.000Z',
      },
    ]);
    orchestratorMocks.getAIMemory.mockResolvedValue([]);
    orchestratorMocks.getAIMemorySnapshot.mockReturnValue([]);

    const result = await runLegacyAIOrchestrator('user-1', [], []);

    expect(result.profile.profile).toBe('observacao');
    expect(result.risks).toHaveLength(1);
    expect(result.insights).toHaveLength(1);
    expect(result.autopilot_actions).toHaveLength(1);
    expect(result.leaks).toEqual([]);
  });

  it('keeps a sync pipeline available for lightweight render paths', () => {
    orchestratorMocks.runFinancialEngine.mockReturnValue({
      cashflow_prediction: {
        current_balance: 1000,
        balance_7_days: 900,
        balance_30_days: 800,
        projected_income: 3000,
        projected_expenses: 2200,
      },
    });
    orchestratorMocks.computeFinancialSignals.mockReturnValue([]);
    orchestratorMocks.signalsToInsights.mockReturnValue([]);
    orchestratorMocks.signalsToRisks.mockReturnValue([]);
    orchestratorMocks.buildConsultantProfile.mockReturnValue({
      emoji: '📊',
      label: 'Fluxo em observacao',
      profile: 'observacao',
      description: 'Descricao curta.',
      score: {
        disciplina: 7,
        previsibilidade: 6,
      },
    });
    orchestratorMocks.getAIMemorySnapshot.mockReturnValue([{ key: 'k', value: 'v', confidence: 0.7 }]);

    const result = runAIPipelineSync([], 'user-2');

    expect(result.financial_state.cashflow_prediction.current_balance).toBe(1000);
    expect(result.profile.profile).toBe('observacao');
    expect(result.health_score).toBeGreaterThanOrEqual(0);
  });
});
