import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('eventEngine orchestrator routing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }) as unknown as typeof fetch,
    );
  });

  it('routes listener pipeline to legacy orchestrator module', async () => {
    const runLegacyAIOrchestratorMock = vi.fn().mockResolvedValue({
      profile: { profile: 'balanced' },
      risks: [{ id: 'risk_1' }],
      insights: [{ id: 'insight_1' }],
      autopilot_actions: [{ id: 'action_1' }],
      leaks: [],
    });

    const orchestratorMockFactory = () => ({
      runLegacyAIOrchestrator: runLegacyAIOrchestratorMock,
    });

    vi.doMock('../../src/ai/aiOrchestrator', orchestratorMockFactory);
    vi.doMock('../../src/ai/aiOrchestrator.ts', orchestratorMockFactory);

    vi.doMock('../../src/ai/financialGraph', () => ({
      invalidateGraphCache: vi.fn(),
      buildFinancialGraph: vi.fn(),
    }));

    vi.doMock('../../src/ai/leakDetector', () => ({
      detectFinancialLeaks: vi.fn(() => []),
    }));

    vi.doMock('../../src/finance/reportEngine', () => ({
      generateMonthlyReport: vi.fn(() => ({ summary: 'ok' })),
    }));

    const eventEngine = await import('../../src/events/eventEngine');

    const transactions = [
      {
        id: 'tx_1',
        amount: 100,
        type: 'Receita',
        category: 'Negocio',
        description: 'Recebimento',
        date: new Date().toISOString(),
      },
    ] as any[];

    const accounts = [{ id: 'acc_1', name: 'Conta', balance: 1000 }] as any[];

    const onInsights = vi.fn();
    const onRisks = vi.fn();
    const onAutopilotActions = vi.fn();

    const unsubscribe = eventEngine.initEventListeners(() => ({
      transactions,
      accounts,
      userId: 'user-routing',
      onInsights,
      onRisks,
      onAutopilotActions,
    }));

    eventEngine.emitFinancialEvent({
      type: 'transaction_created',
      payload: { id: 'tx_1' },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runLegacyAIOrchestratorMock).toHaveBeenCalledTimes(1);
    expect(runLegacyAIOrchestratorMock).toHaveBeenCalledWith('user-routing', accounts, transactions);
    expect(onInsights).toHaveBeenCalledTimes(1);
    expect(onRisks).toHaveBeenCalledTimes(1);
    expect(onAutopilotActions).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
