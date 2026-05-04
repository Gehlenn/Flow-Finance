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
  mapPluggyConnectErrorMessage: vi.fn((error: unknown) => (
    error instanceof Error ? error.message : 'Erro no Pluggy'
  )),
}));

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

describe('OpenBanking page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openBankingMocks.getBankingHealth.mockResolvedValue({
      providerMode: 'pluggy',
      pluggyConfigured: true,
    });
    openBankingMocks.createPluggyConnectToken.mockResolvedValue('pluggy-token');
  });

  it('avisa quando falha ao criar o token do Pluggy Connect', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
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
      expect(warnSpy).toHaveBeenCalledWith(
        '[OpenBanking] Failed to create Pluggy Connect token:',
        expect.any(Error),
      );
    });

    warnSpy.mockRestore();
  });
});
