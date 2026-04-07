export type ExternalEventType =
  | 'payment_received'
  | 'expense_recorded'
  | 'receivable_reminder_created'
  | 'receivable_reminder_updated'
  | 'receivable_reminder_cleared';

export interface ExternalBaseEvent<TType extends ExternalEventType, TPayload> {
  eventType: TType;
  externalEventId: string;
  sourceSystem: string;
  workspaceId: string;
  occurredAt: string;
  payload: TPayload;
}

export interface PaymentReceivedPayload {
  externalCustomerId: string;
  externalReceivableId: string;
  amount: number;
  currency: 'BRL';
  category?: string;
  description: string;
  notes?: string;
}

export interface ExpenseRecordedPayload {
  externalExpenseId: string;
  amount: number;
  currency: 'BRL';
  category?: string;
  description: string;
  vendor?: string;
  notes?: string;
}

export interface ReceivableReminderPayload {
  externalCustomerId: string;
  externalReceivableId: string;
  dueDate: string;
  outstandingAmount: number;
  currency: 'BRL';
  description: string;
  serviceDescription?: string;
  notes?: string;
  reason?: 'amount_changed' | 'due_date_extended' | 'other';
}

export interface ReceivableReminderClearedPayload {
  externalCustomerId: string;
  externalReceivableId: string;
  clearedAt: string;
  settledAmount: number;
  currency: 'BRL';
  description: string;
  notes?: string;
  reason: 'paid' | 'cancelled' | 'written_off';
}

export type PaymentReceivedEvent = ExternalBaseEvent<'payment_received', PaymentReceivedPayload>;
export type ExpenseRecordedEvent = ExternalBaseEvent<'expense_recorded', ExpenseRecordedPayload>;
export type ReceivableReminderCreatedEvent = ExternalBaseEvent<'receivable_reminder_created', ReceivableReminderPayload>;
export type ReceivableReminderUpdatedEvent = ExternalBaseEvent<'receivable_reminder_updated', ReceivableReminderPayload>;
export type ReceivableReminderClearedEvent = ExternalBaseEvent<'receivable_reminder_cleared', ReceivableReminderClearedPayload>;

export type ExternalIntegrationEvent =
  | PaymentReceivedEvent
  | ExpenseRecordedEvent
  | ReceivableReminderCreatedEvent
  | ReceivableReminderUpdatedEvent
  | ReceivableReminderClearedEvent;

export interface ExternalIntegrationResult {
  status: 'applied' | 'duplicate';
  eventType: ExternalEventType;
  externalEventId: string;
  workspaceId: string;
  operation:
    | 'transaction_created'
    | 'reminder_created'
    | 'reminder_updated'
    | 'reminder_cleared';
}
