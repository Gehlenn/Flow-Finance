export const TRANSACTION_CREATED = 'transaction.created';

export interface TransactionCreatedEvent {
  transactionId: string;
  accountId?: string;
  amount: number;
  category: string;
  date: string;
}
