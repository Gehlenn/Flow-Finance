import { z } from 'zod';

/**
 * Schemas de validação para integrações com a automação da clínica.
 * Define contratos estáveis para ingestão de receitas, despesas e lembretes de cobrança.
 */

/**
 * Tipo de evento que a clínica pode enviar.
 */
export const ClinicEventTypeSchema = z.enum([
  'payment_received',
  'expense_recorded',
  'receivable_reminder_created',
  'receivable_reminder_updated',
  'receivable_reminder_cleared'
]);

const ExternalEventIdSchema = z.string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/, 'externalEventId must contain only technical identifier characters');

export type ClinicEventType = z.infer<typeof ClinicEventTypeSchema>;

/**
 * Schema base para authenticação de origem.
 * Toda requisição deve incluir identificação da origem.
 */
export const ClinicWebhookAuthSchema = z.object({
  sourceSystem: z.literal('clinic-automation'),
  requestId: z.string().uuid().describe('UUID único do evento'),
  hmacSignature: z.string().optional().describe('HMAC-SHA256 da payload'),
  apiKeyThumbprint: z.string().optional().describe('Fingerprint da chave API'),
  timestamp: z.string().datetime().describe('ISO 8601 timestamp da geração do evento')
});

/**
 * Schema para pagamento recebido na clínica.
 */
export const PaymentReceivedSchema = z.object({
  type: z.literal('payment_received'),
  // Identificação
  externalEventId: ExternalEventIdSchema.describe('ID único externo do evento na clínica'),
  externalPatientId: z.string().describe('ID do paciente na clínica'),
  externalFacilityId: z.string().optional().describe('ID do estabelecimento/unidade'),
  // Dados financeiros
  amount: z.number().positive().finite().max(999999999),
  currency: z.string().default('BRL').describe('Código ISO 4217'),
  date: z.string().datetime(),
  paymentMethod: z.enum(['cash', 'credit_card', 'debit_card', 'transfer', 'pix', 'check', 'other']),
  // Contexto
  description: z.string().min(1).max(500).describe('Descrição operacional'),
  category: z.string().optional().describe('Categoria financeira na clínica'),
  notes: z.string().max(1000).optional()
});

export type PaymentReceivedEvent = z.infer<typeof PaymentReceivedSchema>;

/**
 * Schema para despesa registrada na clínica.
 */
export const ExpenseRecordedSchema = z.object({
  type: z.literal('expense_recorded'),
  // Identificação
  externalEventId: ExternalEventIdSchema.describe('ID único externo do evento'),
  externalFacilityId: z.string().optional().describe('ID do estabelecimento/unidade'),
  // Dados financeiros
  amount: z.number().positive().finite().max(999999999),
  currency: z.string().default('BRL'),
  date: z.string().datetime(),
  expenseCategory: z.string().describe('Categoria da despesa'),
  // Contexto
  description: z.string().min(1).max(500),
  vendor: z.string().optional().describe('Fornecedor/Credor'),
  notes: z.string().max(1000).optional()
});

export type ExpenseRecordedEvent = z.infer<typeof ExpenseRecordedSchema>;

/**
 * Schema para lembrete de cobrança criado.
 */
export const ReceivableReminderCreatedSchema = z.object({
  type: z.literal('receivable_reminder_created'),
  // Identificação
  externalEventId: ExternalEventIdSchema.describe('ID único do lembrete'),
  externalPatientId: z.string().describe('ID do paciente'),
  externalFacilityId: z.string().optional(),
  // Dados de cobrança
  dueAmount: z.number().positive().finite().max(999999999),
  dueDate: z.string().date().describe('YYYY-MM-DD'),
  currency: z.string().default('BRL'),
  // Descrição
  description: z.string().min(1).max(500),
  serviceDescription: z.string().optional().describe('O que foi fornecido'),
  notes: z.string().max(1000).optional()
});

export type ReceivableReminderCreatedEvent = z.infer<typeof ReceivableReminderCreatedSchema>;

/**
 * Schema para lembrete de cobrança atualizado.
 */
export const ReceivableReminderUpdatedSchema = z.object({
  type: z.literal('receivable_reminder_updated'),
  externalEventId: ExternalEventIdSchema,
  externalPatientId: z.string(),
  externalFacilityId: z.string().optional(),
  dueAmount: z.number().positive().finite().max(999999999),
  dueDate: z.string().date(),
  currency: z.string().default('BRL'),
  description: z.string().min(1).max(500),
  updatedAt: z.string().datetime(),
  reason: z.enum(['amount_changed', 'due_date_extended', 'other']).optional()
});

export type ReceivableReminderUpdatedEvent = z.infer<typeof ReceivableReminderUpdatedSchema>;

/**
 * Schema para lembrete de cobrança quitado.
 */
export const ReceivableReminderClearedSchema = z.object({
  type: z.literal('receivable_reminder_cleared'),
  externalEventId: ExternalEventIdSchema.describe('ID do lembrete original'),
  externalPatientId: z.string(),
  externalFacilityId: z.string().optional(),
  clearedAmount: z.number().positive().finite().max(999999999),
  clearedDate: z.string().datetime(),
  reason: z.enum(['paid', 'cancelled', 'written_off']).describe('Motivo da quitação'),
  notes: z.string().max(500).optional()
});

export type ReceivableReminderClearedEvent = z.infer<typeof ReceivableReminderClearedSchema>;

/**
 * Union type de todos os eventos conhecidos.
 */
export const ClinicWebhookPayloadSchema = z.discriminatedUnion('type', [
  PaymentReceivedSchema,
  ExpenseRecordedSchema,
  ReceivableReminderCreatedSchema,
  ReceivableReminderUpdatedSchema,
  ReceivableReminderClearedSchema
]);

export type ClinicWebhookPayload = z.infer<typeof ClinicWebhookPayloadSchema>;

/**
 * Schema completo da requisição de webhook da clínica.
 */
export const ClinicWebhookRequestSchema = z.object({
  auth: ClinicWebhookAuthSchema,
  data: ClinicWebhookPayloadSchema
});

export type ClinicWebhookRequest = z.infer<typeof ClinicWebhookRequestSchema>;

/**
 * Schema para resposta de sucesso do webhook.
 */
export const ClinicWebhookResponseSchema = z.object({
  success: z.boolean(),
  receivedEventId: z.string().uuid(),
  externalEventId: z.string(),
  processedAt: z.string().datetime(),
  idempotencyKey: z.string().describe('Chave para deduplicação'),
  message: z.string().optional()
});

export type ClinicWebhookResponse = z.infer<typeof ClinicWebhookResponseSchema>;
