import { describe, expect, it } from 'vitest';
import { summarizeConfidenceSummary } from '../../src/controllers/aiController';

describe('summarizeConfidenceSummary', () => {
  it('returns high for strong numeric confidences', () => {
    expect(
      summarizeConfidenceSummary([
        { confidence: 0.92 },
        { confidence: 0.81 },
      ])
    ).toBe('high');
  });

  it('returns medium when mixed numeric confidences average in the middle', () => {
    expect(
      summarizeConfidenceSummary([
        { confidence: 0.6 },
        { confidence: 0.4 },
      ])
    ).toBe('medium');
  });

  it('returns low when fieldConfidences contain low signals', () => {
    expect(
      summarizeConfidenceSummary({
        fieldConfidences: {
          amount: 0.3,
          merchant: 'low',
        },
      })
    ).toBe('low');
  });

  it('returns unknown when no confidence data exists', () => {
    expect(summarizeConfidenceSummary({ intent: 'monthly_summary' })).toBe('unknown');
  });
});
