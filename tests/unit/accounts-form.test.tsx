import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Accounts from '../../pages/Accounts';
import { type Account } from '../../models/Account';

const accountsMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: accountsMocks.logWarn,
}));

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

    expect(screen.getByText(/Caixa e contas/i)).toBeTruthy();
    expect(screen.getAllByText(/Saldo consolidado/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Nova conta de caixa/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Nubank/i), { target: { value: 'Conta teste' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '123,45' } });

    fireEvent.click(screen.getByRole('button', { name: /Fechar/i }));

    fireEvent.click(screen.getByRole('button', { name: /Nova conta de caixa/i }));
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

    fireEvent.click(screen.getByRole('button', { name: /Nova conta de caixa/i }));
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

    fireEvent.click(screen.getByRole('button', { name: /Nova conta de caixa/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Nubank/i), { target: { value: 'Conta teste' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Conta/i }));

    expect(onCreateAccount).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeTruthy();
  });


  it('mostra diagnostico visivel quando o saldo inicial e invalido', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /Nova conta de caixa/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Nubank/i), { target: { value: 'Conta teste' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Conta/i }));

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/O valor informado nao pode ser convertido em moeda/i)).toBeTruthy();
    expect(screen.getByText(/Proximo passo:/i)).toBeTruthy();
  });

  it('mostra diagnostico visivel quando salvar a conta falha', async () => {
    const onCreateAccount = vi.fn(async () => {
      throw new Error('save failed');
    });

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

    fireEvent.click(screen.getByRole('button', { name: /Nova conta de caixa/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Nubank/i), { target: { value: 'Conta teste' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '123,45' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Conta/i }));

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/Falha ao criar conta/i)).toBeTruthy();
    expect(screen.getByText(/Nao foi possivel salvar a conta agora/i)).toBeTruthy();
    expect(screen.getByText(/Proximo passo:/i)).toBeTruthy();
    expect(accountsMocks.logWarn).toHaveBeenCalledWith(
      '[Accounts] Failed to create account',
      expect.objectContaining({
        fallback: 'accounts-create-account-failed',
      }),
    );
  });
});
