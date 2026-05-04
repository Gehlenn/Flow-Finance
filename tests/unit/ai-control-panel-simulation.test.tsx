import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AIControlPanel from '../../pages/AIControlPanel';
import { Category, TransactionType, type Transaction } from '../../types';

const simulateFinancialScenarioMock = vi.fn();

vi.mock('../../src/ai/financialSimulator', () => ({
  simulateFinancialScenario: (...args: unknown[]) => simulateFinancialScenarioMock(...args),
}));

describe('AIControlPanel simulation tab', () => {
  beforeEach(() => {
    simulateFinancialScenarioMock.mockReset();
    simulateFinancialScenarioMock.mockImplementation(() => ({
      scenario_type: 'extra_spending',
      simulation_period: 1,
      monthly_income: 1000,
      monthly_expenses: 800,
      projected_savings: 200,
      savings_rate: 0.2,
      cashflow_impact: -100,
      risk_level: 'low',
      projected_balance: 900,
      summary: 'Simulação de teste',
      recommendations: [],
    }));
  });

  const renderPanel = (transactions: Transaction[]) => render(
    <AIControlPanel
      transactions={transactions}
      accounts={[
        {
          id: 'acc-1',
          user_id: 'user-1',
          name: 'Conta principal',
          type: 'bank',
          balance: 1000,
          currency: 'BRL',
          created_at: '2026-04-01T10:00:00.000Z',
        },
      ]}
      userId="user-1"
    />,
  );

  it('parses comma decimal amounts in the simulation scenario', async () => {
    const initialTransactions: Transaction[] = [
      {
        id: 'tx-1',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Compra',
        date: '2026-04-01T10:00:00.000Z',
      },
    ];

    renderPanel(initialTransactions);

    fireEvent.click(screen.getByRole('button', { name: /^simulate$/i }));

    await waitFor(() => {
      expect(simulateFinancialScenarioMock).toHaveBeenCalled();
    });

    simulateFinancialScenarioMock.mockClear();

    fireEvent.change(screen.getByLabelText(/valor do gasto extra/i), { target: { value: '99,90' } });
    fireEvent.click(screen.getByRole('button', { name: /simular/i }));

    await waitFor(() => {
      expect(simulateFinancialScenarioMock).toHaveBeenCalled();
    });

    const lastCall = simulateFinancialScenarioMock.mock.calls.at(-1);
    expect(lastCall?.[2]).toMatchObject({ amount: 99.9 });
  });

  it('recalculates the simulation when transactions change', async () => {
    const initialTransactions: Transaction[] = [
      {
        id: 'tx-1',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Compra',
        date: '2026-04-01T10:00:00.000Z',
      },
    ];

    const updatedTransactions: Transaction[] = [
      ...initialTransactions,
      {
        id: 'tx-2',
        amount: 500,
        type: TransactionType.RECEITA,
        category: Category.NEGOCIO,
        description: 'Receita',
        date: '2026-04-02T10:00:00.000Z',
      },
    ];

    const { rerender } = renderPanel(initialTransactions);

    fireEvent.click(screen.getByRole('button', { name: /^simulate$/i }));
    fireEvent.click(screen.getByRole('button', { name: /simular/i }));

    await waitFor(() => {
      expect(simulateFinancialScenarioMock).toHaveBeenCalled();
    });
    const firstCallCount = simulateFinancialScenarioMock.mock.calls.length;

    rerender(
      <AIControlPanel
        transactions={updatedTransactions}
        accounts={[
          {
            id: 'acc-1',
            user_id: 'user-1',
            name: 'Conta principal',
            type: 'bank',
            balance: 1000,
            currency: 'BRL',
            created_at: '2026-04-01T10:00:00.000Z',
          },
        ]}
        userId="user-1"
      />,
    );

    await waitFor(() => {
      expect(simulateFinancialScenarioMock.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });

  it('keeps the months scenario finite when the field is cleared', async () => {
    renderPanel([]);

    fireEvent.click(screen.getByRole('button', { name: /^simulate$/i }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'months' } });

    const monthsInput = screen.getByLabelText(/Meses da proje/i) as HTMLInputElement;
    expect(monthsInput.value).toBe('3');

    fireEvent.change(monthsInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /simular/i }));

    await waitFor(() => {
      expect(simulateFinancialScenarioMock).toHaveBeenCalled();
    });

    const lastCall = simulateFinancialScenarioMock.mock.calls.at(-1);
    expect(lastCall?.[2]).toMatchObject({ months: 1 });
  });
});
