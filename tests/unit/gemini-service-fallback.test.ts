import { describe, expect, it, vi, beforeEach } from 'vitest';

// vi.mock is hoisted before const declarations — must use vi.hoisted() to
// initialise the mock reference before the factory runs.
const { apiRequestMock, logWarnMock, logErrorMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  logWarnMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock('../../src/config/api.config', () => ({
  API_ENDPOINTS: {
    AI: {
      INTERPRET: '/api/ai/interpret',
      SCAN_RECEIPT: '/api/ai/scan-receipt',
      GENERATE_INSIGHTS: '/api/ai/insights',
      CLASSIFY_TRANSACTIONS: '/api/ai/classify-transactions',
      CREDIT_TOKEN_COUNT: '/api/ai/token-count',
      CFO: '/api/ai/cfo',
    },
  },
  apiRequest: apiRequestMock,
  getStoredWorkspaceId: vi.fn(() => 'ws-test'),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: logWarnMock,
  logError: logErrorMock,
}));

import { buildLocalCFOAnswer, buildSmartInputFallback, GeminiService } from '../../services/geminiService';
import { buildCFOExplainability, buildCFOResponseDepth } from '../../src/ai/aiCFO';
import { evaluateCFOCases } from '../../src/ai/cfoEvaluation';
import { CFO_EVALUATION_FIXTURES } from '../fixtures/ai/cfoEvaluationFixtures';
import type { Reminder, TransactionData } from '../../types';
import { TransactionType, Category } from '../../types';

describe('buildSmartInputFallback', () => {
  it('gera transacao de despesa quando encontra valor em texto de gasto', () => {
    const output = buildSmartInputFallback('Gastei 50 no uber hoje');

    expect(output.intent).toBe('transaction');
    expect(output.data).toHaveLength(1);
    const tx = output.data[0] as TransactionData;
    expect(tx.amount).toBe(50);
    expect(tx.type).toBe(TransactionType.DESPESA);
    expect(tx.category).toBe(Category.PESSOAL);
  });

  it('gera transacao de receita para texto de recebimento', () => {
    const output = buildSmartInputFallback('Recebi 2500 de salario');

    expect(output.intent).toBe('transaction');
    const tx = output.data[0] as TransactionData;
    expect(tx.amount).toBe(2500);
    expect(tx.type).toBe(TransactionType.RECEITA);
    expect(tx.category).toBe(Category.CONSULTORIO);
  });

  it('gera lembrete para texto de pagamento', () => {
    const output = buildSmartInputFallback('Lembrar de pagar luz dia 10');

    expect(output.intent).toBe('reminder');
    expect(output.data).toHaveLength(1);
    const reminder = output.data[0] as Reminder;
    expect(reminder.title).toContain('Lembrar de pagar luz');
    expect(reminder.priority).toBe('média');
  });

  it('retorna vazio para texto sem valor quando nao for lembrete', () => {
    const output = buildSmartInputFallback('teste aleatorio sem contexto financeiro');
    expect(output.intent).toBe('transaction');
    expect(output.data).toHaveLength(0);
  });
});

describe('buildLocalCFOAnswer', () => {
  const canonicalOfflineCases = CFO_EVALUATION_FIXTURES.filter((fixture) =>
    [
      'negative_cash_runway',
      'overdue_receivables',
      'goal_at_risk',
      'high_recurring_cost',
      'optimistic_forecast',
    ].includes(fixture.name),
  );

  it.each(canonicalOfflineCases)('produz resposta consultiva e especifica para %s', (fixture) => {
    const answer = buildLocalCFOAnswer(fixture.question, fixture.context, fixture.intent);
    const explainability = buildCFOExplainability(fixture.context, fixture.intent);

    expect(answer).toContain('Proxima acao');
    expect(answer).not.toContain('=== DADOS');
    expect(answer).not.toContain('CONTAS:');
    expect(answer).not.toContain('TOTAL DE TRANSACOES');

    const [result] = evaluateCFOCases([
      {
        name: fixture.name,
        intent: fixture.intent,
        response: {
          question: fixture.question,
          answer,
          context_summary: 'Offline consultative demo anchored to the workspace summary.',
          intent: fixture.intent,
          response_depth: buildCFOResponseDepth(explainability),
          timestamp: new Date('2026-06-19T12:00:00.000Z').toISOString(),
          explainability,
        },
        expectedTraits: fixture.expectedTraits,
      },
    ]);

    expect(result.passed).toBe(true);
    expect(result.missingTraits).toHaveLength(0);
  });
});

describe('GeminiService.processSmartInput', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    logWarnMock.mockReset();
    logErrorMock.mockReset();
  });

  it('usa fallback deterministico quando apiRequest falha', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('backend offline'));
    const service = new GeminiService();

    const output = await service.processSmartInput('Comprei 89,90 no mercado');

    expect(output.intent).toBe('transaction');
    const tx = output.data[0] as TransactionData;
    expect(tx.amount).toBe(89.9);
    expect(tx.type).toBe(TransactionType.DESPESA);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[AIService] processSmartInput unavailable, using deterministic fallback',
      expect.any(Error),
      expect.objectContaining({ fallback: 'ai-process-smart-input-fallback' }),
    );
  });

  it('registra erro ao falhar parsing de imagem financeira', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('image parse failed'));
    const service = new GeminiService();

    const output = await service.parseFinancialImage('base64', 'image/png');

    expect(output).toEqual([]);
    expect(logErrorMock).toHaveBeenCalledWith(
      '[AIService] parseFinancialImage failed',
      expect.any(Error),
      expect.objectContaining({ fallback: 'ai-parse-financial-image-failed' }),
    );
  });
});
