import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OpenBankingPage from '../../pages/OpenBanking';

const openBankingMocks = vi.hoisted(() => ({
  reloadConnections: vi.fn().mockResolvedValue([]),
  getBankingHealth: vi.fn(),
  listPluggyConnectors: vi.fn().mockResolvedValue([]),
  createPluggyConnectToken: vi.fn(),
  connectBank: vi.fn(),
  connectPluggyItem: vi.fn(),
  disconnectBank: vi.fn(),
  fullSync: vi.fn(),
  formatLastSync: vi.fn(() => 'agora'),
  logWarn: vi.fn(),
  mapPluggyConnectErrorMessage: vi.fn((error: unknown) => (
    error instanceof Error ? error.message : 'Erro no Pluggy'
  )),
}));

const connectedConnection = {
  id: 'conn-1',
  user_id: 'user-1',
  bank_name: 'Nubank',
  bank_logo: 'N',
  bank_color: '#8A05BE',
  provider: 'mock' as const,
  connection_status: 'connected' as const,
  external_account_id: 'external-1',
  created_at: '2026-05-07T00:00:00.000Z',
};

const errorConnection = {
  ...connectedConnection,
  id: 'conn-error',
  connection_status: 'error' as const,
  error_message: 'Falha anterior',
};

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => <div data-testid="pluggy-connect" />,
}));

vi.mock('../../services/integrations/openBankingService', () => ({
  reloadConnections: openBankingMocks.reloadConnections,
  getBankingHealth: openBankingMocks.getBankingHealth,
  listPluggyConnectors: openBankingMocks.listPluggyConnectors,
  createPluggyConnectToken: openBankingMocks.createPluggyConnectToken,
  connectBank: openBankingMocks.connectBank,
  connectPluggyItem: openBankingMocks.connectPluggyItem,
  disconnectBank: openBankingMocks.disconnectBank,
  fullSync: openBankingMocks.fullSync,
  formatLastSync: openBankingMocks.formatLastSync,
  mapPluggyConnectErrorMessage: openBankingMocks.mapPluggyConnectErrorMessage,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: openBankingMocks.logWarn,
}));

