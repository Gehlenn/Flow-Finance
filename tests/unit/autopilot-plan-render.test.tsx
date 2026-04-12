import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Autopilot from '../../pages/Autopilot';
import { Category, TransactionType, type Transaction } from '../../types';
import { Account } from '../../models/Account';

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
  runFinancialAutopilot: vi.fn(() => []),
  learnAutopilotPatterns: vi.fn(async () => undefined),
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

describe('Autopilot plan render', () => {
  it('plano free exibe UpgradePromptCard e nao renderiza conteudo do Autopilot', () => {
    render(
      <Autopilot
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="free"
        hideValues={false}
      />,
    );

    expect(screen.getByText(/Plano Pro/i)).toBeTruthy();
    expect(screen.getByText(/Análise financeira proativa/i)).toBeTruthy();
    expect(screen.queryByText('Autopilot')).toBeNull();
  });

  it('plano pro renderiza conteudo do Autopilot sem UpgradePromptCard', () => {
    render(
      <Autopilot
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
      />,
    );

    expect(screen.queryByText(/Plano Pro/i)).toBeNull();
    expect(screen.getByText('Autopilot')).toBeTruthy();
  });
});
