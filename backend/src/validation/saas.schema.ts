import { z } from 'zod';

const UsageSnapshotSchema = z.object({
  transactions: z.number().int().min(0),
  aiQueries: z.number().int().min(0),
  bankConnections: z.number().int().min(0),
});

export const UsageUpsertSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  usage: z.record(z.string(), UsageSnapshotSchema),
});

export const UsageIncrementSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  resource: z.enum(['transactions', 'aiQueries', 'bankConnections']),
  amount: z.number().int().min(1).default(1),
  at: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UsageResetSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export const BillingHookSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  plan: z.enum(['free', 'pro']),
  event: z.enum(['usage_recorded', 'limit_reached', 'upgrade_required', 'plan_changed']),
  resource: z.enum(['transactions', 'aiQueries', 'bankConnections']).optional(),
  amount: z.number().min(0),
  at: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const PlanChangeSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  plan: z.enum(['free', 'pro']),
});

export const StripeCheckoutSchema = z.object({
  returnUrl: z.string().url(),
});

export const StripePortalSchema = z.object({
  returnUrl: z.string().url(),
});
