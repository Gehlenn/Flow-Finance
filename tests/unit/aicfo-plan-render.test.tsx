import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AICFO from '../../pages/AICFO';
import { Category, TransactionType, type Transaction } from '../../types';
import { Account } from '../../models/Account';

Element.prototype.scrollIntoView = vi.fn();

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

vi.mock('../../src/app/productFinancialIntelligence', () => ({
  buildProductFinancialIntelligence: vi.fn(() => ({
    recurringCount: 1,
    dominantCategoryLabel: 'Negócio',
    context: {
      confidence: { overall: 0.88 },
      cashflowForecast: {
        currentBalance: 1000,
        in7Days: 900,
        in30Days: 1200,
      },
      base: {
        financialProfile: {
          score: 70,
          label: 'Estavel',
        },
      },
    },
  })),
}));

vi.mock('../../src/ai/aiCFO', () => ({
  analyzeFinancialQuestion: vi.fn(() => 'monthly_summary'),
  generateCFOResponse: vi.fn(async () => ({
    answer: 'Resposta consultiva.',
    timestamp: new Date().toISOString(),
  })),
  learnFromConversation: vi.fn(async () => undefined),
  buildFinancialContext: vi.fn(() => 'contexto'),
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
  {
    id: 'tx-2',
    amount: 80,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Despesa',
    date: '2026-04-09T10:00:00.000Z',
  },
  {
    id: 'tx-3',
    amount: 120,
    type: TransactionType.RECEITA,
    category: Category.NEGOCIO,
    description: 'Recebimento 2',
    date: '2026-04-08T10:00:00.000Z',
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

describe('AICFO plan render', () => {
  it('plano free exibe banner de modo essencial e reduz atalho de prompts', () => {
    render(
      <AICFO
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="free"
        hideValues={false}
      />,
    );

    expect(screen.getByText(/Modo Free/i)).toBeTruthy();
    expect(screen.queryByText(/Resumo do mês/i)).toBeNull();
  });

  it('plano pro remove banner free e libera prompt completo', () => {
    render(
      <AICFO
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
      />,
    );

    expect(screen.queryByText(/Modo Free/i)).toBeNull();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(6);
  });
});
