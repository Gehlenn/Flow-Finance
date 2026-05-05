import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../config/redis', () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    del: vi.fn(async () => undefined),
  },
}));

vi.mock('../config/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PredictionEngine } from './PredictionEngine';
import { cache as redisCache } from '../config/redis';

const mockGet = redisCache.get as ReturnType<typeof vi.fn>;
const mockSet = redisCache.set as ReturnType<typeof vi.fn>;
const mockDel = redisCache.del as ReturnType<typeof vi.fn>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTransactions(count = 15) {
  const transactions = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    transactions.push({
      id: `tx-${i}`,
      date: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
      amount: i % 3 === 0 ? 500 : -200,
      type: i % 3 === 0 ? ('income' as const) : ('expense' as const),
      category: 'general',
      description: `Tx ${i}`,
    });
  }
  return transactions;
}

const historicalData = { transactions: makeTransactions(20) };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PredictionEngine', () => {
  let engine: PredictionEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new PredictionEngine();
  });

  describe('predictCashFlow', () => {
    it('lança erro com dados insuficientes (< 10 transações)', async () => {
      const sparse = { transactions: makeTransactions(5) };
      await expect(engine.predictCashFlow('u-1', sparse)).rejects.toThrow(
        'Insufficient historical data',
      );
    });

    it('retorna previsão com os campos obrigatórios', async () => {
      const result = await engine.predictCashFlow('u-1', historicalData, 7);

      expect(result.userId).toBe('u-1');
      expect(result.dailyPredictions).toHaveLength(7);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.trend).toMatch(/^(up|down|stable)$/);
      expect(result.factors).toBeInstanceOf(Array);
    });

    it('escreve no Redis após calcular (best-effort, não-bloqueante)', async () => {
      await engine.predictCashFlow('u-write', historicalData, 7);

      // aguarda micro-task do .catch()
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining('prediction:v1:u-write'),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('usa cache Redis quando disponível (evita recalcular)', async () => {
      const cachedPrediction = {
        userId: 'u-cached',
        dateRange: { start: new Date(), end: new Date() },
        dailyPredictions: [],
        confidence: 0.8,
        trend: 'stable' as const,
        factors: [],
        generatedAt: new Date(),
      };
      const expiresAt = new Date(Date.now() + 60_000);
      mockGet.mockResolvedValueOnce(JSON.stringify({ prediction: cachedPrediction, expiresAt }));

      const result = await engine.predictCashFlow('u-cached', historicalData, 7);

      expect(result.userId).toBe('u-cached');
      expect(result.confidence).toBe(0.8);
      // Não deve ter escrito novamente no cache
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('ignora cache Redis expirado e recalcula', async () => {
      const expiredPayload = {
        prediction: { userId: 'u-stale', dailyPredictions: [], confidence: 0.1, trend: 'stable', factors: [], generatedAt: new Date(), dateRange: { start: new Date(), end: new Date() } },
        expiresAt: new Date(Date.now() - 1000), // expirado
      };
      mockGet.mockResolvedValueOnce(JSON.stringify(expiredPayload));

      const result = await engine.predictCashFlow('u-stale', historicalData, 7);

      // Recalculou — confiança diferente do valor expirado
      expect(result.dailyPredictions).toHaveLength(7);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockSet).toHaveBeenCalled(); // escreveu novo cache
    });

    it('continua funcionando se Redis lançar erro (fallback para memória)', async () => {
      mockGet.mockRejectedValueOnce(new Error('Redis down'));
      mockSet.mockRejectedValueOnce(new Error('Redis down'));

      const result = await engine.predictCashFlow('u-fallback', historicalData, 5);

      expect(result.userId).toBe('u-fallback');
      expect(result.dailyPredictions).toHaveLength(5);
    });
  });

  describe('clearCache', () => {
    it('chama redis.del para um userId específico', async () => {
      engine.clearCache('u-del');

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockDel).toHaveBeenCalledWith('prediction:v1:u-del');
    });

    it('limpa a memória local sem chamar del em lote quando userId não é passado', () => {
      // clearCache() sem argumento → não pode enumerar Redis, apenas limpa memória
      expect(() => engine.clearCache()).not.toThrow();
    });
  });
});
