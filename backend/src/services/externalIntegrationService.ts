import { randomUUID } from 'crypto';
import { appendDomainEvent } from './finance/eventStore';
import { recordAuditEvent } from './admin/auditLog';
import { getWorkspaceAsync } from './admin/workspaceStore';
import { pushSyncItems } from './sync/cloudSyncStore';
import {
  ExternalIntegrationEvent,
  ExternalIntegrationResult,
  PaymentReceivedEvent,
  ExpenseRecordedEvent,
  ReceivableReminderCreatedEvent,
  ReceivableReminderUpdatedEvent,
  ReceivableReminderClearedEvent,
} from '../types/externalIntegration';
import { hasProcessedExternalEvent, markExternalEventProcessed } from './externalIdempotencyStore';
import { AppError } from '../middleware/errorHandler';

function toIntegrationUserId(sourceSystem: string): string {
  return `integration:${sourceSystem}`;
}

async function persistTransactionFromPayment(event: PaymentReceivedEvent): Promise<void> {
  const integrationUserId = toIntegrationUserId(event.sourceSystem);
  const txId = randomUUID();

  await pushSyncItems(
    event.workspaceId,
    'transactions',
    [{
      id: txId,
      updatedAt: event.occurredAt,
      payload: {
        id: txId,
        user_id: integrationUserId,
        workspace_id: event.workspaceId,
        amount: event.payload.amount,
        type: 'Receita',
        category: event.payload.category || 'Trabalho / Consultório',
        description: event.payload.description,
        date: event.occurredAt,
        source: 'import',
      },
    }],
    {
      userId: integrationUserId,
      workspaceId: event.workspaceId,
    },
  );

  await appendDomainEvent({
    workspaceId: event.workspaceId,
    type: 'external.payment_received',
    aggregateId: event.payload.externalReceivableId,
    aggregateType: 'receivable',
    userId: integrationUserId,
    payload: {
      externalEventId: event.externalEventId,
      sourceSystem: event.sourceSystem,
      ...event.payload,
    },
    occurredAt: event.occurredAt,
  });
}

async function persistTransactionFromExpense(event: ExpenseRecordedEvent): Promise<void> {
  const integrationUserId = toIntegrationUserId(event.sourceSystem);
  const txId = randomUUID();

  await pushSyncItems(
    event.workspaceId,
    'transactions',
    [{
      id: txId,
      updatedAt: event.occurredAt,
      payload: {
        id: txId,
        user_id: integrationUserId,
        workspace_id: event.workspaceId,
        amount: event.payload.amount,
        type: 'Despesa',
        category: event.payload.category || 'Trabalho / Consultório',
        description: event.payload.description,
        date: event.occurredAt,
        source: 'import',
      },
    }],
    {
      userId: integrationUserId,
      workspaceId: event.workspaceId,
    },
  );

  await appendDomainEvent({
    workspaceId: event.workspaceId,
    type: 'external.expense_recorded',
    aggregateId: event.payload.externalExpenseId,
    aggregateType: 'expense',
    userId: integrationUserId,
    payload: {
      externalEventId: event.externalEventId,
      sourceSystem: event.sourceSystem,
      ...event.payload,
    },
    occurredAt: event.occurredAt,
  });
}

async function persistReminderEvent(
  event:
    | ReceivableReminderCreatedEvent
    | ReceivableReminderUpdatedEvent
    | ReceivableReminderClearedEvent,
): Promise<void> {
  const integrationUserId = toIntegrationUserId(event.sourceSystem);

  await appendDomainEvent({
    workspaceId: event.workspaceId,
    type: `external.${event.eventType}`,
    aggregateId: event.payload.externalReceivableId,
    aggregateType: 'receivable_reminder',
    userId: integrationUserId,
    payload: {
      externalEventId: event.externalEventId,
      sourceSystem: event.sourceSystem,
      ...event.payload,
    },
    occurredAt: event.occurredAt,
  });
}

export async function processExternalIntegrationEvent(
  event: ExternalIntegrationEvent,
): Promise<ExternalIntegrationResult> {
  const workspace = await getWorkspaceAsync(event.workspaceId);
  if (!workspace) {
    throw new AppError(404, 'Workspace not found for integration event');
  }

  if (hasProcessedExternalEvent(event.workspaceId, event.externalEventId)) {
    return {
      status: 'duplicate',
      eventType: event.eventType,
      externalEventId: event.externalEventId,
      workspaceId: event.workspaceId,
      operation: event.eventType === 'payment_received'
        ? 'transaction_created'
        : event.eventType === 'expense_recorded'
          ? 'transaction_created'
          : event.eventType === 'receivable_reminder_cleared'
            ? 'reminder_cleared'
            : event.eventType === 'receivable_reminder_updated'
              ? 'reminder_updated'
              : 'reminder_created',
    };
  }

  if (event.eventType === 'payment_received') {
    await persistTransactionFromPayment(event);
  } else if (event.eventType === 'expense_recorded') {
    await persistTransactionFromExpense(event);
  } else {
    await persistReminderEvent(event);
  }

  markExternalEventProcessed(event.workspaceId, event.externalEventId);

  const operation = event.eventType === 'payment_received'
    ? 'transaction_created'
    : event.eventType === 'expense_recorded'
      ? 'transaction_created'
      : event.eventType === 'receivable_reminder_cleared'
        ? 'reminder_cleared'
        : event.eventType === 'receivable_reminder_updated'
          ? 'reminder_updated'
          : 'reminder_created';

  recordAuditEvent({
    tenantId: workspace.tenantId,
    workspaceId: workspace.workspaceId,
    userId: toIntegrationUserId(event.sourceSystem),
    action: 'integration.external_event_received',
    status: 'success',
    resource: workspace.workspaceId,
    resourceType: 'external_integration',
    resourceId: event.externalEventId,
    metadata: {
      eventType: event.eventType,
      sourceSystem: event.sourceSystem,
      operation,
    },
  });

  return {
    status: 'applied',
    eventType: event.eventType,
    externalEventId: event.externalEventId,
    workspaceId: event.workspaceId,
    operation,
  };
}
