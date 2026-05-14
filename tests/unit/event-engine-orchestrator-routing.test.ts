import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const logWarnMock = vi.fn();
const logErrorMock = vi.fn();
const logInfoMock = vi.fn();
const subscribeMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => logWarnMock(...args),
  logError: (...args: unknown[]) => logErrorMock(...args),
  logInfo: (...args: unknown[]) => logInfoMock(...args),
}));

vi.mock('../../src/events/eventEngine', () => ({
  subscribeToFinancialEvents: (callback: (event: { type: string; payload: unknown }) => void) => {
    subscribeMock(callback);
    return () => undefined;
  },
}));

vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

describe('eventEngine orchestrator routing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();

    vi.stubGlobal(
      'fetch',
      fetchMock.mockReset().mockResolvedValue({
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
    const onLeaks = vi.fn();
    const onReport = vi.fn();

    const unsubscribe = eventEngine.initEventListeners(() => ({
      transactions,
      accounts,
      userId: 'user-routing',
      onInsights,
      onRisks,
      onAutopilotActions,
      onLeaks,
      onReport,
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
    expect(onLeaks).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('logs contextual data when the listener pipeline fails', async () => {
    const runLegacyAIOrchestratorMock = vi.fn().mockRejectedValue(new Error('pipeline offline'));

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

    const unsubscribe = eventEngine.initEventListeners(() => ({
      transactions,
      accounts,
      userId: 'user-routing',
    }));

    eventEngine.emitFinancialEvent({
      type: 'transaction_created',
      payload: { id: 'tx_1' },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(logErrorMock).toHaveBeenCalledWith(
      '[EventEngine] listener pipeline error',
      expect.any(Error),
      expect.objectContaining({
        eventType: 'transaction_created',
        userId: 'user-routing',
        transactionCount: 1,
        fallback: 'event-engine-listener-pipeline-failed',
      }),
    );

    unsubscribe();
  });

  it('logs contextual data when remote event persistence fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('persist offline'));

    const { emitFinancialEvent } = await import('../../src/events/eventEngine');

    emitFinancialEvent({
      type: 'transaction_created',
      payload: { id: 'tx-remote' },
    });

    await Promise.resolve();

    expect(logWarnMock).toHaveBeenCalledWith(
      '[EventEngine] Failed to persist event remotely',
      expect.objectContaining({
        error: expect.any(Error),
        eventType: 'transaction_created',
        fallback: 'event-engine-remote-persist-failed',
      }),
    );
  });

  it('logs contextual data when a subscriber throws', async () => {
    const { emitFinancialEvent, subscribeToFinancialEvents } = await import('../../src/events/eventEngine');
    const subscriberError = new Error('subscriber offline');
    const unsubscribe = subscribeToFinancialEvents(() => {
      throw subscriberError;
    });

    emitFinancialEvent({
      type: 'transaction_created',
      payload: { id: 'tx-subscriber' },
    });

    expect(logErrorMock).toHaveBeenCalledWith(
      '[EventEngine] subscriber error',
      subscriberError,
      expect.objectContaining({
        eventType: 'transaction_created',
        fallback: 'event-engine-subscriber-failed',
      }),
    );

    unsubscribe();
  });
});
