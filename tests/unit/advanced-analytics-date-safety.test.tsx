import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AdvancedAnalytics, { formatAnalyticsDateLabel } from '../../components/AdvancedAnalytics';
import { Category, TransactionType, type Transaction } from '../../types';

vi.mock('../../src/engines/finance/forecastEngine', () => ({
  buildMonthlyForecast: vi.fn(() => [
    { month: 'jan', receitas: 1000, despesas: 400, saldo: 600 },
    { month: 'fev', receitas: 1200, despesas: 500, saldo: 700 },
  ]),
}));

const transactions: Transaction[] = [
  {
    id: 'tx-valid',
    amount: 1200,
    type: TransactionType.RECEITA,
    category: Category.NEGOCIO,
    description: 'Receita valida',
    date: '2026-04-02T10:00:00.000Z',
  },
  {
    id: 'tx-invalid',
    amount: 200,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Despesa com data quebrada',
    date: 'data-quebrada',
  },
];

describe('AdvancedAnalytics date safety', () => {
  it('ignora datas invalidas sem renderizar Invalid Date', () => {
    render(<AdvancedAnalytics transactions={transactions} hideValues={false} />);

    expect(screen.getByText(/Relatórios Avançados/i)).toBeTruthy();
    expect(screen.getByText(/Tendência de Saldo/i)).toBeTruthy();
    expect(screen.getByText(/Relatório Mensal/i)).toBeTruthy();
    expect(screen.queryByText(/Invalid Date/i)).toBeNull();
    expect(screen.queryByText(/data-quebrada/i)).toBeNull();
  });

  it('renders the empty-state summary with clean copy when the forecast is empty', async () => {
    const forecastEngine = await import('../../src/engines/finance/forecastEngine');
    vi.mocked(forecastEngine.buildMonthlyForecast).mockReturnValueOnce([
      { month: 'jan', receitas: 0, despesas: 0, saldo: 0 },
      { month: 'fev', receitas: 0, despesas: 0, saldo: 0 },
    ]);

    render(<AdvancedAnalytics transactions={[]} hideValues={false} />);

    expect(screen.getByText(/Sem dados nos últimos 6 meses/i)).toBeTruthy();
  });

  it('shows a category empty state instead of a zero-value chart', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 256,
      top: 0,
      left: 0,
      bottom: 256,
      right: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    try {
      render(
        <AdvancedAnalytics
          transactions={[
            {
              id: 'tx-zero',
              amount: 0,
              type: TransactionType.DESPESA,
              category: Category.PESSOAL,
              description: 'Despesa zerada',
              date: '2026-04-02T10:00:00.000Z',
            },
          ]}
          hideValues={false}
        />,
      );

      expect(await screen.findByText(/Sem gastos categorizados/i)).toBeTruthy();
      expect(screen.getByText(/despesas classificadas/i)).toBeTruthy();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('formatAnalyticsDateLabel falls back cleanly for invalid values', () => {
    expect(formatAnalyticsDateLabel('data-quebrada')).toBe('Data inválida');
    expect(formatAnalyticsDateLabel(null)).toBe('Data inválida');
  });

  it('formats date-only analytics values using the local calendar day', () => {
    expect(formatAnalyticsDateLabel('2026-04-10')).toBe('10 de abr.');
  });
});
