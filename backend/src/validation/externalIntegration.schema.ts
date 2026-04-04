import { z } from 'zod';

const baseEventSchema = {
  externalEventId: z.string().min(3).max(128),
  sourceSystem: z.string().min(2).max(64),
  workspaceId: z.string().min(2).max(128),
  occurredAt: z.string().datetime(),
};

const paymentPayloadSchema = z.object({
  externalCustomerId: z.string().min(2).max(128),
  externalReceivableId: z.string().min(2).max(128),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.literal('BRL'),
  category: z.string().min(2).max(64).optional(),
  description: z.string().min(3).max(280),
}).strict();

const expensePayloadSchema = z.object({
  externalExpenseId: z.string().min(2).max(128),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.literal('BRL'),
  category: z.string().min(2).max(64).optional(),
  description: z.string().min(3).max(280),
}).strict();

const reminderPayloadSchema = z.object({
  externalCustomerId: z.string().min(2).max(128),
  externalReceivableId: z.string().min(2).max(128),
  dueDate: z.string().datetime(),
  outstandingAmount: z.number().nonnegative().max(1_000_000_000),
  currency: z.literal('BRL'),
  description: z.string().min(3).max(280),
}).strict();

const reminderClearedPayloadSchema = z.object({
  externalCustomerId: z.string().min(2).max(128),
  externalReceivableId: z.string().min(2).max(128),
  clearedAt: z.string().datetime(),
  settledAmount: z.number().nonnegative().max(1_000_000_000),
  currency: z.literal('BRL'),
  description: z.string().min(3).max(280),
}).strict();

export const ExternalIntegrationEventSchema = z.discriminatedUnion('eventType', [
  z.object({
    eventType: z.literal('payment_received'),
    ...baseEventSchema,
    payload: paymentPayloadSchema,
  }).strict(),
  z.object({
    eventType: z.literal('expense_recorded'),
    ...baseEventSchema,
    payload: expensePayloadSchema,
  }).strict(),
  z.object({
    eventType: z.literal('receivable_reminder_created'),
    ...baseEventSchema,
    payload: reminderPayloadSchema,
  }).strict(),
  z.object({
    eventType: z.literal('receivable_reminder_updated'),
    ...baseEventSchema,
    payload: reminderPayloadSchema,
  }).strict(),
  z.object({
    eventType: z.literal('receivable_reminder_cleared'),
    ...baseEventSchema,
    payload: reminderClearedPayloadSchema,
  }).strict(),
]);

export type ExternalIntegrationEventInput = z.infer<typeof ExternalIntegrationEventSchema>;
