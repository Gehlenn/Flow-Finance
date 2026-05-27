import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AICFO from '../../pages/AICFO';
import { Category, ReminderType, TransactionType, type Transaction } from '../../types';
import { Account } from '../../models/Account';
import { generateCFOResponse, learnFromConversation } from '../../src/ai/aiCFO';

Element.prototype.scrollIntoView = vi.fn();

const aicfoMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
  ensureActiveWorkspace: vi.fn(),
  getCurrentWorkspaceIdentity: vi.fn(),
  getWorkspaceBillingOverview: vi.fn(),
  incrementWorkspaceUsage: vi.fn(),
}));

vi.mock('../../src/ai/riskAnalyzer', () => ({
  buildCashflowPrediction: vi.fn(() => ({
    current_balance: 1000,
    balance_7_days: 900,
    balance_30_days: 1200,
    projected_income: 1400,
    projected_expenses: 500,
  })),
}));

vi.mock('../../src/ai/signalEngine', () => ({
  computeFinancialSignals: vi.fn(() => []),
  signalsToInsights: vi.fn(() => []),
}));

vi.mock('../../src/app/productFinancialIntelligence', () => ({
  buildProductFinancialIntelligence: vi.fn(() => ({
    recurringCount: 1,
    dominantCategoryLabel: 'Negocio',
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

vi.mock('../../src/utils/logger', () => ({
  logWarn: aicfoMocks.logWarn,
}));

vi.mock('../../src/services/workspaceSession', () => ({
  ensureActiveWorkspace: aicfoMocks.ensureActiveWorkspace,
  getCurrentWorkspaceIdentity: aicfoMocks.getCurrentWorkspaceIdentity,
}));

vi.mock('../../src/services/firestoreBillingStore', () => ({
  getWorkspaceBillingOverview: aicfoMocks.getWorkspaceBillingOverview,
  incrementWorkspaceUsage: aicfoMocks.incrementWorkspaceUsage,
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
  beforeEach(() => {
    vi.clearAllMocks();
    aicfoMocks.getCurrentWorkspaceIdentity.mockReturnValue({ userId: 'u1' });
    aicfoMocks.ensureActiveWorkspace.mockResolvedValue({
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      name: 'Workspace 1',
      tenantName: 'Tenant 1',
      plan: 'free',
      role: 'owner',
      isDefault: true,
    });
    aicfoMocks.getWorkspaceBillingOverview.mockResolvedValue({
      currentPlan: 'free',
      usage: { '2026-05': { transactions: 0, aiQueries: 0, bankConnections: 0 } },
      currentMonthUsage: { transactions: 0, aiQueries: 0, bankConnections: 0 },
      billingState: {
        workspaceId: 'ws-1',
        tenantId: 'tenant-1',
        plan: 'free',
        status: 'active',
        updatedAt: '2026-05-15T00:00:00.000Z',
        updatedByUserId: 'u1',
      },
      billingHooks: [],
    });
    aicfoMocks.incrementWorkspaceUsage.mockResolvedValue(1);
  });

  it('plano free exibe banner de modo essencial e reduz atalho de prompts', () => {
    render(
      <AICFO
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="free"
        hideValues={false}
        onNavigateToTab={vi.fn()}
        onCreateReminder={vi.fn()}
      />,
    );

    expect(screen.getByText(/Modo Free/i)).toBeTruthy();
    expect(screen.getByText(/20 consultas por mes/i)).toBeTruthy();
    expect(screen.getByText(/Resumo do caixa/i)).toBeTruthy();
  });

  it('plano pro remove banner free e libera prompt completo', () => {
    render(
      <AICFO
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
        onNavigateToTab={vi.fn()}
        onCreateReminder={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Modo Free/i)).toBeNull();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText(/Perguntas rápidas do caixa/i)).toBeTruthy();
  });

  it('bloqueia a consulta 21 do plano free com paywall visivel', async () => {
    aicfoMocks.getWorkspaceBillingOverview.mockResolvedValueOnce({
      currentPlan: 'free',
      usage: { '2026-05': { transactions: 0, aiQueries: 20, bankConnections: 0 } },
      currentMonthUsage: { transactions: 0, aiQueries: 20, bankConnections: 0 },
      billingState: {
        workspaceId: 'ws-1',
        tenantId: 'tenant-1',
        plan: 'free',
        status: 'active',
        updatedAt: '2026-05-15T00:00:00.000Z',
        updatedByUserId: 'u1',
      },
      billingHooks: [],
    });

    render(
      <AICFO
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="free"
        hideValues={false}
        onNavigateToTab={vi.fn()}
        onCreateReminder={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Consultor IA ilimitado/i)).toBeTruthy();
    expect(screen.getByText(/limite mensal do Free/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Assinar Pro agora/i })).toBeTruthy();
  });

  it('mostra diagnostico explicito quando a resposta do CFO cai em fallback', async () => {
    vi.mocked(generateCFOResponse).mockResolvedValueOnce({
      answer: 'Nao foi possivel gerar uma resposta no momento.',
      diagnostic: {
        kind: 'ai_unavailable',
        message: 'Nao foi possivel gerar uma resposta no momento.',
        suggestion: 'Tente novamente em alguns instantes ou verifique a sessao do workspace.',
      },
      timestamp: new Date().toISOString(),
    });

    render(
      <AICFO
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
        onNavigateToTab={vi.fn()}
        onCreateReminder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Posso pagar a semana\?/i }));

    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico da IA/i)).toBeTruthy();
    });
    expect(screen.getAllByText(/Nao foi possivel gerar uma resposta no momento/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Tente novamente em alguns instantes ou verifique a sessao do workspace/i)).toBeTruthy();
  });

  it('mostra diagnostico visivel quando o aprendizado da conversa falha', async () => {
    vi.mocked(learnFromConversation).mockRejectedValueOnce(new Error('learning failed'));

    render(
      <AICFO
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
        onNavigateToTab={vi.fn()}
        onCreateReminder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Posso pagar a semana\?/i }));

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/Aprendizado da conversa indisponivel/i)).toBeTruthy();
    expect(screen.getByText(/Nao foi possivel atualizar o aprendizado do CFO em segundo plano agora/i)).toBeTruthy();
    expect(aicfoMocks.logWarn).toHaveBeenCalledWith(
      '[AICFO] Failed to learn from conversation',
      expect.objectContaining({
        fallback: 'aicfo-learn-from-conversation-failed',
      }),
    );
  });

  it('oferece acao operacional na resposta do CFO', async () => {
    const onNavigateToTab = vi.fn();
    const onCreateReminder = vi.fn();

    render(
      <AICFO
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
        onNavigateToTab={onNavigateToTab}
        onCreateReminder={onCreateReminder}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Posso pagar a semana\?/i }));

    await waitFor(() => {
      expect(screen.getByText(/Resposta consultiva\./i)).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Criar lembrete/i }).at(-1)!);
    expect(onCreateReminder).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Revisar recomendacao do CFO',
      priority: 'media',
      type: ReminderType.NEGOCIO,
      completed: false,
    }));

    fireEvent.click(screen.getAllByRole('button', { name: /Ver fluxo/i }).at(-1)!);
    expect(onNavigateToTab).toHaveBeenCalledWith('flow');
  });

  it('mostra diagnostico visivel quando a geracao do CFO falha', async () => {
    vi.mocked(generateCFOResponse).mockRejectedValueOnce(new Error('generation failed'));

    render(
      <AICFO
        transactions={baseTransactions}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
        onNavigateToTab={vi.fn()}
        onCreateReminder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Posso pagar a semana\?/i }));

    expect(await screen.findByText(/não consegui processar esta consulta agora/i)).toBeTruthy();
    expect(aicfoMocks.logWarn).toHaveBeenCalledWith(
      '[AICFO] Failed to generate CFO response',
      expect.objectContaining({
        fallback: 'aicfo-generate-response-failed',
      }),
    );
  });

  it('mostra profundidade reduzida quando a base e limitada', async () => {
    vi.mocked(generateCFOResponse).mockResolvedValueOnce({
      answer: 'Resposta consultiva.',
      timestamp: new Date().toISOString(),
      explainability: {
        reasons_used: ['Base limitada'],
        evidence: {
          base_sufficiency: 'limited',
        },
        confidence_band: 'low',
      },
      response_depth: 'reduced',
    });

    render(
      <AICFO
        transactions={baseTransactions.slice(0, 2)}
        accounts={baseAccounts}
        userId="u1"
        workspacePlan="pro"
        hideValues={false}
        onNavigateToTab={vi.fn()}
        onCreateReminder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Posso pagar a semana\?/i }));

    await waitFor(() => {
      expect(screen.getByText(/Profundidade reduzida/i)).toBeTruthy();
      expect(screen.getByText(/Base incompleta/i)).toBeTruthy();
    });
  });
});
