import { Transaction } from '../domain/entities';
import { StorageProvider } from '../storage/StorageProvider';

export class TransactionRepository {
  constructor(private readonly storage: StorageProvider) {}

  async getByUser(userId: string): Promise<Transaction[]> {
    return this.storage.getTransactions(userId);
  }

  async create(transaction: Transaction): Promise<void> {
    await this.storage.saveTransaction(transaction);
  }

  async delete(transactionId: string): Promise<void> {
    await this.storage.deleteTransaction(transactionId);
  }
}
