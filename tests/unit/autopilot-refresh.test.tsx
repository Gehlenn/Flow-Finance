import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Autopilot from '../../pages/Autopilot';
import { Category, TransactionType, type Transaction } from '../../types';
import { Account } from '../../models/Account';
import { learnAutopilotPatterns } from '../../src/ai/financialAutopilot';

const autopilotMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/ai/aiOrchestrator', () => ({
  runAIPipelineSync: vi.fn(() => ({
    financial_state: {
      cashflow_prediction: {
        balance_7_days: 900,
        balance_30_days: 1200,
      },
    },
    insights: [],
  })),
}));

vi.mock('../../src/ai/financialAutopilot', () => ({
  runFinancialAutopilot: vi.fn(() => [
    {
      id: 'action-1',
      type: 'warning',
      severity: 'high',
      title: 'Saldo negativo possivel',
      description: 'Teste de restauração',
      created_at: '2026-05-02T00:00:00.000Z',
    },
  ]),
  learnAutopilotPatterns: vi.fn(async () => undefined),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: autopilotMocks.logWarn,
}));

const baseTransactions: Transaction[] = [
  {
    id: 'tx-1',
    amount: 150,
    type: TransactionType.RECEITA,
    category: Category.NEGOCIO,
    description: 'Recebimento',
    date: '2026-04-10T10:00:00.000Z',
  },
];

const baseAccounts: Account[] = [
  {
    id: 'acc-1',
    user_id: 'test-user',
    name: 'Conta principal',
    balance: 1000,
    type: 'bank',
    currency: 'BRL',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

describe('Autopilot refresh', () => {
  it('shows a visible diagnostic when background learning fails', async () => {
    vi.mocked(learnAutopilotPatterns).mockRejectedValueOnce(new Error('learning failed'));

    render(
      <Autopilot
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
      />,
    );

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/Aprendizado do Autopilot indisponivel/i)).toBeTruthy();
    expect(screen.getByText(/Nao foi possivel atualizar o aprendizado automatico em segundo plano agora/i)).toBeTruthy();
    expect(autopilotMocks.logWarn).toHaveBeenCalledWith(
      '[Autopilot] Failed to learn patterns',
      expect.objectContaining({
        fallback: 'autopilot-learning-failed',
      }),
    );
  });

  it('restaura as acoes dispensadas sem prometer recomputar analise', () => {
    vi.useFakeTimers();
    render(
      <Autopilot
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
      />,
    );

    expect(screen.getByText('Saldo negativo possivel')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Dispensar/i }));
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.queryByText('Saldo negativo possivel')).toBeNull();

    fireEvent.click(screen.getByText(/Reexibir ações/i));
    expect(screen.getByText('Saldo negativo possivel')).toBeTruthy();
    vi.useRealTimers();
  });
});
