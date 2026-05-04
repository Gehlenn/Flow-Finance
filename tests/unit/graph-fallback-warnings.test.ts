import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ai/financialGraph', () => ({
  buildFinancialGraph: vi.fn(() => {
    throw new Error('graph unavailable');
  }),
  graphToAIContext: vi.fn(),
  getTopMerchants: vi.fn(),
  getCategorySpending: vi.fn(),
  detectSubscriptionCandidates: vi.fn(),
}));

describe('graph fallback warnings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('avisa quando o contexto grafico do CFO nao esta disponivel', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { buildFinancialContext } = await import('../../src/ai/aiCFO');

    const context = buildFinancialContext([], [], {
      current_balance: 0,
      balance_7_days: 0,
      balance_30_days: 0,
      projected_income: 0,
      projected_expenses: 0,
    }, [], 'user-1');

    expect(context).toContain('CAIXA OPERACIONAL CALCULADO');
    expect(warnSpy).toHaveBeenCalledWith(
      '[buildFinancialContext] Graph context unavailable:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('avisa quando o autopilot nao consegue carregar o grafo', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { runFinancialAutopilot } = await import('../../src/ai/financialAutopilot');

    const actions = runFinancialAutopilot([], [], {
      balance_30_days: 0,
      balance_7_days: 0,
      current_balance: 0,
      projected_expenses: 0,
      projected_income: 0,
    }, []);

    expect(Array.isArray(actions)).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      '[Autopilot] Graph context unavailable:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('avisa quando o gerador de insights nao consegue carregar o grafo', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { generateFinancialInsights } = await import('../../src/ai/insightGenerator');

    const insights = generateFinancialInsights([
      {
        id: 'tx-1',
        amount: 100,
        type: 'despesa',
        category: 'Pessoal',
        description: 'Teste 1',
        date: '2026-04-01T00:00:00.000Z',
        merchant: 'Teste',
      },
      {
        id: 'tx-2',
        amount: 150,
        type: 'despesa',
        category: 'Pessoal',
        description: 'Teste 2',
        date: '2026-04-02T00:00:00.000Z',
        merchant: 'Teste',
      },
      {
        id: 'tx-3',
        amount: 200,
        type: 'receita',
        category: 'Negocio',
        description: 'Teste 3',
        date: '2026-04-03T00:00:00.000Z',
        merchant: 'Teste',
      },
    ] as never[], 'user-1', [
      {
        id: 'acc-1',
        user_id: 'user-1',
        name: 'Conta',
        type: 'cash',
        balance: 0,
        currency: 'BRL',
        created_at: '2026-04-01T00:00:00.000Z',
      } as never,
    ]);

    expect(Array.isArray(insights)).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      '[InsightGenerator] Graph insights unavailable:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});
