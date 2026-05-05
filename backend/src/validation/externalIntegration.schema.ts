import { z } from 'zod';

const baseEventSchema = {
  externalEventId: z.string().min(3).max(256),
  sourceSystem: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_\-\.]+$/, 'sourceSystem deve conter apenas letras, numeros, hifens, pontos ou underscores'),
  workspaceId: z.string().min(2).max(128),
  occurredAt: z.string().datetime().refine(val => {
    const d = new Date(val).getTime();
    const now = Date.now();
    return d > now - 365 * 24 * 3600 * 1000 && d < now + 7 * 24 * 3600 * 1000;
  }, 'occurredAt fora do intervalo permitido (max 1 ano atras, max 7 dias no futuro)'),
};

const paymentPayloadSchema = z.object({
  externalCustomerId: z.string().min(2).max(128),
  externalReceivableId: z.string().min(2).max(128),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.literal('BRL'),
  category: z.enum(['Pessoal', 'Trabalho / Consultório', 'Negócio', 'Investimento']).optional(),
  description: z.string().min(3).max(280),
  notes: z.string().min(1).max(1000).optional(),
}).strict();

const expensePayloadSchema = z.object({
  externalExpenseId: z.string().min(2).max(128),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.literal('BRL'),
  category: z.enum(['Pessoal', 'Trabalho / Consultório', 'Negócio', 'Investimento']).optional(),
  description: z.string().min(3).max(280),
  vendor: z.string().min(1).max(280).optional(),
  notes: z.string().min(1).max(1000).optional(),
}).strict();

const reminderPayloadSchema = z.object({
  externalCustomerId: z.string().min(2).max(128),
  externalReceivableId: z.string().min(2).max(128),
  dueDate: z.string().datetime(),
  outstandingAmount: z.number().nonnegative().max(1_000_000_000),
  currency: z.literal('BRL'),
  description: z.string().min(3).max(280),
  serviceDescription: z.string().min(1).max(280).optional(),
  notes: z.string().min(1).max(1000).optional(),
  reason: z.enum(['amount_changed', 'due_date_extended', 'other']).optional(),
}).strict();

const reminderClearedPayloadSchema = z.object({
  externalCustomerId: z.string().min(2).max(128),
  externalReceivableId: z.string().min(2).max(128),
  clearedAt: z.string().datetime(),
  settledAmount: z.number().nonnegative().max(1_000_000_000),
  currency: z.literal('BRL'),
  description: z.string().min(3).max(280),
  notes: z.string().min(1).max(500).optional(),
  reason: z.enum(['paid', 'cancelled', 'written_off']),
}).strict();

const alertTriggeredPayloadSchema = z.object({
  category: z.enum(['Pessoal', 'Trabalho / Consultório', 'Negócio', 'Investimento', 'Geral']).default('Geral'),
  description: z.string().min(3).max(280),
  amount: z.number().positive().max(1_000_000_000).optional(),
  currency: z.literal('BRL').optional(),
  notes: z.string().min(1).max(1000).optional(),
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
  z.object({
    eventType: z.literal('alert_triggered'),
    ...baseEventSchema,
    payload: alertTriggeredPayloadSchema,
  }).strict(),
]);

export type ExternalIntegrationEventInput = z.infer<typeof ExternalIntegrationEventSchema>;
