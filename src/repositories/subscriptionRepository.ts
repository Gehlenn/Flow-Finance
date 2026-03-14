import { Subscription } from '../domain/entities';
import { StorageProvider } from '../storage/StorageProvider';

export class SubscriptionRepository {
  constructor(private readonly storage: StorageProvider) {}

  async getByUser(userId: string): Promise<Subscription[]> {
    return this.storage.getSubscriptions(userId);
  }

  async create(subscription: Subscription): Promise<void> {
    await this.storage.saveSubscription(subscription);
  }

  async delete(subscriptionId: string): Promise<void> {
    await this.storage.deleteSubscription(subscriptionId);
  }
}
