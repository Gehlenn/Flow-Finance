import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ImportTransactionsPage from '../../pages/ImportTransactions';
import { FinancialEventEmitter } from '../../src/events/eventEngine';

const runImportPipelineMock = vi.fn();
const saveMerchantCategoryLearningMock = vi.fn();
const productAnalyticsMocks = vi.hoisted(() => ({
  trackProductEventMock: vi.fn(),
}));
const importTransactionsLoggerMock = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

vi.mock('../../src/finance/importService', () => ({
  runImportPipeline: (...args: unknown[]) => runImportPipelineMock(...args),
  toTransactions: (items: unknown[]) => items,
}));

vi.mock('../../src/engines/finance/categorization/aiCategorizerFallback', () => ({
  saveMerchantCategoryLearning: (...args: unknown[]) => saveMerchantCategoryLearningMock(...args),
}));

vi.mock('../../src/app/productAnalytics', () => ({
  trackProductEvent: productAnalyticsMocks.trackProductEventMock,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: importTransactionsLoggerMock.logWarn,
}));

describe('ImportTransactions session state', () => {
  beforeEach(() => {
    runImportPipelineMock.mockReset();
    saveMerchantCategoryLearningMock.mockReset();
    productAnalyticsMocks.trackProductEventMock.mockReset();
    importTransactionsLoggerMock.logWarn.mockReset();
    runImportPipelineMock.mockResolvedValue({
      format: 'csv',
      filename: 'extrato.csv',
      total_found: 2,
      transactions: [
        {
          raw_date: '2026-04-01T10:00:00.000Z',
          raw_amount: 100,
          raw_description: 'Compra A',
          merchant: 'Mercado A',
          category: 'Pessoal',
          type: 'Despesa',
          selected: true,
        },
        {
          raw_date: '2026-04-02T10:00:00.000Z',
          raw_amount: 50,
          raw_description: 'Compra B',
          merchant: 'Mercado B',
          category: 'Negócio',
          type: 'Receita',
          selected: true,
          duplicate: true,
        },
      ],
      errors: [],
      parse_time_ms: 12,
    });
  });

  it('renders the first import idle state with review-before-save copy', () => {
    render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={vi.fn()}
      />,
    );

    expect(screen.getByTestId('import-idle-state')).toBeTruthy();
    expect(screen.getByText(/Envie um arquivo para revisar entradas e saidas/i)).toBeTruthy();
    expect(screen.getByText(/Voce revisa antes de confirmar no caixa/i)).toBeTruthy();
  });

  it('resets duplicate filter between import sessions', async () => {
    const onAddTransactions = vi.fn();
    const { container } = render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={onAddTransactions}
      />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const fileA = new File(['csv'], 'extrato-a.csv', { type: 'text/csv' });
    const fileB = new File(['csv'], 'extrato-b.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [fileA] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ocultar duplicatas/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /ocultar duplicatas/i }));
    expect(screen.getByRole('button', { name: /ver todas/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /importar outro arquivo/i }));

    const resetInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(resetInput, { target: { files: [fileB] } });

    await waitFor(() => {
      expect(runImportPipelineMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ocultar duplicatas/i })).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: /ver todas/i })).toBeNull();
  });

  it('clears the file input after selection so the same file can be chosen again', async () => {
    const { container } = render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['csv'], 'extrato.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('keeps row expansion attached to the same transaction when duplicates are filtered', async () => {
    const { container } = render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['csv'], 'extrato.csv', { type: 'text/csv' });

    runImportPipelineMock.mockResolvedValueOnce({
      format: 'csv',
      filename: 'extrato.csv',
      total_found: 3,
      transactions: [
        {
          raw_date: '2026-04-01T10:00:00.000Z',
          raw_amount: 100,
          raw_description: 'Compra A',
          merchant: 'Mercado A',
          category: 'Pessoal',
          type: 'Despesa',
          selected: true,
        },
        {
          raw_date: '2026-04-02T10:00:00.000Z',
          raw_amount: 50,
          raw_description: 'Compra B',
          merchant: 'Mercado B',
          category: 'Negócio',
          type: 'Receita',
          selected: true,
          duplicate: true,
        },
        {
          raw_date: '2026-04-03T10:00:00.000Z',
          raw_amount: 75,
          raw_description: 'Compra C',
          merchant: 'Mercado C',
          category: 'Pessoal',
          type: 'Despesa',
          selected: true,
        },
      ],
      errors: [],
      parse_time_ms: 12,
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ocultar duplicatas/i })).toBeTruthy();
    });

    const rowB = screen.getByRole('button', { name: /expandir transa\u00e7\u00e3o mercado b/i }).closest('div.border-b');
    expect(rowB).toBeTruthy();
    if (!rowB) {
      throw new Error('Row B not found');
    }
    fireEvent.click(within(rowB).getByRole('button', { name: /expandir transa/i }));
    expect(within(rowB).getByText(/Categoria/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /ocultar duplicatas/i }));

    const rowC = screen.getByRole('button', { name: /expandir transa\u00e7\u00e3o mercado c/i }).closest('div.border-b');
    expect(rowC).toBeTruthy();
    if (!rowC) {
      throw new Error('Row C not found');
    }
    expect(within(rowC).queryByText(/Categoria/i)).toBeNull();
  });

  it('imports only selected non-duplicate transactions on confirm', async () => {
    const onAddTransactions = vi.fn();
    const { container } = render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={onAddTransactions}
      />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['csv'], 'extrato.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ocultar duplicatas/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /importar .* movimento/i }));

    await waitFor(() => {
      expect(onAddTransactions).toHaveBeenCalledTimes(1);
    });

    const payload = onAddTransactions.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      merchant: 'Mercado A',
      category: 'Pessoal',
      type: 'Despesa',
    });
    expect(productAnalyticsMocks.trackProductEventMock).toHaveBeenCalledWith(
      'transaction_imported',
      expect.objectContaining({
        source: 'import_transactions',
        format: 'csv',
        imported_count: 1,
        selected_count: 1,
        duplicate_count: 1,
        error_count: 0,
      }),
    );
  });

  it('continues import when merchant learning persistence fails', async () => {
    const onAddTransactions = vi.fn();
    saveMerchantCategoryLearningMock.mockRejectedValueOnce(new Error('learning down'));

    const { container } = render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={onAddTransactions}
      />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['csv'], 'extrato.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ocultar duplicatas/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /importar .* movimento/i }));

    await waitFor(() => {
      expect(onAddTransactions).toHaveBeenCalledTimes(1);
    });

    expect(importTransactionsLoggerMock.logWarn).toHaveBeenCalledWith(
      '[ImportTransactions] Failed to save merchant learning',
      expect.objectContaining({
        fallback: 'import-transactions-save-merchant-learning-failed',
        merchant: 'Mercado A',
        category: 'Pessoal',
      }),
    );
  });

  it('renders a safe date label when imported data contains an invalid date', async () => {
    runImportPipelineMock.mockResolvedValueOnce({
      format: 'csv',
      filename: 'extrato.csv',
      total_found: 1,
      transactions: [
        {
          raw_date: 'not-a-date',
          raw_amount: 100,
          raw_description: 'Compra A',
          merchant: 'Mercado A',
          category: 'Pessoal',
          type: 'Despesa',
          selected: true,
        },
      ],
      errors: [],
      parse_time_ms: 12,
    });

    const { container } = render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['csv'], 'extrato-invalid.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Data inv/i)).toBeTruthy();
    });
  });

  it('mostra diagnostico visivel quando a importacao falha sem transacoes', async () => {
    runImportPipelineMock.mockResolvedValueOnce({
      format: 'csv',
      filename: 'extrato-quebrado.csv',
      total_found: 0,
      transactions: [],
      errors: ['Cabecalho CSV nao reconhecido'],
      parse_time_ms: 8,
    });

    const { container } = render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['csv'], 'extrato-quebrado.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/Nenhuma transacao foi identificada/i)).toBeTruthy();
    expect(screen.getByText(/Pr.*ximo passo:/i)).toBeTruthy();
  });

  it('ignora uma importacao atrasada depois que a tela desmonta', async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof runImportPipelineMock>>>();
    runImportPipelineMock.mockImplementation(() => deferred.promise);

    const { container, unmount } = render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['csv'], 'extrato-a.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(runImportPipelineMock).toHaveBeenCalledTimes(1);
    });

    unmount();

    deferred.resolve({
      format: 'csv',
      filename: 'extrato-a.csv',
      total_found: 1,
      transactions: [
        {
          raw_date: '2026-04-01T10:00:00.000Z',
          raw_amount: 10,
          raw_description: 'A',
          merchant: 'Mercado A',
          category: 'Pessoal',
          type: 'Despesa',
          selected: true,
        },
      ],
      errors: [],
      parse_time_ms: 10,
    });

    await Promise.resolve();
  });

  it('cancela a confirmacao quando o usuario reseta a sessao no meio do import', async () => {
    const learningDeferred = createDeferred<void>();
    saveMerchantCategoryLearningMock.mockImplementation(() => learningDeferred.promise);
    const onAddTransactions = vi.fn();
    const eventSpy = vi.spyOn(FinancialEventEmitter, 'transactionsImported');

    const { container, unmount } = render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={onAddTransactions}
      />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['csv'], 'extrato-a.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ocultar duplicatas/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /importar .* movimento/i }));
    await waitFor(() => {
      expect(saveMerchantCategoryLearningMock).toHaveBeenCalled();
    });

    unmount();
    learningDeferred.resolve();

    await Promise.resolve();

    expect(onAddTransactions).not.toHaveBeenCalled();
    expect(eventSpy).not.toHaveBeenCalled();
    eventSpy.mockRestore();
  });

  it('mostra diagnostico visivel quando o aprendizado auxiliar falha durante a importacao', async () => {
    saveMerchantCategoryLearningMock.mockRejectedValueOnce(new Error('learning down'));

    render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={vi.fn()}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['csv'], 'extrato-a.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importar .* movimento/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /importar .* movimento/i }));

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/aprendizado pendente/i)).toBeTruthy();
    expect(screen.getByText(/nao foi salvo para todos os itens/i)).toBeTruthy();
  });

  it('mantem a importacao concluida e observa falha na emissao do evento auxiliar', async () => {
    const emissionError = new Error('event pipeline down');
    const eventSpy = vi
      .spyOn(FinancialEventEmitter, 'transactionsImported')
      .mockImplementationOnce(() => {
        throw emissionError;
      });

    render(
      <ImportTransactionsPage
        transactions={[]}
        userId="user-1"
        hideValues={false}
        onAddTransactions={vi.fn()}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['csv'], 'extrato.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importar .* movimento/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /importar .* movimento/i }));

    expect(await screen.findByText('Importação concluída!')).toBeTruthy();
    expect(importTransactionsLoggerMock.logWarn).toHaveBeenCalledWith(
      '[ImportTransactions] Failed to emit transactions imported event',
      expect.objectContaining({
        error: emissionError,
        transactionCount: 1,
        format: 'csv',
        fallback: 'import-transactions-event-emission-failed',
      }),
    );

    eventSpy.mockRestore();
  });
});



