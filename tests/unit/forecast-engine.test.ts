import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMonthlyForecast } from '../../src/engines/finance/forecastEngine';
import { TransactionType } from '../../types';

describe('forecastEngine', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trata datas-only como datas locais na previsao mensal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));

    const forecast = buildMonthlyForecast([
      { amount: 100, type: TransactionType.RECEITA, date: '2026-04-10' },
      { amount: 40, type: TransactionType.DESPESA, date: '2026-04-10' },
      { amount: 999, type: TransactionType.RECEITA, date: 'invalid-date' },
    ], 1);

    expect(forecast).toHaveLength(1);
    expect(forecast[0].receitas).toBe(100);
    expect(forecast[0].despesas).toBe(40);
    expect(forecast[0].saldo).toBe(60);
  });
});
