import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AIControlPanel from '../../pages/AIControlPanel';

const getAdaptiveLearningStatsMock = vi.fn();
const getFinancialEventsMock = vi.fn();

vi.mock('../../src/ai/adaptiveAIEngine', () => ({
  getAdaptiveLearningStats: (...args: unknown[]) => getAdaptiveLearningStatsMock(...args),
}));

vi.mock('../../src/events/eventEngine', () => ({
  getFinancialEvents: (...args: unknown[]) => getFinancialEventsMock(...args),
  clearFinancialEvents: vi.fn(),
}));

describe('AIControlPanel leak and report snapshots', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('VITE_AI_DEBUG_PANEL', '1');
    vi.clearAllMocks();

    getAdaptiveLearningStatsMock.mockReturnValue({
      memory_count: 0,
      pattern_count: 0,
      is_learning: false,
    });
    getFinancialEventsMock.mockReturnValue([]);
  });

  it('renders leak and report snapshots provided by the financial state hook', () => {
    render(
      <AIControlPanel
        transactions={[]}
        accounts={[]}
        userId="user-1"
        leaks={[
          {
            merchant: 'Coffee Shop',
            occurrences: 4,
            monthly_cost: 120,
            suggestion: 'Cortar o gasto recorrente.',
          },
        ]}
        report={{
          month: '2026-05',
          total_income: 1000,
          total_expenses: 200,
          top_categories: [
            { category: 'Pessoal', amount: 200, percentage: 100 },
          ],
          insights: ['Gastos sob controle'],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /leaks/i }));
    expect(screen.getByText(/Coffee Shop/i)).toBeTruthy();
    expect(screen.getByText(/Cortar o gasto recorrente/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /report/i }));
    expect(screen.getByText(/2026-05/i)).toBeTruthy();
    expect(screen.getByText(/R\$ 1000\.00/i)).toBeTruthy();
    expect(screen.getByText(/Gastos sob controle/i)).toBeTruthy();
  });
});
