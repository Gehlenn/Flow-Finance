import { eventBus } from './EventBus';
import { TRANSACTION_CREATED, TransactionCreatedEvent } from './events/TransactionCreated';
import { TRANSACTION_UPDATED, TransactionUpdatedEvent } from './events/TransactionUpdated';
import { GOAL_CREATED, GoalCreatedEvent } from './events/GoalCreated';
import { BUDGET_CHANGED, BudgetChangedEvent } from './events/BudgetChanged';

export const FinancialEvents = {
  TRANSACTION_CREATED,
  TRANSACTION_UPDATED,
  GOAL_CREATED,
  BUDGET_CHANGED,
} as const;

export function emitTransactionCreated(payload: TransactionCreatedEvent): void {
  eventBus.emit(TRANSACTION_CREATED, payload);
}

export function emitTransactionUpdated(payload: TransactionUpdatedEvent): void {
  eventBus.emit(TRANSACTION_UPDATED, payload);
}

export function emitGoalCreated(payload: GoalCreatedEvent): void {
  eventBus.emit(GOAL_CREATED, payload);
}

export function emitBudgetChanged(payload: BudgetChangedEvent): void {
  eventBus.emit(BUDGET_CHANGED, payload);
}

export function onFinancialEvent<T>(event: string, handler: (payload: T) => void): () => void {
  return eventBus.on<T>(event, handler);
}
