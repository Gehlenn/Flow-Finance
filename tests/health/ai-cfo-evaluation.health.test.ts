import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateCfoMock = vi.fn();

vi.mock('../../services/geminiService', () => ({
  GeminiService: vi.fn().mockImplementation(() => ({
    generateCFO: generateCfoMock,
  })),
}));

import { generateCFOResponse } from '../../src/ai/aiCFO';
import { evaluateCFOCases } from '../../src/ai/cfoEvaluation';
import { CFO_EVALUATION_FIXTURES } from '../fixtures/ai/cfoEvaluationFixtures';

describe('AI health - CFO evaluation harness', () => {
  beforeEach(() => {
    generateCfoMock.mockReset();
  });

  it('keeps the canonical CFO cases above the minimum quality threshold', async () => {
    for (const fixture of CFO_EVALUATION_FIXTURES) {
      if (fixture.mockMode === 'failure') {
        generateCfoMock.mockRejectedValueOnce(new Error(`offline:${fixture.name}`));
        continue;
      }

      generateCfoMock.mockResolvedValueOnce({
        answer: fixture.mockAnswer || '',
      });
    }

    const results = [];

    for (const fixture of CFO_EVALUATION_FIXTURES) {
      const response = await generateCFOResponse(fixture.question, fixture.context, fixture.intent);
      results.push(
        ...evaluateCFOCases([
          {
            name: fixture.name,
            intent: fixture.intent,
            response,
            expectedTraits: fixture.expectedTraits,
          },
        ]),
      );
    }

    const scoreAverage = results.reduce((sum, result) => sum + result.score, 0) / results.length;
    const failures = results.filter((result) => !result.passed);

    expect(scoreAverage).toBeGreaterThanOrEqual(0.9);
    expect(failures).toHaveLength(0);
  });
});
