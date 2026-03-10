import { describe, expect, it, vi } from 'vitest';

async function setupPipeline(queueReady: boolean) {
  vi.resetModules();

  const analyzeMock = vi.fn(() => [
    { type: 'overspending', message: 'Voce esta gastando mais do que ganha.' },
  ]);

  const isInitializedMock = vi.fn(() => queueReady);
  const initializeMock = vi.fn();
  const enqueueTaskMock = vi.fn();
  const getQueueStatsMock = vi.fn(() => ({
    pending: 1,
    processing: 2,
    completed: 3,
    failed: 0,
  }));

  const recordMetricMock = vi.fn();
  const recordDurationMock = vi.fn();

  vi.doMock('../../src/engines/autopilot/financialAutopilot', () => ({
    FinancialAutopilot: class {
      analyze = analyzeMock;
    },
  }));

  vi.doMock('../../src/ai/queue', () => ({
    AITaskType: {
      INSIGHT_GENERATION: 'INSIGHT_GENERATION',
    },
    aiTaskQueue: {
      isInitialized: isInitializedMock,
      initialize: initializeMock,
      enqueueTask: enqueueTaskMock,
      getQueueStats: getQueueStatsMock,
    },
  }));

  vi.doMock('../../src/observability', () => ({
    recordMetric: recordMetricMock,
    recordDuration: recordDurationMock,
  }));

  const { initializeFinancialEventPipeline } = await import('../../src/events/financialEventPipeline');
  const { eventBus } = await import('../../src/events/EventBus');
  const { TRANSACTION_CREATED_EVENT } = await import('../../src/events/financialEvents/TransactionCreated');

  return {
    initializeFinancialEventPipeline,
    eventBus,
    TRANSACTION_CREATED_EVENT,
    analyzeMock,
    isInitializedMock,
    initializeMock,
    enqueueTaskMock,
    recordMetricMock,
    recordDurationMock,
  };
}

describe('financialEventPipeline', () => {
  it('processes transaction_created and enqueues insight generation', async () => {
    const ctx = await setupPipeline(false);

    ctx.initializeFinancialEventPipeline();

    ctx.eventBus.emit(ctx.TRANSACTION_CREATED_EVENT, {
      userId: 'user-1',
      transactionId: 'tx-1',
      amount: 300,
      category: 'food',
      transaction: {
        id: 'tx-1',
        amount: 300,
        type: 'expense',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ctx.initializeMock).toHaveBeenCalledTimes(1);
    expect(ctx.analyzeMock).toHaveBeenCalledTimes(1);
    expect(ctx.enqueueTaskMock).toHaveBeenCalledTimes(1);
    expect(ctx.enqueueTaskMock).toHaveBeenCalledWith(
      'INSIGHT_GENERATION',
      expect.objectContaining({ trigger: 'transaction_created' }),
      'user-1'
    );

    expect(ctx.recordMetricMock).toHaveBeenCalledWith('autopilot.alerts.count', 1);
    expect(ctx.recordMetricMock).toHaveBeenCalledWith('ai.queue.pending', 1);
    expect(ctx.recordDurationMock).toHaveBeenCalledWith('event.transaction_created.total_ms', expect.any(Number));
  });

  it('does not initialize queue if queue is already ready', async () => {
    const ctx = await setupPipeline(true);

    ctx.initializeFinancialEventPipeline();

    ctx.eventBus.emit(ctx.TRANSACTION_CREATED_EVENT, {
      userId: 'user-2',
      transactionId: 'tx-2',
      amount: 1200,
      category: 'salary',
      transaction: {
        id: 'tx-2',
        amount: 1200,
        type: 'income',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ctx.isInitializedMock).toHaveBeenCalled();
    expect(ctx.initializeMock).not.toHaveBeenCalled();
    expect(ctx.enqueueTaskMock).toHaveBeenCalledTimes(1);
  });

  it('registers listeners only once even if initialized twice', async () => {
    const ctx = await setupPipeline(false);

    ctx.initializeFinancialEventPipeline();
    ctx.initializeFinancialEventPipeline();

    ctx.eventBus.emit(ctx.TRANSACTION_CREATED_EVENT, {
      userId: 'user-3',
      transactionId: 'tx-3',
      amount: 50,
      category: 'misc',
      transaction: {
        id: 'tx-3',
        amount: 50,
        type: 'expense',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ctx.enqueueTaskMock).toHaveBeenCalledTimes(1);
  });
});
