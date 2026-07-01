import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TransactionList, { classifyTransactionFinancialState } from '../../components/TransactionList';
import { Category, TransactionType, type Transaction } from '../../types';

type TransactionWithState = Transaction & {
  status?: 'pending' | 'confirmed' | 'overdue';
};

describe('transaction financial states', () => {
  const now = new Date('2026-04-10T12:00:00.000Z');

  beforeEach(() => {
    localStorage.clear();
  });

  const makeTransaction = (overrides: Partial<TransactionWithState> = {}): TransactionWithState => ({
    id: 'tx-1',
    amount: 120,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Conta recorrente',
    date: '2026-04-10T10:00:00.000Z',
    ...overrides,
  });

  it('classifies explicit metadata status before fallback heuristics', () => {
    const transaction = makeTransaction({ status: 'pending' });

    expect(classifyTransactionFinancialState(transaction, now)).toBe('pending');
  });

  it('classifies generated past entries as overdue', () => {
    const transaction = makeTransaction({ generated: true, date: '2026-04-02T10:00:00.000Z' });

    expect(classifyTransactionFinancialState(transaction, now)).toBe('overdue');
  });

  it('classifies future entries as pending and current entries as confirmed', () => {
    const pendingTransaction = makeTransaction({ date: '2026-04-12T10:00:00.000Z' });
    const confirmedTransaction = makeTransaction({ date: '2026-04-10T10:00:00.000Z' });

    expect(classifyTransactionFinancialState(pendingTransaction, now)).toBe('pending');
    expect(classifyTransactionFinancialState(confirmedTransaction, now)).toBe('confirmed');
  });

  it('renders status chips for quick scanning', () => {
    render(
      <TransactionList
        transactions={[
          makeTransaction({ id: 'confirmed-1', description: 'Pagamento fornecedor' }),
          makeTransaction({
            id: 'pending-1',
            description: 'Recebimento agendado',
            type: TransactionType.RECEITA,
            date: '2099-01-01T10:00:00.000Z',
          }),
          makeTransaction({
            id: 'overdue-1',
            description: 'Recorrencia atrasada',
            generated: true,
            date: '2020-01-01T10:00:00.000Z',
          }),
        ]}
        hideValues={false}
        onDelete={vi.fn()}
        onDeleteMultiple={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText(/confirmado 1/i)).toBeTruthy();
    expect(screen.getByText(/pendente 1/i)).toBeTruthy();
    expect(screen.getByText(/vencido 1/i)).toBeTruthy();
  });

  it('filters the list by financial state for faster review', () => {
    render(
      <TransactionList
        transactions={[
          makeTransaction({ id: 'confirmed-1', description: 'Pagamento fornecedor' }),
          makeTransaction({
            id: 'pending-1',
            description: 'Recebimento agendado',
            type: TransactionType.RECEITA,
            date: '2099-01-01T10:00:00.000Z',
          }),
          makeTransaction({
            id: 'overdue-1',
            description: 'Recorrencia atrasada',
            generated: true,
            date: '2020-01-01T10:00:00.000Z',
          }),
        ]}
        hideValues={false}
        onDelete={vi.fn()}
        onDeleteMultiple={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText(/abrir filtros da lista/i));
    fireEvent.click(screen.getByRole('button', { name: /^Pendente$/i }));

    expect(screen.getByRole('button', { name: /^Pendente$/i }).className).toContain('bg-indigo-600');
    expect(screen.getByText(/Recebimento agendado/i)).toBeTruthy();
  });

  it('orienta o primeiro lancamento quando a lista ainda esta vazia', () => {
    render(
      <TransactionList
        transactions={[]}
        hideValues={false}
        onDelete={vi.fn()}
        onDeleteMultiple={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText(/Nenhum lançamento ainda/i)).toBeTruthy();
    expect(screen.getByText(/adicionar lançamentos ou importar extratos/i)).toBeTruthy();
    expect(screen.getByText(/botão \+ no Dashboard/i)).toBeTruthy();
    expect(screen.getByText('Dashboard', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('+', { selector: 'span' })).toBeTruthy();
  });

  it('diferencia ausência por filtro quando há transações carregadas', () => {
    render(
      <TransactionList
        transactions={[makeTransaction({ id: 'confirmed-1', description: 'Pagamento fornecedor' })]}
        hideValues={false}
        onDelete={vi.fn()}
        onDeleteMultiple={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'inexistente' } });

    expect(screen.getByText(/Nenhum lançamento encontrado/i)).toBeTruthy();
    expect(screen.getByText(/Este recorte ficou vazio/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Limpar filtros/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Limpar filtros/i }));

    expect(screen.getByText(/Pagamento fornecedor/i)).toBeTruthy();
  });
});
