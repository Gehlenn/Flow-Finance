import { describe, expect, it } from 'vitest';

import {
  CANONICAL_CASES,
  evaluateCase,
  evaluateCases,
  hasRawContextLeak,
  parseArgs,
} from '../../scripts/check-ai-quality-evidence.mjs';

describe('check-ai-quality-evidence', () => {
  it('parses inline CLI arguments', () => {
    const args = parseArgs([
      '--output-dir=test-results/custom-ai-quality',
      '--min-average-score',
      '0.95',
    ]);

    expect(args.outputDir).toBe('test-results/custom-ai-quality');
    expect(args.minAverageScore).toBe('0.95');
  });

  it('passes the canonical offline AI CFO quality cases', () => {
    const result = evaluateCases(CANONICAL_CASES, 0.9);

    expect(result.status).toBe('PASS');
    expect(result.failures).toEqual([]);
    expect(result.averageScore).toBeGreaterThanOrEqual(0.9);
  });

  it('detects raw context leakage', () => {
    expect(hasRawContextLeak('=== DADOS FINANCEIROS DO USUARIO ===\nCONTAS:')).toBe(true);

    const result = evaluateCase({
      name: 'raw_context_leak',
      intent: 'cash_position',
      answer: '=== DADOS FINANCEIROS DO USUARIO === TOTAL DE TRANSACOES REGISTRADAS: 8',
      responseDepth: 'standard',
      explainability: {
        confidence_band: 'high',
        reasons_used: ['confirmed_cash'],
        evidence: {
          base_sufficiency: 'strong',
        },
      },
      expectedTraits: ['avoids_raw_context_leak'],
    });

    expect(result.passed).toBe(false);
    expect(result.missingTraits).toEqual(['avoids_raw_context_leak']);
  });
});
