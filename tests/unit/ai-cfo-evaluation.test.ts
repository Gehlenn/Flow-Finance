import { describe, expect, it, vi } from 'vitest';

const generateCfoMock = vi.fn();

vi.mock('../../services/geminiService', () => ({
  GeminiService: vi.fn().mockImplementation(() => ({
    generateCFO: generateCfoMock,
  })),
}));

import { evaluateCFOCases } from '../../src/ai/cfoEvaluation';
import { generateCFOResponse } from '../../src/ai/aiCFO';

describe('CFO evaluation harness', () => {
  it('evaluates cash-position responses with stable scoring signal', async () => {
    generateCfoMock.mockResolvedValueOnce({
      answer: 'Seu caixa confirmado e de R$ 5.000,00. Em 30 dias a projecao aponta R$ 1.200,00. Ha risco de apertar se manter esse ritmo.',
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
        ],
      },
    ]);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(response.diagnostic).toEqual(expect.objectContaining({ kind: 'ai_unavailable' }));
    expect(response.explainability.confidence_band).toBe('low');
  });
});
