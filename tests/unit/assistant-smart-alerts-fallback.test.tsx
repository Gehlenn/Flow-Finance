import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Assistant from '../../components/Assistant';
import { Category, TransactionType, type Transaction } from '../../types';
import { computeFinancialSignals } from '../../src/ai/signalEngine';

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
}));

const assistantMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
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

vi.mock('../../src/ai/riskAnalyzer', () => ({
  buildCashflowPrediction: vi.fn(() => ({
    current_balance: 0,
    balance_7_days: 0,
    balance_30_days: 0,
    projected_income: 0,
    projected_expenses: 0,
  })),
}));

vi.mock('../../src/ai/signalEngine', () => ({
  computeFinancialSignals: vi.fn(() => [
    {
      id: 'local-1',
      kind: 'expense_pattern',
      title: 'Gasto excessivo em Pessoal',
      description: 'Voce ja passou do limite historico desta categoria. Sugestao: R$ 80,00.',
      severity: 'urgent',
      suggestedAction: 'Ver Detalhes',
      evidence: {
        category: 'Pessoal',
        amount: 80,
      },
      computed_at: '2026-04-30T00:00:00.000Z',
    },
  ]),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: assistantMocks.logWarn,
}));

describe('assistant smart alerts fallback', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const buildTransaction = (id: string, monthsAgo = 0): Transaction => ({
    id,
    amount: 100,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Uber',
    date: new Date(new Date().getFullYear(), new Date().getMonth() - monthsAgo, 5).toISOString(),
  });

  it('uses local suggestions directly after contract simplification', async () => {
    render(
      <Assistant
        reminders={[]}
        alerts={[]}
        goals={[]}
        transactions={[
          buildTransaction('tx-1'),
          buildTransaction('tx-2', 1),
          buildTransaction('tx-3', 2),
          buildTransaction('tx-4', 3),
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

    fireEvent.click(screen.getByRole('button', { name: /Gerar alertas de limite do caixa/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Gasto excessivo em Pessoal/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Voce ja passou do limite historico desta categoria/i)).toBeTruthy();
      expect(screen.getAllByText(/Sugestao: R\$/i).length).toBeGreaterThan(0);
      expect(apiRequestMock).not.toHaveBeenCalled();
    });
  });

  it('shows a visible diagnostic when smart alerts generation fails', async () => {
    vi.mocked(computeFinancialSignals).mockImplementationOnce(() => {
      throw new Error('signal engine failed');
    });

    render(
      <Assistant
        reminders={[]}
        alerts={[]}
        goals={[]}
        transactions={[buildTransaction('tx-1')]}
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

    fireEvent.click(screen.getByRole('button', { name: /Gerar alertas de limite do caixa/i }));

    expect(await screen.findByRole('heading', { name: /Alertas do caixa/i })).toBeTruthy();
    expect(screen.getByText(/Nenhum padrão crítico identificado no momento/i)).toBeTruthy();
    expect(assistantMocks.logWarn).toHaveBeenCalledWith(
      '[Assistant] Failed to generate smart alerts',
      expect.objectContaining({
        fallback: 'assistant-smart-alerts-failed',
      }),
    );
  });

  it('renders operational summaries for goals and limits', () => {
    render(
      <Assistant
        reminders={[]}
        alerts={[
          { id: 'alert-1', category: Category.PESSOAL, threshold: 50, timeframe: 'mensal' },
          { id: 'alert-2', category: Category.NEGOCIO, threshold: 120, timeframe: 'mensal' },
        ]}
        goals={[
          { id: 'goal-1', title: 'Reserva', targetAmount: 1000, currentAmount: 1000, category: Category.INVESTIMENTO },
          { id: 'goal-2', title: 'Expansao', targetAmount: 5000, currentAmount: 1250, category: Category.NEGOCIO },
        ]}
        transactions={[
          {
            id: 'tx-1',
            amount: 100,
            type: TransactionType.DESPESA,
            category: Category.PESSOAL,
            description: 'Uber',
            date: buildTransaction('tx-1').date,
          },
          {
            id: 'tx-2',
            amount: 100,
            type: TransactionType.DESPESA,
            category: Category.NEGOCIO,
            description: 'Anuncio',
            date: buildTransaction('tx-2', 1).date,
          },
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

    expect(screen.getByText(/metas do caixa/i)).toBeTruthy();
    expect(screen.getByText(/em andamento 1/i)).toBeTruthy();
    expect(screen.getByText(/concluídas 1/i)).toBeTruthy();
    expect(screen.getByText(/limites do caixa/i)).toBeTruthy();
    expect(screen.getByText(/em risco 1/i)).toBeTruthy();
    expect(screen.getByText(/estourados 1/i)).toBeTruthy();
    expect(screen.getByText(/ativos 2/i)).toBeTruthy();
  });
});
