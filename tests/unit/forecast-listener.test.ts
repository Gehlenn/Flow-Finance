import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscribeMock = vi.fn();
const predictMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock('../../src/events/eventEngine', () => ({
  subscribeToFinancialEvents: (callback: (event: { type: string; payload: unknown }) => void) => {
    subscribeMock(callback);
    return () => undefined;
  },
}));

vi.mock('../../src/engines/finance/cashflowPrediction/cashflowPredictionEngine', () => ({
  cashflowPredictionEngine: {
    predict: (...args: unknown[]) => predictMock(...args),
  },
}));

vi.mock('../../src/utils/logger', () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

describe('forecastListener', () => {
  beforeEach(() => {
    subscribeMock.mockReset();
    predictMock.mockReset();
    logErrorMock.mockReset();
    vi.clearAllMocks();
  });

  it('logs contextual data when forecast recalculation fails', async () => {
    predictMock.mockImplementation(() => {
      throw new Error('prediction offline');
    });

    const { registerForecastListener } = await import('../../src/events/listeners/forecastListener');
    registerForecastListener();

    const callback = subscribeMock.mock.calls[0]?.[0] as (event: { type: string; payload: unknown }) => void;
    callback({
      type: 'transaction_created',
      payload: { transactions: [{ id: 'tx-1' }], balance: 100 },
    });

    expect(predictMock).toHaveBeenCalledWith({
      transactions: [{ id: 'tx-1' }],
      balance: 100,
    });
    expect(logErrorMock).toHaveBeenCalledWith(
      '[ForecastListener] Erro ao recalcular previsao',
      expect.any(Error),
      expect.objectContaining({
        fallback: 'forecast-recalculation-failed',
        eventType: 'transaction_created',
        transactionCount: 1,
        balance: 100,
      }),
    );
  });
});
