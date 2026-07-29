import { z } from 'zod';

export const SYNC_ENTITIES = ['accounts', 'transactions', 'goals', 'reminders', 'receivables', 'subscriptions'] as const;

const SyncEntitySchema = z.enum(SYNC_ENTITIES);

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

export type SyncEntity = (typeof SYNC_ENTITIES)[number];
export type SyncItem = z.infer<typeof SyncItemSchema>;
export type SyncPushRequest = z.infer<typeof SyncPushSchema>;
