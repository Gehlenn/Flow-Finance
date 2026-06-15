import { describe, expect, it, vi } from 'vitest';

const { generateCfoMock } = vi.hoisted(() => ({
  generateCfoMock: vi.fn(),
}));

vi.mock('../../services/geminiService', async () => {
  const actual = await vi.importActual<typeof import('../../services/geminiService')>('../../services/geminiService');
  return {
    ...actual,
    GeminiService: vi.fn().mockImplementation(() => ({
      generateCFO: generateCfoMock,
    })),
  };
});

import { buildLocalCFOAnswer } from '../../services/geminiService';
import { buildCFOExplainability, buildCFOResponseDepth, generateCFOResponse, type AICFOResponse } from '../../src/ai/aiCFO';
import { evaluateCFOCases } from '../../src/ai/cfoEvaluation';

describe('CFO evaluation harness', () => {
  it('builds a concise local demo answer without raw context leakage', () => {
    const question = 'Posso gastar agora?';
    const context = [
      '=== DADOS FINANCEIROS DO USUARIO ===',
      'CONTAS:',
      'TOTAL DE TRANSACOES REGISTRADAS: 8',
      'CLASSIFICACAO DE CAIXA:',
      'REGRA OPERACIONAL:',
      'Confirmado (disponivel hoje): R$ 5.000,00',
      'Em 30 dias: R$ 1.200,00',
      '- Resultado: R$ -800,00',
      'QUALIDADE DOS DADOS (merchant coverage): 84%',
    ].join('\n');

    const answer = buildLocalCFOAnswer(question, context, 'cash_position');
    const explainability = buildCFOExplainability(context, 'cash_position');
    const response: AICFOResponse = {
      question,
      answer,
      context_summary: 'Resposta ancorada em base resumida do workspace.',
      intent: 'cash_position',
      response_depth: buildCFOResponseDepth(explainability),
      timestamp: new Date('2026-06-14T12:00:00.000Z').toISOString(),
      explainability,
    };

    const [result] = evaluateCFOCases([
      {
        name: 'local_demo_concise',
        intent: 'cash_position',
        response,
        expectedTraits: [
          'mentions_confirmed_cash',
          'mentions_forecast',
          'mentions_risk',
          'avoids_absolute_promises',
          'avoids_raw_context_leak',
          'has_explainability',
          'uses_standard_depth_when_strong',
        ],
      },
    ]);

    expect(answer).toContain('Leitura demo');
    expect(answer).toContain('Base resumida');
    expect(answer).toContain('Proxima acao');
    expect(answer).not.toContain('=== DADOS');
    expect(answer).not.toContain('CONTAS:');
    expect(answer).not.toContain('TOTAL DE TRANSACOES');
    expect(answer).not.toContain('REGRA OPERACIONAL');
    expect(answer).not.toContain('CLASSIFICACAO DE CAIXA');
    expect(result.passed).toBe(true);
    expect(result.matchedTraits).toContain('avoids_raw_context_leak');
  });

  it('evaluates cash-position responses with stable scoring signal', async () => {
    generateCfoMock.mockResolvedValueOnce({
      answer: 'Leitura demo: caixa confirmado de R$ 5.000,00 e previsao de R$ 1.200,00 em 30 dias. Risco: se a entrada atrasar, segure gastos nao essenciais. Proxima acao: confirme os recebiveis antes de liberar nova despesa. Base resumida: confirmado, previsto e qualidade do dado.',
    });

    const response = await generateCFOResponse(
      'Posso gastar agora?',
      'Confirmado (disponivel hoje): R$ 5.000,00\nEm 30 dias: R$ 1.200,00',
      'cash_position',
    );

    const [result] = evaluateCFOCases([
      {
        name: 'cash_position',
        intent: 'cash_position',
        response,
        expectedTraits: [
          'mentions_confirmed_cash',
          'mentions_forecast',
          'mentions_risk',
          'avoids_absolute_promises',
          'avoids_raw_context_leak',
          'has_explainability',
        ],
      },
    ]);

    expect(result.score).toBeGreaterThan(0.5);
    expect(result.matchedTraits.length).toBeGreaterThan(0);
  });

  it('scores fallback responses as low confidence with explicit diagnostics', async () => {
    generateCfoMock.mockRejectedValueOnce(new Error('llm offline'));

    const response = await generateCFOResponse(
      'Posso gastar agora?',
      'Confirmado (disponivel hoje): R$ 500,00\nEm 30 dias: R$ 200,00',
      'spending_advice',
    );

    const [result] = evaluateCFOCases([
      {
        name: 'fallback',
        intent: 'spending_advice',
        response,
        expectedTraits: [
          'mentions_confirmed_cash',
          'mentions_forecast',
          'has_explainability',
          'has_low_confidence_fallback',
          'avoids_raw_context_leak',
        ],
      },
    ]);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(response.diagnostic).toEqual(expect.objectContaining({ kind: 'ai_unavailable' }));
    expect(response.explainability.confidence_band).toBe('low');
  });
});
