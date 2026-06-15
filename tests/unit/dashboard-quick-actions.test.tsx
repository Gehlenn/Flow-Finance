import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Dashboard from '../../components/Dashboard';
import { Account } from '../../models/Account';
import { Category, ReminderType, TransactionType, type Receivable, type Reminder, type Transaction } from '../../types';

const analyticsMocks = vi.hoisted(() => ({
  trackProductEventOnce: vi.fn(() => true),
}));

vi.mock('../../src/app/productAnalytics', () => ({
  trackProductEventOnce: analyticsMocks.trackProductEventOnce,
}));

describe('dashboard quick actions', () => {
  const buildReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
    id: 'rem-1',
    title: 'Cobranca consulta',
    date: new Date().toISOString(),
    type: ReminderType.NEGOCIO,
    amount: 200,
    completed: false,
    priority: 'media',
    ...overrides,
  });

  const buildAccount = (): Account => ({
    id: 'acc-1',
    user_id: 'user-1',
    name: 'Conta principal',
    type: 'cash',
    balance: 100,
    currency: 'BRL',
    created_at: new Date().toISOString(),
  });

  const buildReceivable = (): Receivable => ({
    id: 'rec-1',
    description: 'Recebimento futuro',
    expected_amount: 200,
    realized_amount: 0,
    due_date: new Date().toISOString(),
    realized_at: null,
    status: 'open',
    source: 'manual',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  it('exposes contextual access to transactions, cash flow, insights and revenue forecast', () => {
    const onNavigateToHistory = vi.fn();
    const onNavigateToFlow = vi.fn();
    const onNavigateToInsights = vi.fn();
    const onNavigateToSettings = vi.fn();

    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceId="workspace-1"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[buildAccount()]}
        alerts={[]}
        reminders={[]}
        hideValues={false}
        onNavigateToHistory={onNavigateToHistory}
        onNavigateToFlow={onNavigateToFlow}
        onNavigateToInsights={onNavigateToInsights}
        onNavigateToSettings={onNavigateToSettings}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver transacoes/i }));
    fireEvent.click(screen.getByRole('button', { name: /abrir fluxo de caixa/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver insights/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver receitas previstas/i }));
    fireEvent.click(screen.getByRole('button', { name: /abrir ajustes/i }));

    expect(onNavigateToHistory).toHaveBeenCalledTimes(1);
    expect(onNavigateToFlow).toHaveBeenCalledTimes(2);
    expect(onNavigateToInsights).toHaveBeenCalledTimes(1);
    expect(onNavigateToSettings).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.trackProductEventOnce).toHaveBeenCalledWith(
      'activation_first_dashboard_useful',
      'workspace-1',
      expect.objectContaining({
        transactions_count: 0,
        inflow_month: 0,
      }),
    );
  });

  it('surfaces the cash decision strip as a first-class dashboard metric', () => {
    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceId="workspace-1"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[buildAccount()]}
        alerts={[]}
        reminders={[]}
        hideValues={false}
      />,
    );

    expect(screen.getAllByText(/Caixa real/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Previsto curto/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pendente/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vencido/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /registrar revisao semanal/i })).toBeTruthy();
  });

  it('tracks completed financial activation when the minimum base is present', async () => {
    render(
      <Dashboard
        userName="Flow User"
        userId="user-1"
        activeWorkspaceId="workspace-1"
        activeWorkspaceName="Workspace 1"
        transactions={[
          {
            id: 'tx-income',
            amount: 800,
            type: TransactionType.RECEITA,
            category: Category.NEGOCIO,
            description: 'Pagamento de servico',
            date: new Date().toISOString(),
          } as Transaction,
          {
            id: 'tx-expense',
            amount: 180,
            type: TransactionType.DESPESA,
            category: Category.NEGOCIO,
            description: 'Custo operacional',
            date: new Date().toISOString(),
          } as Transaction,
        ]}
        accounts={[buildAccount()]}
        alerts={[]}
        reminders={[]}
        receivables={[buildReceivable()]}
        hideValues={false}
      />,
    );

    await waitFor(() => {
      expect(analyticsMocks.trackProductEventOnce).toHaveBeenCalledWith(
        'activation_financial_base_completed',
        'workspace-1',
        expect.objectContaining({
          source: 'dashboard_activation',
          completed_steps: 4,
          has_initial_balance: true,
          has_inflow: true,
          has_outflow: true,
          has_receivable: true,
        }),
      );
    });
  });

  it('records the weekly cash review ritual from the dashboard', async () => {
    render(
      <Dashboard
        userName="Flow User"
        userId="user-1"
        activeWorkspaceId="workspace-1"
        activeWorkspaceName="Workspace 1"
        transactions={[
          {
            id: 'tx-1',
            amount: 800,
            type: TransactionType.RECEITA,
            category: Category.NEGOCIO,
            description: 'Pagamento de servico',
            date: new Date().toISOString(),
          } as Transaction,
        ]}
        accounts={[buildAccount()]}
        alerts={[]}
        reminders={[]}
        receivables={[buildReceivable()]}
        hideValues={false}
      />,
    );

    analyticsMocks.trackProductEventOnce.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /registrar revisao semanal/i }));

    await waitFor(() => {
      expect(analyticsMocks.trackProductEventOnce).toHaveBeenCalledWith(
        'weekly_cash_review_completed',
        expect.stringContaining('workspace-1'),
        expect.objectContaining({
          source: 'weekly_cash_review',
        }),
      );
    });

    expect(screen.getByText(/Revisao desta semana registrada/i)).toBeTruthy();
  });

  it('surfaces a focus note for the current period', () => {
    const onOpenEntryCapture = vi.fn();

    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceId="workspace-1"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[]}
        alerts={[]}
        reminders={[]}
        hideValues={false}
        onOpenEntryCapture={onOpenEntryCapture}
      />,
    );

    expect(screen.getByText(/O que pede atencao/i)).toBeTruthy();
    expect(screen.getByText(/Faltam dados para ler o caixa/i)).toBeTruthy();
    expect(screen.queryByText(/Caixa sob controle/i)).toBeNull();
    expect(screen.getByText(/Monte a primeira leitura de caixa/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /adicionar lancamento/i }));

    expect(onOpenEntryCapture).toHaveBeenCalledTimes(1);
  });

  it('creates the initial cash-flow base from activation form', async () => {
    const onCreateAccount = vi.fn().mockResolvedValue(undefined);
    const onAddTransactions = vi.fn().mockResolvedValue(undefined);
    const onAddReminder = vi.fn().mockResolvedValue(undefined);

    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceId="workspace-1"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[]}
        alerts={[]}
        reminders={[]}
        hideValues={false}
        onCreateAccount={onCreateAccount}
        onAddTransactions={onAddTransactions}
        onAddReminder={onAddReminder}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Saldo hoje/i), { target: { value: '1000,00' } });
    fireEvent.change(screen.getByLabelText(/^Entrada$/i), { target: { value: '500,00' } });
    fireEvent.change(screen.getByLabelText(/^Saida$/i), { target: { value: '120,00' } });
    fireEvent.change(screen.getByLabelText(/^Recebivel$/i), { target: { value: '800,00' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar base/i }));

    await waitFor(() => {
      expect(onCreateAccount).toHaveBeenCalledWith({
        name: 'Saldo inicial',
        type: 'cash',
        balance: 1000,
      });
      expect(onAddTransactions).toHaveBeenCalledWith([
        expect.objectContaining({
          amount: 500,
          type: 'Receita',
          description: 'Entrada inicial',
        }),
        expect.objectContaining({
          amount: 120,
          type: 'Despesa',
          description: 'Saida inicial',
        }),
      ]);
      expect(onAddReminder).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Recebivel inicial',
        amount: 800,
        priority: 'alta',
      }));
    });
  });

  it('shows generic pending receivables strip without domain-specific language', () => {
    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceId="workspace-1"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[]}
        alerts={[]}
        reminders={[
          buildReminder({
            title: 'Cobranca consulta',
            source: 'clinic-automation',
          }),
        ]}
        hideValues={false}
      />,
    );

    expect(screen.getByText(/Recebiveis pendentes no curto prazo/i)).toBeTruthy();
    expect(screen.queryByText(/Cobrancas operacionais pendentes/i)).toBeNull();
  });

  it('keeps overdue and pending amounts visually separated on the dashboard', () => {
    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceId="workspace-1"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[]}
        alerts={[]}
        reminders={[
          buildReminder({
            id: 'pending-1',
            title: 'Recebimento futuro',
            date: '2099-04-10T09:00:00.000Z',
          }),
          buildReminder({
            id: 'overdue-1',
            title: 'Recebimento vencido',
            date: '2020-04-10T09:00:00.000Z',
            priority: 'alta',
          }),
        ]}
        hideValues={false}
      />,
    );

    expect(screen.getAllByText(/Pendente/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Vencido/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Recebivel pendente nao aparece como dinheiro disponivel/i)).toBeTruthy();
  });
});
