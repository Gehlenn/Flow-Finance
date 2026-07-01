import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Insights from '../../pages/Insights';
import { Category, ReminderType, TransactionType, type Transaction } from '../../types';

const productAnalyticsMocks = vi.hoisted(() => ({
  trackProductEventMock: vi.fn(),
}));

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

vi.mock('../../src/app/productAnalytics', () => ({
  trackProductEvent: productAnalyticsMocks.trackProductEventMock,
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
  beforeEach(() => {
    productAnalyticsMocks.trackProductEventMock.mockReset();
  });

  it('estado vazio direciona primeira sessao para importar dados ou revisar fluxo', () => {
    const onNavigateToTab = vi.fn();

    render(
      <Insights
        activeWorkspaceName="Workspace Teste"
        transactions={[]}
        userId="u1"
        workspacePlan="free"
        hideValues={false}
        onNavigateToTab={onNavigateToTab}
      />,
    );

    expect(screen.getByText(/Primeira leitura de caixa/i)).toBeTruthy();
    expect(screen.getByText(/Monte o primeiro retrato de caixa/i)).toBeTruthy();
    expect(screen.getByText(/saldo confirmado e proxima acao/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Importar transacoes/i }));
    expect(onNavigateToTab).toHaveBeenCalledWith('import');

    fireEvent.click(screen.getByRole('button', { name: /Ver fluxo/i }));
    expect(onNavigateToTab).toHaveBeenCalledWith('flow');
  });

  it('plano free mostra camada essencial com card de upgrade', () => {
    const onNavigateToTab = vi.fn();
    const onCreateReminder = vi.fn();

    render(
      <Insights
        activeWorkspaceName="Workspace Teste"
        transactions={baseTransactions}
        userId="u1"
        workspacePlan="free"
        hideValues={false}
        onNavigateToTab={onNavigateToTab}
        onCreateReminder={onCreateReminder}
      />,
    );

    expect(screen.getByText(/Leituras comparativas/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Base da leitura/i })).toBeNull();
    expect(screen.getAllByText(/Pr.*xima a.*o/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Gastos dentro da media/i }));
    expect(productAnalyticsMocks.trackProductEventMock).toHaveBeenCalledWith(
      'ai_insight_opened',
      expect.objectContaining({
        source: 'insights_page',
        item_type: 'insight',
        insight_type: 'spending',
        severity: 'low',
        plan: 'free',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Abrir assistente/i }));
    expect(onNavigateToTab).toHaveBeenCalledWith('assistant');
    fireEvent.click(screen.getByRole('button', { name: /Criar lembrete/i }));
    expect(onCreateReminder).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringMatching(/Revisar a pr.*xima a.*o do caixa/i),
      priority: 'media',
    }));
    expect(productAnalyticsMocks.trackProductEventMock).toHaveBeenCalledWith(
      'decision_saved',
      expect.objectContaining({
        source: 'insights_page',
        origin: 'next_action',
        decision_type: 'reminder',
        item_type: 'next_action',
        plan: 'free',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Acompanhar risco/i }));
    expect(onCreateReminder).toHaveBeenLastCalledWith(expect.objectContaining({
      title: 'Acompanhar risco do caixa',
      priority: 'media',
      type: ReminderType.NEGOCIO,
      completed: false,
    }));
    expect(productAnalyticsMocks.trackProductEventMock).toHaveBeenCalledWith(
      'decision_saved',
      expect.objectContaining({
        source: 'insights_page',
        origin: 'risk_follow_up',
        decision_type: 'reminder',
        item_type: 'low_balance',
        plan: 'free',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Ver fluxo/i }));
    expect(onNavigateToTab).toHaveBeenCalledWith('flow');
  });

  it('plano pro libera contexto avancado sem card de upgrade', () => {
    const onNavigateToTab = vi.fn();
    const onCreateReminder = vi.fn();

    render(
      <Insights
        activeWorkspaceName="Workspace Teste"
        transactions={baseTransactions}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
        onNavigateToTab={onNavigateToTab}
        onCreateReminder={onCreateReminder}
      />,
    );

    expect(screen.getByText(/Base da leitura/i)).toBeTruthy();
    expect(screen.queryByText(/Leituras comparativas/i)).toBeNull();
    expect(screen.getByText(/Padrao de fluxo/i)).toBeTruthy();
    expect(screen.getAllByText(/Pr.*xima a.*o/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Ver metas/i }));
    expect(onNavigateToTab).toHaveBeenCalledWith('goals');
    fireEvent.click(screen.getByRole('button', { name: /Criar lembrete/i }));
    expect(onCreateReminder).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringMatching(/Revisar a pr.*xima a.*o do caixa/i),
      priority: 'media',
    }));
    const riskButtons = screen.getAllByRole('button', { name: /Acompanhar risco/i });
    fireEvent.click(riskButtons[1]);
    expect(onCreateReminder).toHaveBeenLastCalledWith(expect.objectContaining({
      title: 'Acompanhar risco do caixa',
      priority: 'alta',
      type: ReminderType.NEGOCIO,
      completed: false,
    }));
    const flowButtons = screen.getAllByRole('button', { name: /Ver fluxo/i });
    fireEvent.click(flowButtons[1]);
    expect(onNavigateToTab).toHaveBeenCalledWith('flow');
  });
});




