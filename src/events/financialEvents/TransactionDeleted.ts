export const TRANSACTION_DELETED_EVENT = 'transaction_deleted';

export interface TransactionDeletedEvent {
  userId: string;
  transactionId: string;
  deletedAt: string;
}
