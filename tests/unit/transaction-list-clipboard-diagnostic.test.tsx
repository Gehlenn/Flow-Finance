import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionList from '../../components/TransactionList';
import { Category, Transaction, TransactionType } from '../../types';

const transactionListLoggerMock = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: transactionListLoggerMock.logWarn,
}));

describe('TransactionList clipboard diagnostic', () => {
  const baseTx: Transaction = {
    id: '1',
    amount: 100,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Restaurante',
    date: '2024-03-18',
  };

  beforeEach(() => {
    transactionListLoggerMock.logWarn.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('clipboard blocked')),
      },
    });
  });

  it('mostra diagnostico visivel quando a copia do historico falha', async () => {
    render(
      <TransactionList
        userId="user-1"
        transactions={[baseTx]}
        hideValues={false}
        onDelete={() => {}}
        onDeleteMultiple={() => {}}
        onUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Abrir compartilhamento do historico/i }));

    await waitFor(() => {
      expect(screen.getByText('Compartilhar Agora')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Compartilhar Agora'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copiar texto do historico/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Copiar texto do historico/i }));

    expect(await screen.findByText(/Falha ao copiar resumo/i)).toBeTruthy();
    expect(screen.getByText(/O navegador bloqueou a copia do texto do historico/i)).toBeTruthy();
    expect(screen.getByText(/Proximo passo:/i)).toBeTruthy();
    expect(transactionListLoggerMock.logWarn).toHaveBeenCalledWith(
      '[TransactionList] Failed to copy summary',
      expect.objectContaining({
        fallback: 'transaction-list-copy-summary-failed',
      }),
    );
  });
});
