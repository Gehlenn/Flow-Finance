import {
  ClinicWebhookPayload,
  PaymentReceivedEvent as ClinicPaymentReceivedEvent,
  ExpenseRecordedEvent as ClinicExpenseRecordedEvent,
  ReceivableReminderCreatedEvent as ClinicReceivableReminderCreatedEvent,
  ReceivableReminderUpdatedEvent as ClinicReceivableReminderUpdatedEvent,
  ReceivableReminderClearedEvent as ClinicReceivableReminderClearedEvent,
} from '../../validation/clinicAutomation.schema';
import type {
  ExternalIntegrationEvent,
  PaymentReceivedEvent,
  ExpenseRecordedEvent,
  ReceivableReminderCreatedEvent,
  ReceivableReminderUpdatedEvent,
  ReceivableReminderClearedEvent,
} from '../../types/externalIntegration';

export function normalizeClinicCurrency(currency: string | undefined): 'BRL' | null {
  return currency === 'BRL' ? 'BRL' : null;
}

export function toClinicDateTimeAtStartOfDay(date: string): string {
  return `${date}T00:00:00.000Z`;
}

export function mapClinicPayloadToExternalEvent(
  payload: ClinicWebhookPayload,
): { event: ExternalIntegrationEvent } | { message: string } {
  const workspaceId = payload.externalFacilityId?.trim();
  if (!workspaceId) {
    return {
      message: 'externalFacilityId is required to route clinic events to a Flow workspace',
    };
  }

  switch (payload.type) {
    case 'payment_received': {
      const currency = normalizeClinicCurrency(payload.currency);
      if (!currency) {
        return {
          message: `Unsupported clinic event currency: ${payload.currency}`,
        };
      }
      return { event: mapPaymentReceivedEvent(payload, workspaceId, currency) };
    }
    case 'expense_recorded': {
      const currency = normalizeClinicCurrency(payload.currency);
      if (!currency) {
        return {
          message: `Unsupported clinic event currency: ${payload.currency}`,
        };
      }
      return { event: mapExpenseRecordedEvent(payload, workspaceId, currency) };
    }
    case 'receivable_reminder_created': {
      const currency = normalizeClinicCurrency(payload.currency);
      if (!currency) {
        return {
          message: `Unsupported clinic event currency: ${payload.currency}`,
        };
      }
      return { event: mapReminderCreatedEvent(payload, workspaceId, currency) };
    }
    case 'receivable_reminder_updated': {
      const currency = normalizeClinicCurrency(payload.currency);
      if (!currency) {
        return {
          message: `Unsupported clinic event currency: ${payload.currency}`,
        };
      }
      return { event: mapReminderUpdatedEvent(payload, workspaceId, currency) };
    }
    case 'receivable_reminder_cleared':
      return { event: mapReminderClearedEvent(payload, workspaceId, 'BRL') };
    default: {
      const exhaustive: never = payload;
      return { message: `Unsupported clinic event type: ${(exhaustive as { type: string }).type}` };
    }
  }
}

function mapPaymentReceivedEvent(
  payload: ClinicPaymentReceivedEvent,
  workspaceId: string,
  currency: 'BRL',
): PaymentReceivedEvent {
  return {
    eventType: 'payment_received',
    externalEventId: payload.externalEventId,
    sourceSystem: 'clinic-automation',
    workspaceId,
    occurredAt: payload.date,
    payload: {
      externalCustomerId: payload.externalPatientId,
      externalReceivableId: payload.externalEventId,
      amount: payload.amount,
      currency,
      category: payload.category,
      description: payload.description,
      notes: payload.notes,
    },
  };
}

function mapExpenseRecordedEvent(
  payload: ClinicExpenseRecordedEvent,
  workspaceId: string,
  currency: 'BRL',
): ExpenseRecordedEvent {
  return {
    eventType: 'expense_recorded',
    externalEventId: payload.externalEventId,
    sourceSystem: 'clinic-automation',
    workspaceId,
    occurredAt: payload.date,
    payload: {
      externalExpenseId: payload.externalEventId,
      amount: payload.amount,
      currency,
      category: payload.expenseCategory,
      description: payload.description,
      vendor: payload.vendor,
      notes: payload.notes,
    },
  };
}

function mapReminderCreatedEvent(
  payload: ClinicReceivableReminderCreatedEvent,
  workspaceId: string,
  currency: 'BRL',
): ReceivableReminderCreatedEvent {
  return {
    eventType: 'receivable_reminder_created',
    externalEventId: payload.externalEventId,
    sourceSystem: 'clinic-automation',
    workspaceId,
    occurredAt: new Date().toISOString(),
    payload: {
      externalCustomerId: payload.externalPatientId,
      externalReceivableId: payload.externalEventId,
      dueDate: toClinicDateTimeAtStartOfDay(payload.dueDate),
      outstandingAmount: payload.dueAmount,
      currency,
      description: payload.description,
      serviceDescription: payload.serviceDescription,
      notes: payload.notes,
    },
  };
}

function mapReminderUpdatedEvent(
  payload: ClinicReceivableReminderUpdatedEvent,
  workspaceId: string,
  currency: 'BRL',
): ReceivableReminderUpdatedEvent {
  return {
    eventType: 'receivable_reminder_updated',
    externalEventId: payload.externalEventId,
    sourceSystem: 'clinic-automation',
    workspaceId,
    occurredAt: payload.updatedAt,
    payload: {
      externalCustomerId: payload.externalPatientId,
      externalReceivableId: payload.externalEventId,
      dueDate: toClinicDateTimeAtStartOfDay(payload.dueDate),
      outstandingAmount: payload.dueAmount,
      currency,
      description: payload.description,
      reason: payload.reason,
    },
  };
}

function mapReminderClearedEvent(
  payload: ClinicReceivableReminderClearedEvent,
  workspaceId: string,
  currency: 'BRL',
): ReceivableReminderClearedEvent {
  return {
    eventType: 'receivable_reminder_cleared',
    externalEventId: payload.externalEventId,
    sourceSystem: 'clinic-automation',
    workspaceId,
    occurredAt: payload.clearedDate,
    payload: {
      externalCustomerId: payload.externalPatientId,
      externalReceivableId: payload.externalEventId,
      clearedAt: payload.clearedDate,
      settledAmount: payload.clearedAmount,
      currency,
      description: payload.notes || `Receivable reminder cleared (${payload.reason})`,
      notes: payload.notes,
      reason: payload.reason,
    },
  };
}
