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
});
