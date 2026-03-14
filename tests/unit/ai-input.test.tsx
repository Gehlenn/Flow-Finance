import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AIInput from '../../components/AIInput';

const interpretTextMock = vi.fn();
const interpretImageMock = vi.fn();

vi.mock('../../src/ai/aiInterpreter', () => ({
  interpretText: (...args: unknown[]) => interpretTextMock(...args),
  interpretImage: (...args: unknown[]) => interpretImageMock(...args),
}));

describe('AIInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nao confirma quando a IA retorna intent de transacao com payload vazio', async () => {
    interpretTextMock.mockResolvedValue({
      intent: 'transaction',
      data: [],
      confidence: 0.1,
    });

    const onAddTransactions = vi.fn();
    const onAddReminders = vi.fn();
    const onClose = vi.fn();

    render(
      <AIInput
        onClose={onClose}
        onAddTransactions={onAddTransactions}
        onAddReminders={onAddReminders}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Diga ou escreva o que aconteceu...'), {
      target: { value: 'crie 20 transações aleatórias de cada tipo e categoria' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Inteligente/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Não consegui entender');
    });

    expect(onAddTransactions).not.toHaveBeenCalled();
    expect(onAddReminders).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirma quando a IA retorna transacoes validas', async () => {
    interpretTextMock.mockResolvedValue({
      intent: 'transaction',
      data: [
        {
          amount: 50,
          description: 'Teste',
          category: 'Pessoal',
          type: 'Despesa',
        },
      ],
      confidence: 0.9,
    });

    const onAddTransactions = vi.fn();
    const onClose = vi.fn();

    render(
      <AIInput
        onClose={onClose}
        onAddTransactions={onAddTransactions}
        onAddReminders={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Diga ou escreva o que aconteceu...'), {
      target: { value: 'gastei 50 no mercado' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Inteligente/i }));

    await waitFor(() => {
      expect(onAddTransactions).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirmado!/i })).toBeTruthy();
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});