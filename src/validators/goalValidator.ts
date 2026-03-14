import { AppError } from '../errors/AppError';
import type { FinancialGoal } from '../domain/entities';

export function validateGoalInput(
  goalData: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isCompleted'>
): void {
  if (!goalData) {
    throw new AppError('Goal payload is required', 400);
  }

  if (!goalData.name || goalData.name.trim().length < 2) {
    throw new AppError('Goal name is required', 400, { field: 'name' });
  }

  if (typeof goalData.targetAmount !== 'number' || !Number.isFinite(goalData.targetAmount) || goalData.targetAmount <= 0) {
    throw new AppError('Goal targetAmount must be a positive number', 400, { field: 'targetAmount' });
  }

  if (typeof goalData.currentAmount !== 'number' || goalData.currentAmount < 0) {
    throw new AppError('Goal currentAmount cannot be negative', 400, { field: 'currentAmount' });
  }

  if (!(goalData.targetDate instanceof Date) || Number.isNaN(goalData.targetDate.getTime())) {
    throw new AppError('Goal targetDate is invalid', 400, { field: 'targetDate' });
  }
}
