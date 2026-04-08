import { z } from 'zod';

const SyncEntitySchema = z.enum(['accounts', 'transactions', 'goals', 'reminders', 'subscriptions']);

const SyncItemSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1).optional(),
  updatedAt: z.string().min(1),
  deleted: z.boolean().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const SyncPushSchema = z.object({
  entity: SyncEntitySchema,
  items: z.array(SyncItemSchema).max(2000),
});

export const SyncPullQuerySchema = z.object({
  since: z.string().optional(),
});

export type SyncEntity = z.infer<typeof SyncEntitySchema>;
export type SyncItem = z.infer<typeof SyncItemSchema>;
