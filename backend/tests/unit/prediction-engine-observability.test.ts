import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../src/config/redis', () => ({
  cache: {
    get: mocks.redisGet,
    set: mocks.redisSet,
    del: vi.fn(),
  },
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: mocks.loggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import PredictionEngine from '../../src/services/PredictionEngine';

function buildHistory(transactionCount: number) {
  const transactions = Array.from({ length: transactionCount }, (_, index) => ({
    id: `tx-${index}`,
    date: new Date(Date.UTC(2026, 0, index + 1)),
    amount: index % 2 === 0 ? 100 : -50,
    type: index % 2 === 0 ? 'income' as const : 'expense' as const,
    category: index % 2 === 0 ? 'Receita' : 'Despesa',
    description: `Transaction ${index}`,
  }));

  return {
    userId: 'user-1',
    transactions,
    dateRange: { start: new Date(Date.UTC(2026, 0, 1)), end: new Date(Date.UTC(2026, 0, transactionCount)) },
    totalIncome: transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0),
    totalExpenses: Math.abs(transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0)),
    transactionCount: transactions.length,
  };
}

describe('PredictionEngine observability', () => {
  beforeEach(() => {
    mocks.redisGet.mockReset();
    mocks.redisSet.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue(undefined);
  });

  it('nao registra warn quando o cache Redis responde normalmente', async () => {
    mocks.redisGet.mockResolvedValueOnce(null);
    mocks.redisSet.mockResolvedValueOnce(undefined);

    const engine = new PredictionEngine({ defaultPredictionDays: 7 });
    const history = buildHistory(12);

    await expect(engine.predictCashFlow('user-ok', history, 7)).resolves.toMatchObject({
      userId: 'user-ok',
    });

    expect(mocks.loggerWarn).not.toHaveBeenCalled();
    expect(mocks.redisSet).toHaveBeenCalledWith(
      expect.stringContaining('prediction:v1:user-ok'),
      expect.any(String),
      expect.any(Number),
    );
  });

  it('registra contexto quando a leitura do cache Redis falha e cai para memoria', async () => {
    mocks.redisGet.mockRejectedValueOnce(new Error('redis read failed'));

    const engine = new PredictionEngine({ defaultPredictionDays: 7 });
    const history = buildHistory(10);

    await expect(engine.predictCashFlow('user-1', history, 7)).resolves.toMatchObject({
      userId: 'user-1',
    });

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        userId: 'user-1',
        cacheKey: 'prediction:v1:user-1',
        fallback: 'prediction-engine-cache-read-failed',
      }),
      'PredictionEngine: Redis cache read failed, falling back to memory',
    );
  });

  it('registra contexto quando a escrita do cache Redis falha e mantem cache em memoria', async () => {
    mocks.redisGet.mockResolvedValueOnce(null);
    mocks.redisSet.mockRejectedValueOnce(new Error('redis write failed'));

    const engine = new PredictionEngine({ defaultPredictionDays: 7 });
    const history = buildHistory(12);

    await expect(engine.predictCashFlow('user-1', history, 7)).resolves.toMatchObject({
      userId: 'user-1',
    });

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        userId: 'user-1',
        cacheKey: 'prediction:v1:user-1',
        fallback: 'prediction-engine-cache-write-failed',
      }),
      'PredictionEngine: Redis cache write failed, memory-only cache active',
    );
  });
});
