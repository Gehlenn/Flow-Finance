import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AIInput from '../../components/AIInput';

const interpretTextMock = vi.fn();
const interpretImageMock = vi.fn();
const logWarnMock = vi.fn();

vi.mock('../../src/ai/aiInterpreter', () => ({
  interpretText: (...args: unknown[]) => interpretTextMock(...args),
  interpretImage: (...args: unknown[]) => interpretImageMock(...args),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => logWarnMock(...args),
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

  it('mostra diagnostico visivel quando a interpretacao retorna unknown', async () => {
    interpretTextMock.mockResolvedValue({
      intent: 'unknown',
      data: [],
      confidence: 0.1,
      diagnostic: {
        kind: 'ai_uncertain',
        message: 'Nao consegui entender com seguranca o que voce quis registrar.',
        suggestion: 'Use o modo manual ou descreva valor, data e tipo de forma mais direta.',
      },
    });

    render(
      <AIInput
        onClose={vi.fn()}
        onAddTransactions={vi.fn()}
        onAddReminders={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Diga ou escreva o que aconteceu...'), {
      target: { value: 'algo muito vago' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Inteligente/i }));

    await waitFor(() => {
      expect(screen.getByText(/Diagnóstico de entrada/i)).toBeTruthy();
    });
    expect(screen.getByText(/Nao consegui entender com seguranca o que voce quis registrar/i)).toBeTruthy();
    expect(screen.getByText(/Use o modo manual ou descreva valor, data e tipo de forma mais direta/i)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Nao consegui entender');
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

  it('em modo single-draft usa conscientemente apenas a primeira transacao quando IA retorna varias e exige revisão', async () => {
    interpretTextMock.mockResolvedValue({
      intent: 'transaction',
      data: [
        {
          amount: 120,
          description: 'Primeira',
          category: 'Pessoal',
          type: 'Despesa',
        },
        {
          amount: 300,
          description: 'Segunda',
          category: 'Negócio',
          type: 'Receita',
        },
      ],
      confidence: 0.95,
    });

    const onAddTransactions = vi.fn();

    render(
      <AIInput
        onClose={vi.fn()}
        onAddTransactions={onAddTransactions}
        onAddReminders={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Diga ou escreva o que aconteceu...'), {
      target: { value: 'gastei 120 no mercado e recebi 300 de cliente' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Inteligente/i }));

    await waitFor(() => {
      expect(screen.getByText(/A IA detectou múltiplas transações/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Confirmar e Salvar/i })).toBeTruthy();
    });

    expect(onAddTransactions).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Confirmar e Salvar/i }));

    await waitFor(() => {
      expect(onAddTransactions).toHaveBeenCalledTimes(1);
    });

    const payload = onAddTransactions.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0].description).toBe('Primeira');

    expect(payload[0].amount).toBe(120);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[AIInput] Multiple transactions returned; using the first draft only',
      expect.objectContaining({
        origin: 'text',
        count: 2,
        fallback: 'ai-input-single-draft-multiple-transactions',
      }),
    );
  });

  it('mostra diagnostico visivel quando a leitura da imagem falha', async () => {
    interpretImageMock.mockRejectedValueOnce(new Error('image failed'));

    const { container } = render(
      <AIInput
        onClose={vi.fn()}
        onAddTransactions={vi.fn()}
        onAddReminders={vi.fn()}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    const file = new File(['fake'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/A IA nao conseguiu ler a imagem enviada agora/i)).toBeTruthy();
    expect(screen.getAllByText(/foto mais/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('alert').textContent).toContain('Erro ao ler imagem');
    expect(logWarnMock).toHaveBeenCalledWith(
      '[AIInput] Failed to process AI input',
      expect.objectContaining({
        fallback: 'ai-input-processing-failed',
      }),
    );
  });
});

