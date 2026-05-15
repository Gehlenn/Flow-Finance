import { describe, expect, it, vi } from 'vitest';

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

import { interpretController, generateInsightsController, cfoController } from '../../src/controllers/aiController';

type MockRes = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

function makeRes() {
  const res = {} as MockRes;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('aiController observability', () => {
  it('logs contextual data when interpret generation falls back', async () => {
    controllerMocks.generateContent.mockRejectedValueOnce(new Error('interpret failed'));

    const req = {
      body: { text: 'gastei 50 com cafe' },
      userId: 'user-1',
    };
    const res = makeRes();

    await interpretController(req, res);

    expect(res.json).toHaveBeenCalledWith({ intent: 'transaction', data: [] });
    expect(controllerMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        textLength: 18,
        fallback: 'interpret-empty',
      }),
      'Interpret unavailable, returning fallback response',
    );
  });

  it('logs contextual data when insights generation falls back', async () => {
    controllerMocks.generateContent.mockRejectedValueOnce(new Error('insights failed'));

    const req = {
      body: {
        transactions: [
          { id: 'tx-1', amount: 10, type: 'expense', category: 'Pessoal', description: 'Cafe' },
        ],
        type: 'daily',
      },
      userId: 'user-1',
    };
    const res = makeRes();

    await generateInsightsController(req, res);

    expect(res.json).toHaveBeenCalledWith({ insights: [] });
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

  it('logs contextual data when CFO generation fails', async () => {
    controllerMocks.generateContent.mockRejectedValueOnce(new Error('cfo failed'));

    const req = {
      body: {
        question: 'Como esta meu caixa?',
        context: 'Saldo confirmado: R$ 1000',
        intent: 'cash_position',
      },
      userId: 'user-1',
    };
    const res = makeRes();
    const next = vi.fn();

    cfoController(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });
    expect(controllerMocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        questionLength: 20,
        intent: 'cash_position',
        fallback: 'cfo-failed',
      }),
      'CFO generation error',
    );
  });
});
