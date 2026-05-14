import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ReceiptScannerPage from '../../pages/ReceiptScanner';

const scanReceiptMock = vi.fn();

vi.mock('../../src/ai/receiptScanner', () => ({
  scanReceipt: (...args: unknown[]) => scanReceiptMock(...args),
}));

describe('ReceiptScanner draft path', () => {
  it('registra transacao a partir de TransactionDraft no confirmar', async () => {
    scanReceiptMock.mockResolvedValue({
      success: true,
      data: {
        amount: 89.9,
        merchant: 'Padaria Central',
        date: '2026-04-10T10:00:00.000Z',
        description: 'Padaria Central',
        category: 'Pessoal',
        type: 'Despesa',
        payment_method: 'pix',
        confidence: 0.86,
      },
    });

    const onAddTransaction = vi.fn();
    const { container } = render(
      <ReceiptScannerPage hideValues={false} onAddTransaction={onAddTransaction} />,
    );

    expect(screen.getByText(/Ler para o caixa/i)).toBeTruthy();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'recibo.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Extrair dados para o caixa/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(onAddTransaction).toHaveBeenCalledTimes(1);
    });

    const payload = onAddTransaction.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      source: 'ai_image',
      amount: 89.9,
      type: 'Despesa',
      category: 'Pessoal',
      payment_method: 'pix',
    });
  });

  it('mostra diagnostico visivel quando a extracao falha', async () => {
    scanReceiptMock.mockResolvedValue({
      success: false,
      data: null,
      error: 'Falha na extração',
    });

    const { container } = render(
      <ReceiptScannerPage hideValues={false} onAddTransaction={vi.fn()} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'recibo.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Extrair dados para o caixa/i }));

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/O scanner nao conseguiu extrair os campos principais do recibo/i)).toBeTruthy();
    expect(screen.getByText(/Proximo passo:/i)).toBeTruthy();
  });
});
