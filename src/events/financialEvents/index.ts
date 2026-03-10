import { eventBus } from '../EventBus';
import { GOAL_CREATED_EVENT, GoalCreatedEvent } from './GoalCreated';
import { BUDGET_UPDATED_EVENT, BudgetUpdatedEvent } from './BudgetUpdated';
import { TRANSACTION_CREATED_EVENT, TransactionCreatedEvent } from './TransactionCreated';
import { TRANSACTION_DELETED_EVENT, TransactionDeletedEvent } from './TransactionDeleted';

export * from './GoalCreated';
export * from './BudgetUpdated';
export * from './TransactionCreated';
export * from './TransactionDeleted';

export function emitTransactionCreatedEvent(payload: TransactionCreatedEvent): void {
  eventBus.emit(TRANSACTION_CREATED_EVENT, payload);
}

export function emitTransactionDeletedEvent(payload: TransactionDeletedEvent): void {
  eventBus.emit(TRANSACTION_DELETED_EVENT, payload);
}

export function emitGoalCreatedEvent(payload: GoalCreatedEvent): void {
  eventBus.emit(GOAL_CREATED_EVENT, payload);
}

export function emitBudgetUpdatedEvent(payload: BudgetUpdatedEvent): void {
  eventBus.emit(BUDGET_UPDATED_EVENT, payload);
}
