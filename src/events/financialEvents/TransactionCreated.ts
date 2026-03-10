import { Transaction } from '../../domain/entities';

export const TRANSACTION_CREATED_EVENT = 'transaction_created';

export interface TransactionCreatedEvent {
  userId: string;
  transactionId: string;
  amount: number;
  category: string;
  transaction: Transaction;
}
