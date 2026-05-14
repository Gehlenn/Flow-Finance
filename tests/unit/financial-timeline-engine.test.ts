import { describe, expect, it } from 'vitest';

import { buildFinancialTimeline } from '../../src/engines/finance/timeline/financialTimelineEngine';

describe('financialTimelineEngine', () => {
  it('trata datas-only como datas locais na agregacao mensal', () => {
    const timeline = buildFinancialTimeline([
      { date: '2026-04-10', amount: 100 },
      { date: '2026-04-10T10:00:00.000Z', amount: -40 },
      { date: 'invalid-date', amount: 999 },
    ]);

    expect(timeline).toEqual([
      {
        month: '2026-04',
        income: 100,
        expenses: 40,
        balance: 60,
        events: [],
      },
    ]);
  });
});
