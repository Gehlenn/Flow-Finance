import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveMerchantCategoryLearningMock = vi.hoisted(() => vi.fn());
const transactionListLoggerMock = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/engines/finance/categorization/aiCategorizerFallback', () => ({
  saveMerchantCategoryLearning: saveMerchantCategoryLearningMock,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: transactionListLoggerMock.logWarn,
}));

import TransactionList from '../../components/TransactionList';
import { Category, Transaction, TransactionType } from '../../types';

describe('TransactionList - aprendizado auxiliar', () => {
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
    saveMerchantCategoryLearningMock.mockReset().mockResolvedValue(undefined);
    transactionListLoggerMock.logWarn.mockReset();
  });

  it('mostra diagnostico visivel quando o aprendizado auxiliar falha', async () => {
    saveMerchantCategoryLearningMock.mockRejectedValueOnce(new Error('learning down'));

    const onUpdate = vi.fn();
    render(
      <TransactionList
        userId="user-1"
        transactions={[baseTx]}
        hideValues={false}
        onDelete={() => {}}
        onDeleteMultiple={() => {}}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText('Restaurante'));
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.click(screen.getByText(Category.CONSULTORIO));
    fireEvent.click(screen.getByText('Salvar'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ category: Category.CONSULTORIO }),
    ));

    const diagnostic = screen.getByText(/Categoria salva localmente/i).closest('[role="status"]');
    expect(diagnostic).toBeTruthy();
    expect(within(diagnostic as HTMLElement).getByText(/aprendizado da IA nao foi salvo agora/i)).toBeTruthy();
    expect(transactionListLoggerMock.logWarn).toHaveBeenCalledWith(
      '[TransactionList] Failed to learn category',
      expect.objectContaining({
        fallback: 'transaction-list-learn-category-failed',
      }),
    );
  });
});
