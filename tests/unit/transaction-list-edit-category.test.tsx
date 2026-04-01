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
        transactions={[baseTx]}
        hideValues={false}
        onDelete={() => {}}
        onDeleteMultiple={() => {}}
        onUpdate={onUpdate}
      />
    );

    // Abrir modal de detalhes
    fireEvent.click(getByText('Restaurante'));
    // Clicar em Editar
    fireEvent.click(getByText('Editar'));
    // Selecionar nova categoria
    fireEvent.click(getByText(Category.CONSULTORIO));
    // Salvar
    fireEvent.click(getByText('Salvar'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ category: Category.CONSULTORIO })
    ));
    // Feedback visual
    expect(queryByText('Categoria atualizada e IA treinada!')).toBeTruthy();
  });
  it('permite desfazer alteração de categoria no modal', async () => {
    const onUpdate = vi.fn();
    const { getByText, getByRole, queryByText } = render(
      <TransactionList
        transactions={[baseTx]}
        hideValues={false}
        onDelete={() => {}}
        onDeleteMultiple={() => {}}
        onUpdate={onUpdate}
      />
    );

    // Abrir modal de detalhes
    fireEvent.click(getByText('Restaurante'));
    // Clicar em Editar
    fireEvent.click(getByText('Editar'));
    // Selecionar nova categoria
    fireEvent.click(getByText(Category.CONSULTORIO));

    // Botão Desfazer deve aparecer
    const desfazerBtn = await waitFor(() => getByRole('button', { name: /desfazer/i }));
    expect(desfazerBtn).toBeTruthy();

    // Clicar em Desfazer
    fireEvent.click(desfazerBtn);

    // Categoria volta ao valor original (classe de selecionado)
    await waitFor(() => {
      const originalBtn = getByRole('button', { name: `Selecionar categoria ${Category.PESSOAL}` });
      // Aceita tanto bg-indigo-600 quanto text-white, pois depende do tema
      expect(
        originalBtn.classList.contains('bg-indigo-600') ||
        originalBtn.classList.contains('text-white')
      ).toBe(true);
    });
    // Salvar deve estar desabilitado pois não houve alteração
    await waitFor(() => {
      expect(getByRole('button', { name: /salvar/i })).to.have.property('disabled', true);
    });
  });
});
