import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Accounts from '../../pages/Accounts';
import { type Account } from '../../models/Account';

const accounts: Account[] = [
  {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'Conta principal',
    balance: 1200,
    type: 'bank',
    currency: 'BRL',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

describe('Accounts form', () => {
  it('reseta o rascunho ao reabrir o formulario', () => {
    render(
      <Accounts
        userId="user-1"
        hideValues={false}
        activeWorkspaceName="Workspace"
        activeTenantName="Tenant"
        activeWorkspaceRole="admin"
        accounts={accounts}
        onCreateAccount={vi.fn(async () => undefined)}
        onDeleteAccount={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Nova Conta/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Nubank/i), { target: { value: 'Conta teste' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '123,45' } });

    fireEvent.click(screen.getByRole('button', { name: /Fechar/i }));

    fireEvent.click(screen.getByRole('button', { name: /Nova Conta/i }));
    expect((screen.getByPlaceholderText(/Ex: Nubank/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('0,00') as HTMLInputElement).value).toBe('');
  });

  it('interpreta saldo inicial com separador decimal pt-BR', async () => {
    const onCreateAccount = vi.fn(async () => undefined);

    render(
      <Accounts
        userId="user-1"
        hideValues={false}
        activeWorkspaceName="Workspace"
        activeTenantName="Tenant"
        activeWorkspaceRole="admin"
        accounts={accounts}
        onCreateAccount={onCreateAccount}
        onDeleteAccount={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Nova Conta/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Nubank/i), { target: { value: 'Conta teste' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '123,45' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Conta/i }));

    expect(onCreateAccount).toHaveBeenCalledWith(expect.objectContaining({ balance: 123.45 }));
  });

  it('bloqueia saldo inicial invalido em vez de salvar zero silenciosamente', async () => {
    const onCreateAccount = vi.fn(async () => undefined);

    render(
      <Accounts
        userId="user-1"
        hideValues={false}
        activeWorkspaceName="Workspace"
        activeTenantName="Tenant"
        activeWorkspaceRole="admin"
        accounts={accounts}
        onCreateAccount={onCreateAccount}
        onDeleteAccount={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Nova Conta/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Nubank/i), { target: { value: 'Conta teste' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Conta/i }));

    expect(onCreateAccount).not.toHaveBeenCalled();
    expect(screen.getByText(/Saldo inicial invalido/i)).toBeTruthy();
  });
});
