import { z } from 'zod';

const MAX_LIGHT_METADATA_FIELDS = 20;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,127}$/;
const SOURCE_SYSTEM_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}\-?\d{2}\b/;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}\-?\d{4})/;
const FORBIDDEN_FIELD_KEY_PATTERN = /(cpf|email|e-mail|phone|telefone|celular|endereco|address|anamnese|prontuario|medical|clinical|whatsapp|transcript|conversation)/i;

const lightweightMetadataSchema = z
  .record(
    z.string().min(1).max(64),
    z.union([
      z.string().min(1).max(300),
      z.number().finite(),
      z.boolean(),
      z.null(),
    ]),
  )
  .superRefine((metadata, ctx) => {
    const entries = Object.entries(metadata);

    if (entries.length > MAX_LIGHT_METADATA_FIELDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `metadata must contain at most ${MAX_LIGHT_METADATA_FIELDS} lightweight fields`,
      });
    }

    for (const [key, value] of entries) {
      if (FORBIDDEN_FIELD_KEY_PATTERN.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `metadata key "${key}" is not allowed`,
          path: [key],
        });
      }

      if (typeof value === 'string' && containsSensitiveData(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `metadata field "${key}" contains sensitive data`,
          path: [key],
        });
      }
    }
  });

const baseIntegrationSchema = z.object({
  workspaceId: z.string().trim().min(2).max(128).regex(SAFE_ID_PATTERN),
  sourceSystem: z.string().trim().min(2).max(64).regex(SOURCE_SYSTEM_PATTERN),
  externalRecordId: z.string().trim().min(2).max(128).regex(SAFE_ID_PATTERN),
  integrationId: z.string().trim().min(2).max(128).regex(SAFE_ID_PATTERN).optional(),
  externalCustomerId: z.string().trim().min(2).max(128).optional(),
  metadata: lightweightMetadataSchema.optional(),
}).strict();

const transactionPayloadSchema = baseIntegrationSchema.extend({
  type: z.enum(['income', 'expense', 'receivable', 'payable']),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.string().trim().regex(CURRENCY_PATTERN),
  occurredAt: z.string().datetime(),
  description: z.string().trim().min(3).max(160),
  status: z.enum(['confirmed', 'pending', 'overdue']),
  category: z.string().trim().min(2).max(64).optional(),
  subcategory: z.string().trim().min(2).max(64).optional(),
  counterpartyLabel: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().min(1).max(300).optional(),
  dueAt: z.string().datetime().optional(),
  referenceDate: z.string().datetime().optional(),
}).superRefine((payload, ctx) => {
  refineNoSensitiveStrings([
    ['description', payload.description],
    ['counterpartyLabel', payload.counterpartyLabel],
    ['notes', payload.notes],
    ['externalCustomerId', payload.externalCustomerId],
  ], ctx);

  if ((payload.type === 'income' || payload.type === 'expense') && payload.status !== 'confirmed') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'income and expense records must use status "confirmed" in v1',
      path: ['status'],
    });
  }

  if ((payload.type === 'receivable' || payload.type === 'payable') && payload.status !== 'confirmed' && !payload.dueAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'receivable and payable records require dueAt when status is pending or overdue',
      path: ['dueAt'],
    });
  }
});

const reminderPayloadSchema = baseIntegrationSchema.extend({
  title: z.string().trim().min(3).max(120),
  remindAt: z.string().datetime(),
  kind: z.enum(['financial', 'operational']),
  status: z.enum(['active', 'completed', 'canceled']),
  description: z.string().trim().min(1).max(300).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  relatedTransactionExternalId: z.string().trim().min(2).max(128).regex(SAFE_ID_PATTERN).optional(),
}).superRefine((payload, ctx) => {
  refineNoSensitiveStrings([
    ['title', payload.title],
    ['description', payload.description],
    ['externalCustomerId', payload.externalCustomerId],
  ], ctx);
});

export const IntegrationTransactionSchema = transactionPayloadSchema;
export const IntegrationReminderSchema = reminderPayloadSchema;

export type IntegrationTransactionInput = z.infer<typeof IntegrationTransactionSchema>;
export type IntegrationReminderInput = z.infer<typeof IntegrationReminderSchema>;

function containsSensitiveData(value: string): boolean {
  return CPF_PATTERN.test(value) || EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value);
}

function refineNoSensitiveStrings(
  fields: Array<[string, string | undefined]>,
  ctx: z.RefinementCtx,
): void {
  for (const [field, value] of fields) {
    if (!value) continue;

    if (FORBIDDEN_FIELD_KEY_PATTERN.test(field) || containsSensitiveData(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field} contains sensitive data and is not allowed`,
        path: [field],
      });
    }
  }
}
