import { describe, expect, it } from 'vitest';

import {
  normalizeDailyPredictions,
  normalizePredictionFactors,
  normalizePredictionSnapshot,
} from '../../src/routes/predictions';

describe('prediction normalization helpers', () => {
  it('normaliza snapshot parcial sem depender de casts do Firestore', () => {
    const snapshotInput = {
      confidence: 0.72,
      trend: 'up',
      userId: 'user-123',
      dateRange: {
        start: '2026-04-01T00:00:00.000Z',
        end: '2026-04-30T00:00:00.000Z',
      },
      generatedAt: '2026-04-30T12:00:00.000Z',
      dailyPredictions: [
        {
          date: '2026-05-01T00:00:00.000Z',
          predictedBalance: 1200,
          confidenceInterval: { min: 1000, max: 1400 },
          expectedIncome: 500,
          expectedExpenses: 200,
          riskLevel: 'medium',
        },
      ],
      factors: [
        {
          name: 'salary',
          description: 'Recurring salary deposit',
          impact: 'positive',
          weight: 0.9,
        },
        {
          name: '',
          description: 'ignored',
          impact: 'negative',
          weight: 0.1,
        },
      ],
    } satisfies Parameters<typeof normalizePredictionSnapshot>[0];

    const snapshot = normalizePredictionSnapshot(snapshotInput);

    expect(snapshot.userId).toBe('user-123');
    expect(snapshot.trend).toBe('up');
    expect(snapshot.confidence).toBe(0.72);
    expect(snapshot.dateRange.start).toBeInstanceOf(Date);
    expect(snapshot.generatedAt).toBeInstanceOf(Date);
    expect(snapshot.dailyPredictions).toHaveLength(1);
    expect(snapshot.dailyPredictions[0].riskLevel).toBe('medium');
    expect(snapshot.factors).toEqual([
      {
        name: 'salary',
        description: 'Recurring salary deposit',
        impact: 'positive',
        weight: 0.9,
      },
    ]);
  });

  it('descarta fatores e dias inválidos durante a normalizacao', () => {
    expect(normalizeDailyPredictions([null, { date: 'invalid' }])).toHaveLength(1);
    expect(normalizePredictionFactors([null, { name: 'x' }, { description: 'y' }])).toEqual([]);
  });
});
