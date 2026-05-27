import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Dashboard from '../../components/Dashboard';
import { ReminderType, type Reminder } from '../../types';

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

  it('exposes contextual access to transactions, cash flow, insights and revenue forecast', () => {
    const onNavigateToHistory = vi.fn();
    const onNavigateToFlow = vi.fn();
    const onNavigateToInsights = vi.fn();
    const onNavigateToSettings = vi.fn();

    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[]}
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
  });

  it('surfaces projected revenue as a first-class dashboard metric', () => {
    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[]}
        alerts={[]}
        reminders={[]}
        hideValues={false}
      />,
    );

    expect(screen.getByText(/Receita prevista/i)).toBeTruthy();
  });

  it('surfaces a focus note for the current period', () => {
    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[]}
        alerts={[]}
        reminders={[]}
        hideValues={false}
      />,
    );

    expect(screen.getByText(/O que pede atencao/i)).toBeTruthy();
    expect(screen.getByText(/Caixa sob controle|Saidas acima das entradas|Alertas pedem revisao|Previstos ainda nao viraram caixa|Recebiveis vencidos pedem acao/i)).toBeTruthy();
  });

  it('shows generic pending receivables strip without domain-specific language', () => {
    render(
      <Dashboard
        userName="Flow User"
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
