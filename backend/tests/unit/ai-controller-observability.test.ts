import { beforeEach, describe, expect, it, vi } from 'vitest';

const controllerMocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  estimateTokens: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerDebug: vi.fn(),
}));

vi.mock('../../src/config/ai', () => ({
  generateContent: controllerMocks.generateContent,
  estimateTokens: controllerMocks.estimateTokens,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: controllerMocks.loggerWarn,
    error: controllerMocks.loggerError,
    info: controllerMocks.loggerInfo,
    debug: controllerMocks.loggerDebug,
  },
}));

import {
  classifyTransactionsController,
  cfoController,
  generateInsightsController,
  interpretController,
  scanReceiptController,
} from '../../src/controllers/aiController';

type MockRes = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  headers: Record<string, string>;
};

function makeRes() {
  const res = { headers: {} } as MockRes;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn((key: string, value: string) => {
    res.headers[key.toLowerCase()] = String(value);
    return res;
  });
  return res;
}

function makeAIResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    content: '{"ok":true}',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    inputTokens: 1000,
    outputTokens: 1000,
    tokensUsed: 2000,
    latencyMs: 12,
    workspaceId: 'workspace-1',
    estimatedCostUsd: 0.00000375,
    costEvidence: 'provider_usage_tokens',
    ...overrides,
  };
}

function expectAIMetaHeaders(res: MockRes, workspaceId = 'workspace-1') {
  expect(res.setHeader).toHaveBeenCalledWith('x-ai-provider', 'gemini');
  expect(res.setHeader).toHaveBeenCalledWith('x-ai-model', 'gemini-2.5-flash');
  expect(res.setHeader).toHaveBeenCalledWith('x-ai-input-tokens', '1000');
  expect(res.setHeader).toHaveBeenCalledWith('x-ai-output-tokens', '1000');
  expect(res.setHeader).toHaveBeenCalledWith('x-ai-total-tokens', '2000');
  expect(res.setHeader).toHaveBeenCalledWith('x-ai-estimated-cost-usd', '0.00000375');
  expect(res.setHeader).toHaveBeenCalledWith('x-ai-cost-evidence', 'provider_usage_tokens');
  expect(res.setHeader).toHaveBeenCalledWith('x-ai-workspace-id', workspaceId);
  expect(res.setHeader).toHaveBeenCalledWith('x-ai-latency-ms', '12');
}

