import { FinancialGoal } from '../domain/entities';
import { StorageProvider } from '../storage/StorageProvider';

export class GoalRepository {
  constructor(private readonly storage: StorageProvider) {}

  async getByUser(userId: string): Promise<FinancialGoal[]> {
    return this.storage.getGoals(userId);
  }

  async create(goal: FinancialGoal): Promise<void> {
    await this.storage.saveGoal(goal);
  }

  async delete(goalId: string): Promise<void> {
    await this.storage.deleteGoal(goalId);
  }
}
