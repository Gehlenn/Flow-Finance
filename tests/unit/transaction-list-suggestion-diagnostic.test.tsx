import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const detectMerchantCategoryMock = vi.hoisted(() => vi.fn());
const transactionListLoggerMock = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/ai/categoryLearning', () => ({
  detectMerchantCategory: detectMerchantCategoryMock,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: transactionListLoggerMock.logWarn,
}));

import TransactionList from '../../components/TransactionList';
import { Category, Transaction, TransactionType } from '../../types';

describe('TransactionList suggestion diagnostic', () => {
  const baseTx: Transaction = {
    id: '1',
    amount: 100,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Restaurante',
    date: '2024-03-18',
    merchant: 'McDonalds',
  };

  beforeEach(() => {
    detectMerchantCategoryMock.mockReset();
    detectMerchantCategoryMock.mockRejectedValue(new Error('suggestion offline'));
    transactionListLoggerMock.logWarn.mockReset();
  });

  it('mostra diagnostico visivel quando a sugestao de categoria falha', async () => {
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

    fireEvent.click(screen.getByText('Restaurante'));
    fireEvent.click(screen.getByText('Editar'));

    const diagnostic = await screen.findByRole('status');
    expect(diagnostic).toBeTruthy();
    expect(screen.getByText(/Sugestao de categoria indisponivel/i)).toBeTruthy();
    expect(screen.getByText(/Nao foi possivel sugerir uma categoria agora/i)).toBeTruthy();
    expect(screen.getByText(/Escolha a categoria manualmente/i)).toBeTruthy();
    expect(transactionListLoggerMock.logWarn).toHaveBeenCalledWith(
      '[TransactionList] Failed to suggest category',
      expect.objectContaining({
        fallback: 'transaction-list-suggest-category-failed',
      }),
    );
  });
});
