export const BUDGET_CHANGED = 'budget_changed';

export interface BudgetChangedEvent {
  userId: string;
  accountId?: string;
  previousBudget: number;
  currentBudget: number;
  changedAt: string;
}
