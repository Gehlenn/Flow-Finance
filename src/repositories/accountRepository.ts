import { Account } from '../domain/entities';
import { StorageProvider } from '../storage/StorageProvider';

export class AccountRepository {
  constructor(private readonly storage: StorageProvider) {}

  async getByUser(userId: string): Promise<Account[]> {
    return this.storage.getAccounts(userId);
  }

  async create(account: Account): Promise<void> {
    await this.storage.saveAccount(account);
  }

  async delete(accountId: string): Promise<void> {
    await this.storage.deleteAccount(accountId);
  }
}
