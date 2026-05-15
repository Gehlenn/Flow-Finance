import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CashFlow from '../../components/CashFlow';
import { Category, TransactionType } from '../../types';

const cashFlowClipboardMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: cashFlowClipboardMocks.logWarn,
}));

describe('CashFlow clipboard diagnostic', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('clipboard blocked')),
      },
    });
  });

  it('mostra diagnostico visivel quando a copia do resumo falha', async () => {
    render(
      <CashFlow
        activeWorkspaceId="workspace-1"
        activeWorkspaceName="Clinica Flow"
        transactions={[
          {
            id: '1',
            amount: 500,
            type: TransactionType.RECEITA,
            category: Category.CONSULTORIO,
            description: 'Receita confirmada',
            date: '2026-04-10T10:00:00.000Z',
          },
        ]}
        hideValues={false}
        theme="light"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir compartilhamento do fluxo/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copiar resumo do fluxo/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /copiar resumo do fluxo/i }));

    expect(await screen.findByText(/Falha ao copiar resumo/i)).toBeTruthy();
    expect(screen.getByText(/O navegador bloqueou a copia do texto do fluxo/i)).toBeTruthy();
    expect(screen.getByText(/Pr.*ximo passo:/i)).toBeTruthy();
    expect(cashFlowClipboardMocks.logWarn).toHaveBeenCalledWith(
      '[CashFlow] Failed to copy summary',
      expect.objectContaining({
        fallback: 'cashflow-copy-summary-failed',
      }),
    );
  });
});

