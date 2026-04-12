import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Insights from '../../pages/Insights';
import { Category, TransactionType, type Transaction } from '../../types';

vi.mock('../../src/ai/aiOrchestrator', () => ({
  runAIPipelineSync: vi.fn(() => ({
    financial_state: {},
    profile: {
      emoji: '📊',
      label: 'Perfil equilibrado',
      profile: 'equilibrado',
      description: 'Perfil baseado no historico atual.',
      score: {
        consistencia: 8,
        previsibilidade: 7,
      },
    },
    risks: [
      { id: 'risk-1', type: 'low_balance', severity: 'medium', message: 'Atenção ao caixa desta semana.' },
      { id: 'risk-2', type: 'negative_forecast', severity: 'high', message: 'Risco de saldo negativo no horizonte.' },
    ],
    insights: [
      { id: 'insight-1', type: 'spending', severity: 'low', message: 'Gastos dentro da media.' },
      { id: 'insight-2', type: 'warning', severity: 'medium', message: 'Categoria com aceleração recente.' },
      { id: 'insight-3', type: 'saving', severity: 'low', message: 'Espaco para reserva no mes.' },
    ],
    health_score: 78,
    health_label: 'saudável',
    processing_ms: 12,
    computed_at: new Date().toISOString(),
  })),
}));

vi.mock('../../src/app/productFinancialIntelligence', () => ({
  buildProductFinancialIntelligence: vi.fn(() => ({
    recurringCount: 2,
    merchantCoveragePercent: 75,
    dominantCategoryLabel: 'Negócio',
    context: {
      confidence: { overall: 0.82 },
      cashflowForecast: {
        currentBalance: 1000,
        in7Days: 900,
        in30Days: 1400,
      },
    },
  })),
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

describe('Insights plan render', () => {
  it('plano free mostra camada essencial com card de upgrade', () => {
    render(
      <Insights
        activeWorkspaceName="Workspace Teste"
        transactions={baseTransactions}
        userId="u1"
        workspacePlan="free"
        hideValues={false}
      />,
    );

    expect(screen.getByText(/Insights aprofundados e comparativos/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Contexto Avancado/i })).toBeNull();
  });

  it('plano pro libera contexto avancado sem card de upgrade', () => {
    render(
      <Insights
        activeWorkspaceName="Workspace Teste"
        transactions={baseTransactions}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
      />,
    );

    expect(screen.getByText(/Contexto Avancado/i)).toBeTruthy();
    expect(screen.queryByText(/Insights aprofundados e comparativos/i)).toBeNull();
    expect(screen.getByText(/Perfil Financeiro/i)).toBeTruthy();
  });
});
