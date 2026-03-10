export const BUDGET_UPDATED_EVENT = 'budget_updated';

export interface BudgetUpdatedEvent {
  userId: string;
  accountId: string;
  previousBudget: number;
  currentBudget: number;
}
