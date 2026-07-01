import { describe, expect, it } from 'vitest';

import { buildLocalCFOAnswer } from '../../services/geminiService';
import { buildCFOExplainability, buildCFOResponseDepth } from '../../src/ai/aiCFO';
import { evaluateCFOCases } from '../../src/ai/cfoEvaluation';
import { CFO_EVALUATION_FIXTURES } from '../fixtures/ai/cfoEvaluationFixtures';

describe('AI health - CFO evaluation harness', () => {
  it('keeps the canonical offline CFO cases above the minimum quality threshold', () => {
    const results = CFO_EVALUATION_FIXTURES.map((fixture) => {
      const explainability = buildCFOExplainability(fixture.context, fixture.intent);
      const isFallbackCase = fixture.mockMode === 'failure';
      const answer = isFallbackCase
        ? 'Com base nos seus dados, nao consegui processar a consulta agora. Verifique sua conexao e tente novamente.'
        : buildLocalCFOAnswer(fixture.question, fixture.context, fixture.intent);

      return evaluateCFOCases([
        {
          name: fixture.name,
          intent: fixture.intent,
          response: {
            question: fixture.question,
            answer,
            context_summary: 'Offline consultative demo anchored to the workspace summary.',
            intent: fixture.intent,
            response_depth: isFallbackCase ? 'reduced' : buildCFOResponseDepth(explainability),
            timestamp: new Date('2026-06-19T12:00:00.000Z').toISOString(),
            explainability: isFallbackCase
              ? buildCFOExplainability(fixture.context, fixture.intent, { forceLowConfidence: true })
              : explainability,
            diagnostic: isFallbackCase
              ? {
                  kind: 'ai_unavailable',
                  message: 'Com base nos seus dados, nao consegui processar a consulta agora.',
                  suggestion: 'Verifique sua conexao, recarregue a sessao do workspace e tente novamente.',
                }
              : undefined,
          },
          expectedTraits: fixture.expectedTraits,
        },
      ])[0];
    });

    const scoreAverage = results.reduce((sum, result) => sum + result.score, 0) / results.length;
    const failures = results.filter((result) => !result.passed);

    expect(scoreAverage).toBeGreaterThanOrEqual(0.9);
    expect(failures).toHaveLength(0);
    expect(results.some((result) => result.matchedTraits.includes('has_required_action'))).toBe(true);
    expect(results.some((result) => result.matchedTraits.includes('avoids_raw_context_leak'))).toBe(true);
    expect(results.some((result) => result.matchedTraits.includes('uses_standard_depth_when_strong'))).toBe(true);
  });
});
