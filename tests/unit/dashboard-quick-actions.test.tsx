import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Dashboard from '../../components/Dashboard';

describe('dashboard quick actions', () => {
  it('exposes contextual access to insights and accounts', () => {
    const onNavigateToInsights = vi.fn();
    const onNavigateToAccounts = vi.fn();

    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[]}
        alerts={[]}
        reminders={[]}
        hideValues={false}
        onNavigateToInsights={onNavigateToInsights}
        onNavigateToAccounts={onNavigateToAccounts}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver insights/i }));
    fireEvent.click(screen.getByRole('button', { name: /gerenciar contas/i }));

    expect(onNavigateToInsights).toHaveBeenCalledTimes(1);
    expect(onNavigateToAccounts).toHaveBeenCalledTimes(1);
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

    expect(screen.getByText(/Foco do periodo/i)).toBeTruthy();
    expect(screen.getByText(/Caixa sob controle|Saidas acima das entradas|Alertas pedem revisao|Receita prevista ainda nao realizada/i)).toBeTruthy();
  });

  it('shows clinic pending reminder strip when metadata comes from integration', () => {
    render(
      <Dashboard
        userName="Flow User"
        activeWorkspaceName="Workspace 1"
        transactions={[]}
        accounts={[]}
        alerts={[]}
        reminders={[
          {
            id: 'rem-1',
            title: 'Cobranca consulta',
            date: new Date().toISOString(),
            type: 'Negócio' as any,
            amount: 200,
            completed: false,
            priority: 'media',
            source: 'clinic-automation',
          } as any,
        ]}
        hideValues={false}
      />,
    );

    expect(screen.getByText(/Cobrancas da clinica pendentes/i)).toBeTruthy();
  });
});