describe('OpenBanking page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openBankingMocks.reloadConnections.mockResolvedValue([]);
    openBankingMocks.getBankingHealth.mockResolvedValue({
      providerMode: 'pluggy',
      pluggyConfigured: true,
    });
    openBankingMocks.createPluggyConnectToken.mockResolvedValue('pluggy-token');
  });

  it('avisa quando falha ao criar o token do Pluggy Connect', async () => {
    openBankingMocks.createPluggyConnectToken.mockRejectedValueOnce(new Error('token failed'));

    render(
      <OpenBankingPage
        userId="user-1"
        transactions={[]}
        accounts={[]}
        onNewTransactions={vi.fn()}
        onUpdateAccount={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /conectar banco/i }));

    await waitFor(() => {
      expect(openBankingMocks.logWarn).toHaveBeenCalledWith(
        '[OpenBanking] Failed to create Pluggy Connect token',
        expect.objectContaining({
          fallback: 'open-banking-create-pluggy-token-failed',
        }),
      );
    });

    expect(await screen.findByText(/Token Pluggy indisponível/i)).toBeTruthy();
  });

  it('mostra falha visivel quando nao consegue carregar o status Pluggy', async () => {
    openBankingMocks.getBankingHealth.mockRejectedValueOnce(new Error('health failed'));

    render(
      <OpenBankingPage
        userId="user-1"
        transactions={[]}
        accounts={[]}
        onNewTransactions={vi.fn()}
        onUpdateAccount={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /conectar banco/i }));

    expect(await screen.findByText(/Não foi possível carregar o status do Open Banking/i)).toBeTruthy();
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(openBankingMocks.logWarn).toHaveBeenCalledWith(
      '[OpenBanking] Failed to load Pluggy status',
      expect.objectContaining({
        fallback: 'open-banking-load-pluggy-status-failed',
      }),
    );
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    await waitFor(() => {
      expect(openBankingMocks.getBankingHealth).toHaveBeenCalledTimes(2);
    });
  });

  it('mostra falha visivel quando nao consegue carregar conexoes bancarias', async () => {
    openBankingMocks.reloadConnections.mockRejectedValueOnce(new Error('reload failed'));
    openBankingMocks.getBankingHealth.mockResolvedValueOnce({
      providerMode: 'mock',
      pluggyConfigured: false,
    });

    render(
      <OpenBankingPage
        userId="user-1"
        transactions={[]}
        accounts={[]}
        onNewTransactions={vi.fn()}
        onUpdateAccount={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Não foi possível carregar as conexões bancárias/i)).toBeTruthy();
    expect(openBankingMocks.logWarn).toHaveBeenCalledWith(
      '[OpenBanking] Failed to load Pluggy connectors',
      expect.objectContaining({
        fallback: 'open-banking-load-pluggy-connectors-failed',
      }),
    );
    expect(screen.getByRole('button', { name: /recarregar conexões/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /conectar banco/i }));
    expect(screen.queryByText(/Não foi possível carregar as conexões bancárias/i)).toBeNull();
    expect((await screen.findAllByText(/provider para pluggy/i)).length).toBeGreaterThan(0);
  });

  it('mostra hint de recuperacao especifico quando o backend esta em modo mock', async () => {
    openBankingMocks.getBankingHealth.mockResolvedValueOnce({
      providerMode: 'mock',
      pluggyConfigured: false,
    });

    render(
      <OpenBankingPage
        userId="user-1"
        transactions={[]}
        accounts={[]}
        onNewTransactions={vi.fn()}
        onUpdateAccount={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /conectar banco/i }));

    expect(await screen.findByText(/Ambiente em modo simulado detectado/i)).toBeTruthy();
    expect(await screen.findByText(/volte o provider para pluggy/i)).toBeTruthy();
  });

  it('mostra falha visivel quando sync individual rejeita', async () => {
    openBankingMocks.reloadConnections.mockResolvedValue([connectedConnection]);
    openBankingMocks.fullSync.mockRejectedValueOnce(new Error('sync exploded'));

    render(
      <OpenBankingPage
        userId="user-1"
        transactions={[]}
        accounts={[]}
        onNewTransactions={vi.fn()}
        onUpdateAccount={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /sincronizar agora/i }));

    expect(await screen.findByText(/Não foi possível sincronizar este banco/i)).toBeTruthy();
    expect(openBankingMocks.logWarn).toHaveBeenCalledWith(
      '[OpenBanking] Sync failed',
      expect.objectContaining({
        fallback: 'open-banking-sync-failed',
      }),
    );
  });

  it('mostra hint de recuperacao quando conectar banco real falha', async () => {
    openBankingMocks.connectBank.mockRejectedValueOnce(new Error('connect exploded'));
    openBankingMocks.getBankingHealth.mockResolvedValueOnce({
      providerMode: 'pluggy',
      pluggyConfigured: true,
    });

    render(
      <OpenBankingPage
        userId="user-1"
        transactions={[]}
        accounts={[]}
        onNewTransactions={vi.fn()}
        onUpdateAccount={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /conectar banco/i }));
    fireEvent.click(await screen.findByRole('button', { name: /nubank/i }));

    expect(await screen.findByText(/Não foi possível conectar no banco real/i)).toBeTruthy();
    expect(await screen.findByText(/Confirme a sessão do usuário e o token do backend/i)).toBeTruthy();
    expect(openBankingMocks.logWarn).toHaveBeenCalledWith(
      '[OpenBanking] Connect failed',
      expect.objectContaining({
        fallback: 'open-banking-connect-failed',
      }),
    );
  });

  it('mostra falha visivel quando desconexao rejeita', async () => {
    openBankingMocks.reloadConnections.mockResolvedValue([connectedConnection]);
    openBankingMocks.disconnectBank.mockRejectedValueOnce(new Error('disconnect exploded'));

    render(
      <OpenBankingPage
        userId="user-1"
        transactions={[]}
        accounts={[]}
        onNewTransactions={vi.fn()}
        onUpdateAccount={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /desconectar nubank/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^desconectar$/i }));

    expect(await screen.findByText(/Não foi possível desconectar o banco/i)).toBeTruthy();
    expect(openBankingMocks.logWarn).toHaveBeenCalledWith(
      '[OpenBanking] Disconnect failed',
      expect.objectContaining({
        fallback: 'open-banking-disconnect-failed',
      }),
    );
  });

  it('mostra falha visivel quando sincronizar todos nao tem conexao apta', async () => {
    openBankingMocks.reloadConnections.mockResolvedValue([errorConnection]);

    render(
      <OpenBankingPage
        userId="user-1"
        transactions={[]}
        accounts={[]}
        onNewTransactions={vi.fn()}
        onUpdateAccount={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /sincronizar todos os bancos/i }));

    expect(await screen.findByText(/Nenhuma conexão apta para sincronizar/i)).toBeTruthy();
    expect(openBankingMocks.fullSync).not.toHaveBeenCalled();
  });
});
