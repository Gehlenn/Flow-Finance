import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Assistant from '../../components/Assistant';
import { Category, TransactionType } from '../../types';

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}));

vi.mock('../../src/config/api.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/api.config')>();

  return {
    ...actual,
    API_ENDPOINTS: {
      ...actual.API_ENDPOINTS,
      AI: {
        ...actual.API_ENDPOINTS.AI,
        GENERATE_INSIGHTS: '/api/ai/insights',
      },
    },
    apiRequest: apiRequestMock,
  };
});

vi.mock('../../src/ai/aiOrchestrator', () => ({
  runAIPipelineSync: vi.fn(() => ({
    financial_state: {
      cashflow_prediction: {},
    },
  })),
}));

vi.mock('../../src/ai/financialAutopilot', () => ({
  runFinancialAutopilot: vi.fn(() => [
    {
      id: 'local-1',
      type: 'warning',
      title: 'Gasto excessivo em Pessoal',
      description: 'Voce ja passou do limite historico desta categoria. Sugestao: R$ 80,00.',
      severity: 'high',
      category: 'Pessoal',
      value: 80,
      action_label: 'Ver Detalhes',
      created_at: '2026-04-30T00:00:00.000Z',
    },
  ]),
}));

describe('assistant smart alerts fallback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    apiRequestMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses local suggestions directly after contract simplification', async () => {
    render(
      <Assistant
        reminders={[]}
        alerts={[]}
        goals={[]}
        transactions={[
          {
            id: 'tx-1',
            amount: 200,
            type: TransactionType.DESPESA,
            category: Category.PESSOAL,
            description: 'Uber',
            date: new Date().toISOString(),
          } as any,
          {
            id: 'tx-2',
            amount: 100,
            type: TransactionType.DESPESA,
            category: Category.PESSOAL,
            description: 'Uber',
            date: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 5).toISOString(),
          } as any,
          {
            id: 'tx-3',
            amount: 100,
            type: TransactionType.DESPESA,
            category: Category.PESSOAL,
            description: 'Uber',
            date: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 5).toISOString(),
          } as any,
          {
            id: 'tx-4',
            amount: 100,
            type: TransactionType.DESPESA,
            category: Category.PESSOAL,
            description: 'Uber',
            date: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 5).toISOString(),
          } as any,
        ]}
        workspacePlan="pro"
        onToggleComplete={vi.fn()}
        onDeleteReminder={vi.fn()}
        onAddReminder={vi.fn()}
        onUpdateReminder={vi.fn()}
        onSaveAlert={vi.fn()}
        onDeleteAlert={vi.fn()}
        onSaveGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onUpdateGoal={vi.fn()}
        hideValues={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gerar sugestoes de limite/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Gasto excessivo em Pessoal/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Voce ja passou do limite historico desta categoria/i)).toBeTruthy();
      expect(screen.getAllByText(/Sugestao: R\$/i).length).toBeGreaterThan(0);
      expect(apiRequestMock).not.toHaveBeenCalled();
    });
  });
});
