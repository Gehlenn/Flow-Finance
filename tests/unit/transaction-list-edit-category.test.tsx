import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import TransactionList from '../../components/TransactionList';
import { Category, Transaction, TransactionType } from '../../types';

describe('TransactionList - Edição de Categoria', () => {
  const baseTx: Transaction = {
    id: '1',
    amount: 100,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Restaurante',
    date: '2024-03-18',
    merchant: 'McDonalds',
  };

  it('permite editar a categoria de uma transação', async () => {
    const onUpdate = vi.fn();
    const { getByText, queryByText } = render(
      <TransactionList
        userId="user-1"
        transactions={[baseTx]}
        hideValues={false}
        onDelete={() => {}}
        onDeleteMultiple={() => {}}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(getByText('Restaurante'));
    fireEvent.click(getByText('Editar'));
    fireEvent.click(getByText(Category.CONSULTORIO));
    fireEvent.click(getByText('Salvar'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ category: Category.CONSULTORIO })
    ));
    expect(queryByText('Categoria atualizada e IA treinada!')).toBeTruthy();
  });

  it('permite desfazer alteração de categoria no modal', async () => {
    const onUpdate = vi.fn();
    const { getByText, getByRole } = render(
      <TransactionList
        userId="user-1"
        transactions={[baseTx]}
        hideValues={false}
        onDelete={() => {}}
        onDeleteMultiple={() => {}}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(getByText('Restaurante'));
    fireEvent.click(getByText('Editar'));
    fireEvent.click(getByText(Category.CONSULTORIO));

    const desfazerBtn = await waitFor(() => getByRole('button', { name: /desfazer/i }));
    expect(desfazerBtn).toBeTruthy();

    fireEvent.click(desfazerBtn);

    await waitFor(() => {
      const originalBtn = getByRole('button', { name: `Selecionar categoria ${Category.PESSOAL}` });
      expect(
        originalBtn.classList.contains('bg-indigo-600') ||
        originalBtn.classList.contains('text-white')
      ).toBe(true);
    });

    await waitFor(() => {
      expect(getByRole('button', { name: /salvar/i })).toHaveProperty('disabled', true);
    });
  });
});
