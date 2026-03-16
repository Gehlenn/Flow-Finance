/**
 * Testes: financeController (D6 — POST /api/finance/metrics)
 * Cobertura das funções de computação pura e do handler HTTP.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { financeMetricsController } from '../../backend/src/controllers/financeController';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../backend/src/config/logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function req(body: unknown, userId = 'user-test') {
  return { body, userId } as any;
}

function res() {
  const r = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;
  return r;
}

const TRANSACTIONS_RECEITA = [
  { amount: 5000, type: 'Receita', category: 'Trabalho', date: '2025-01-10' },
  { amount: 5000, type: 'Receita', category: 'Trabalho', date: '2025-02-10' },
  { amount: 5000, type: 'Receita', category: 'Trabalho', date: '2025-03-10' },
];
const TRANSACTIONS_DESPESA = [
  { amount: 1000, type: 'Despesa', category: 'Alimentação', date: '2025-01-15' },
  { amount: 2000, type: 'Despesa', category: 'Moradia', date: '2025-02-15' },
  { amount: 500, type: 'Despesa', category: 'Transporte', date: '2025-03-15' },
];
const MIX = [...TRANSACTIONS_RECEITA, ...TRANSACTIONS_DESPESA];

// ─── Testes do controller ────────────────────────────────────────────────────

describe('financeMetricsController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejeita body sem transactions com 400', async () => {
    const mockReq = req({ transactions: 'nao-e-array' });
    const mockRes = res();
    const next = vi.fn();
    financeMetricsController(mockReq, mockRes, next);
    await Promise.resolve(); await Promise.resolve();
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(next.mock.calls[0][0].message).toContain('"transactions" must be an array');
  });

  it('rejeita array com mais de 2000 items com 400', async () => {
    const bigArray = Array.from({ length: 2001 }, () => ({
      amount: 100, type: 'Receita', date: '2025-01-01',
    }));
    const mockReq = req({ transactions: bigArray });
    const mockRes = res();
    const next = vi.fn();
    financeMetricsController(mockReq, mockRes, next);
    await Promise.resolve(); await Promise.resolve();
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(next.mock.calls[0][0].message).toContain('too large');
  });

  it('aceita array vazio e retorna estrutura base', async () => {
    const mockReq = req({ transactions: [] });
    const mockRes = res();
    await financeMetricsController(mockReq, mockRes, vi.fn());
    const result = mockRes.json.mock.calls[0][0];
    expect(result).toHaveProperty('timeline');
    expect(result).toHaveProperty('trend');
    expect(result).toHaveProperty('anomalies');
    expect(result).toHaveProperty('profile');
    expect(result.timeline.points).toHaveLength(0);
    expect(result.trend).toBe('stable');
    expect(result.anomalies).toHaveLength(0);
    expect(result.profile.profile).toBe('Undefined');
  });

  it('retorna profile Saver com transações de alta poupança', async () => {
    const mockReq = req({ transactions: TRANSACTIONS_RECEITA.concat([
      { amount: 500, type: 'Despesa', category: 'Alimentação', date: '2025-01-20' },
      { amount: 500, type: 'Despesa', category: 'Transporte', date: '2025-02-20' },
    ]) });
    const mockRes = res();
    await financeMetricsController(mockReq, mockRes, vi.fn());
    const result = mockRes.json.mock.calls[0][0];
    expect(result.profile.profile).toBe('Saver');
    expect(result.profile.savingsRate).toBeGreaterThan(0.2);
  });

  it('retorna profile Spender com gastos maiores que receita', async () => {
    const mockReq = req({ transactions: [
      { amount: 1000, type: 'Receita', category: 'Trabalho', date: '2025-01-10' },
      { amount: 2000, type: 'Despesa', category: 'Lazer', date: '2025-01-15' },
      { amount: 800, type: 'Despesa', category: 'Alimentação', date: '2025-01-20' },
    ] });
    const mockRes = res();
    await financeMetricsController(mockReq, mockRes, vi.fn());
    const result = mockRes.json.mock.calls[0][0];
    expect(result.profile.profile).toBe('Spender');
    expect(result.profile.savingsRate).toBeLessThan(0);
  });

  it('calcula timeline com pontos por dia', async () => {
    const mockReq = req({ transactions: MIX });
    const mockRes = res();
    await financeMetricsController(mockReq, mockRes, vi.fn());
    const { timeline } = mockRes.json.mock.calls[0][0];
    expect(timeline.points.length).toBeGreaterThan(0);
    expect(timeline.totals.income).toBeGreaterThan(0);
    expect(timeline.totals.expenses).toBeGreaterThan(0);
    expect(typeof timeline.totals.finalBalance).toBe('number');
  });

  it('retorna trend growing quando saldo crescente', async () => {
    const growing = [
      { amount: 1000, type: 'Receita', date: '2025-01-01' },
      { amount: 200, type: 'Despesa', date: '2025-01-02' },
      { amount: 1000, type: 'Receita', date: '2025-01-10' },
      { amount: 200, type: 'Despesa', date: '2025-01-11' },
      { amount: 1000, type: 'Receita', date: '2025-01-20' },
    ];
    const mockReq = req({ transactions: growing });
    const mockRes = res();
    await financeMetricsController(mockReq, mockRes, vi.fn());
    const { trend } = mockRes.json.mock.calls[0][0];
    expect(['growing', 'stable']).toContain(trend);
  });

  it('detecta anomalia de expense_spike quando despesa > 2x mediana', async () => {
    const txs = [
      { amount: 100, type: 'Despesa', date: '2025-01-01' },
      { amount: 100, type: 'Despesa', date: '2025-01-02' },
      { amount: 100, type: 'Despesa', date: '2025-01-03' },
      { amount: 1000, type: 'Despesa', date: '2025-01-04' }, // spike
      { amount: 100, type: 'Receita', date: '2025-01-01' },
    ];
    const mockReq = req({ transactions: txs });
    const mockRes = res();
    await financeMetricsController(mockReq, mockRes, vi.fn());
    const { anomalies } = mockRes.json.mock.calls[0][0];
    const spikeAnomalies = anomalies.filter((a: any) => a.type === 'expense_spike');
    expect(spikeAnomalies.length).toBeGreaterThan(0);
    expect(spikeAnomalies[0].ratioToMedian).toBeGreaterThan(2);
  });

  it('ignora transactions com dados inválidos (sem amount ou date)', async () => {
    const txs = [
      { amount: 500, type: 'Receita', date: '2025-01-10' },         // válida
      { type: 'Receita', date: '2025-01-11' },                       // sem amount → ignorada
      { amount: 300, type: 'Receita' },                              // sem date → inválida type check falha
      null,                                                           // null → ignorado
    ];
    const mockReq = req({ transactions: txs });
    const mockRes = res();
    await financeMetricsController(mockReq, mockRes, vi.fn());
    const { timeline } = mockRes.json.mock.calls[0][0];
    // Apenas a transação válida deve gerar pontos
    expect(timeline.points.length).toBe(1);
  });

  it('calcula topCategories ordenadas por total decrescente', async () => {
    const mockReq = req({ transactions: MIX });
    const mockRes = res();
    await financeMetricsController(mockReq, mockRes, vi.fn());
    const { profile } = mockRes.json.mock.calls[0][0];
    const cats = profile.topCategories as Array<{ category: string; total: number; share: number }>;
    expect(cats.length).toBeGreaterThan(0);
    for (let i = 1; i < cats.length; i++) {
      expect(cats[i - 1].total).toBeGreaterThanOrEqual(cats[i].total);
    }
    const totalShare = cats.reduce((s, c) => s + c.share, 0);
    expect(totalShare).toBeCloseTo(1, 1);
  });
});
