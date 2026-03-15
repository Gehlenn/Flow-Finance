import { AppError } from '../errors/AppError';
import type { Transaction } from '../domain/entities';

export function validateTransactionInput(
  transactionData: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): void {
  if (!transactionData) {
    throw new AppError('Transaction payload is required', 400);
  }

  if (typeof transactionData.amount !== 'number' || !Number.isFinite(transactionData.amount) || transactionData.amount <= 0) {
    throw new AppError('Transaction amount must be a positive number', 400, { field: 'amount' });
  }

  if (!transactionData.description || transactionData.description.trim().length < 2) {
    throw new AppError('Transaction description is required', 400, { field: 'description' });
  }

  const validTypes = ['income', 'expense', 'Receita', 'Despesa'];
  if (!validTypes.includes(transactionData.type as string)) {
    throw new AppError('Transaction type must be income, expense, Receita or Despesa', 400, { field: 'type' });
  }

  if (!(transactionData.date instanceof Date) || Number.isNaN(transactionData.date.getTime())) {
    throw new AppError('Transaction date is invalid', 400, { field: 'date' });
  }

  if (!transactionData.accountId || transactionData.accountId.trim().length === 0) {
    throw new AppError('Transaction accountId is required', 400, { field: 'accountId' });
  }
}
