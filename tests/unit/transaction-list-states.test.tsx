import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TransactionList, { classifyTransactionFinancialState } from '../../components/TransactionList';
import { Category, TransactionType, type Transaction } from '../../types';

describe('transaction financial states', () => {
  const now = new Date('2026-04-10T12:00:00.000Z');

  const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'tx-1',
    amount: 120,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Conta recorrente',
    date: '2026-04-10T10:00:00.000Z',
    ...overrides,
  });

  it('classifies explicit metadata status before fallback heuristics', () => {
    const transaction = makeTransaction({ status: 'pending' } as any);

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
          makeTransaction({ id: 'pending-1', description: 'Recebimento agendado', type: TransactionType.RECEITA, date: '2099-01-01T10:00:00.000Z' }),
          makeTransaction({ id: 'overdue-1', description: 'Recorrencia atrasada', generated: true, date: '2020-01-01T10:00:00.000Z' }),
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
});
