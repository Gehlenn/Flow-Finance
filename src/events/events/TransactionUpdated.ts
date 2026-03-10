export const TRANSACTION_UPDATED = 'transaction_updated';

export interface TransactionUpdatedEvent {
  userId: string;
  transactionId: string;
  accountId?: string;
  amount: number;
  category: string;
  date: string;
}