describe('aiController observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs contextual data and propagates AI headers for interpret', async () => {
    controllerMocks.generateContent.mockResolvedValueOnce(makeAIResult({
      content: '{"intent":"transaction","transactions":[]}',
    }));

    const req = {
      body: { text: 'gastei 50 com cafe' },
      userId: 'user-1',
      workspaceId: 'workspace-1',
      requestId: 'req-1',
    };
    const res = makeRes();

    await interpretController(req, res);

    expect(res.json).toHaveBeenCalledWith({ intent: 'transaction', data: [] });
    expectAIMetaHeaders(res);
    expect(controllerMocks.generateContent).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ responseMimeType: 'application/json' }),
      expect.objectContaining({
        operation: 'interpret',
        source: 'aiController',
        requestId: 'req-1',
        workspaceId: 'workspace-1',
      }),
    );
  });

  it('returns the interpret fallback without AI headers when generation fails', async () => {
    controllerMocks.generateContent.mockRejectedValueOnce(new Error('interpret failed'));

    const req = {
      body: { text: 'gastei 50 com cafe' },
      userId: 'user-1',
      workspaceId: 'workspace-1',
      requestId: 'req-1',
    };
    const res = makeRes();

    await interpretController(req, res);

    expect(res.json).toHaveBeenCalledWith({ intent: 'transaction', data: [] });
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(controllerMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        textLength: 18,
        fallback: 'interpret-empty',
      }),
      'Interpret unavailable, returning fallback response',
    );
  });

  it('keeps interpret prompt focused on service-business cash flow', async () => {
    controllerMocks.generateContent.mockResolvedValueOnce(makeAIResult({
      content: '{"intent":"transaction","transactions":[]}',
    }));

    const req = {
      body: { text: 'recebi 1200 do contrato alpha' },
      userId: 'user-1',
      workspaceId: 'workspace-1',
      requestId: 'req-2',
    };
    const res = makeRes();

    await interpretController(req, res);

    const [prompt] = controllerMocks.generateContent.mock.calls.at(-1) ?? [];
    expect(prompt).toContain('caixa operacional');
    expect(prompt).toContain('empresas de servico');
    expect(prompt).toContain("'Recebivel'");
    expect(prompt).not.toContain('cerebro financeiro');
    expect(prompt).not.toContain("'Pessoal'");
    expect(prompt).not.toContain("'Investimento':");
  });

  it('propagates headers for receipt scanning', async () => {
    controllerMocks.generateContent.mockResolvedValueOnce(makeAIResult({
      content: '{"amount":10,"description":"Cafe","date":"2026-06-04","category":"Pessoal","type":"Despesa"}',
    }));

    const req = {
      body: {
        imageBase64: 'AAAA',
        imageMimeType: 'image/png',
        context: 'conta do trabalho',
      },
      userId: 'user-1',
      workspaceId: 'workspace-1',
      requestId: 'req-3',
    };
    const res = makeRes();

    await scanReceiptController(req, res);

    expect(res.json).toHaveBeenCalledWith({
      amount: 10,
      description: 'Cafe',
      date: '2026-06-04',
      category: 'Pessoal',
      type: 'Despesa',
    });
    expectAIMetaHeaders(res);
  });

  it('propagates headers for transaction classification', async () => {
    controllerMocks.generateContent.mockResolvedValueOnce(makeAIResult({
      content: JSON.stringify([
        { category: 'Pessoal', type: 'Despesa', confidence: 0.92 },
      ]),
    }));

    const req = {
      body: {
        transactions: [
          { description: 'Cafe', amount: 10, date: '2026-06-04' },
        ],
      },
      userId: 'user-1',
      workspaceId: 'workspace-1',
      requestId: 'req-4',
    };
    const res = makeRes();

    await classifyTransactionsController(req, res);

    expect(res.json).toHaveBeenCalledWith([
      { category: 'Pessoal', type: 'Despesa', confidence: 0.92 },
    ]);
    expectAIMetaHeaders(res);
  });

  it('returns the daily insights fallback without AI headers when generation fails', async () => {
    controllerMocks.generateContent.mockRejectedValueOnce(new Error('insights failed'));

    const req = {
      body: {
        transactions: [
          { id: 'tx-1', amount: 10, type: 'expense', category: 'Pessoal', description: 'Cafe' },
        ],
        type: 'daily',
      },
      userId: 'user-1',
      workspaceId: 'workspace-1',
      requestId: 'req-5',
    };
    const res = makeRes();

    await generateInsightsController(req, res);

    expect(res.json).toHaveBeenCalledWith({ insights: [] });
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(controllerMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'daily',
        transactionCount: 1,
        fallback: 'daily-empty',
      }),
      'Generate insights unavailable, returning fallback response',
    );
  });

  it('keeps strategic insights prompt as weekly cash-flow reading', async () => {
    controllerMocks.generateContent.mockResolvedValueOnce(makeAIResult({
      content: JSON.stringify({
        summary: 'Resumo de caixa',
        strengths: [],
        weaknesses: [],
        risks: [],
        opportunities: [],
        actions: [],
      }),
    }));

    const req = {
      body: {
        transactions: [
          { id: 'tx-1', amount: 1200, type: 'income', category: 'Receita', description: 'Contrato Alpha' },
        ],
        type: 'strategic',
      },
      userId: 'user-1',
      workspaceId: 'workspace-1',
      requestId: 'req-6',
    };
    const res = makeRes();

    await generateInsightsController(req, res);

    const [prompt] = controllerMocks.generateContent.mock.calls.at(-1) ?? [];
    expect(prompt).toContain('leitura semanal de caixa operacional');
    expect(prompt).toContain('Previsto vs realizado');
    expect(prompt).toContain('Recebiveis pendentes ou vencidos');
    expect(prompt).not.toContain('relatorio estrategico');
    expect(prompt).not.toContain('Resumo Executivo');
    expectAIMetaHeaders(res);
  });

  it('propagates headers for CFO responses', async () => {
    controllerMocks.generateContent.mockResolvedValueOnce(makeAIResult({
      content: 'Resposta consultiva final',
    }));

    const req = {
      body: {
        question: 'Como esta meu caixa?',
        context: 'Saldo confirmado: R$ 1000',
        intent: 'cash_position',
      },
      userId: 'user-1',
      workspaceId: 'workspace-1',
      requestId: 'req-7',
    };
    const res = makeRes();

    await cfoController(req, res);

    expect(res.json).toHaveBeenCalledWith({
      answer: 'Resposta consultiva final',
    });
    expectAIMetaHeaders(res);
  });

  it('logs contextual data when CFO generation fails', async () => {
    controllerMocks.generateContent.mockRejectedValueOnce(new Error('cfo failed'));

    const req = {
      body: {
        question: 'Como esta meu caixa?',
        context: 'Saldo confirmado: R$ 1000',
        intent: 'cash_position',
      },
      userId: 'user-1',
      workspaceId: 'workspace-1',
      requestId: 'req-7',
    };
    const res = makeRes();

    await cfoController(req, res);

    expect(res.json).toHaveBeenCalledWith({
      answer: 'Nao consegui gerar a resposta consultiva agora. Verifique a sessao e tente novamente em alguns instantes.',
      response_depth: 'reduced',
      diagnostic: expect.objectContaining({
        kind: 'ai_unavailable',
      }),
      explainability: expect.objectContaining({
        confidence_band: 'low',
        evidence: expect.objectContaining({
          base_sufficiency: 'strong',
        }),
      }),
    });
    expect(controllerMocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_cfo_request_failed',
        userId: 'user-1',
        questionLength: expect.any(Number),
        contextLength: expect.any(Number),
        intent: 'cash_position',
        fallback: 'cfo-fallback-answer',
      }),
      'CFO generation error; returning fallback answer',
    );
  });
});
