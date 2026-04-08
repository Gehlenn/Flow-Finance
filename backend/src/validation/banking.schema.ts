import { z } from 'zod';

export const ConnectBankSchema = z.object({
  bankId: z.string().min(1, 'bankId is required'),
  userId: z.string().min(1, 'userId is required').optional(),
  itemId: z.string().min(1).optional(),
  connectorId: z.number().int().positive().optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
});

export const DisconnectBankSchema = z.object({
  connectionId: z.string().min(1, 'connectionId is required'),
  userId: z.string().min(1, 'userId is required').optional(),
});

export const SyncBankSchema = z.object({
  connectionId: z.string().min(1, 'connectionId is required'),
  userId: z.string().min(1, 'userId is required').optional(),
  days: z.number().int().positive().max(365).optional(),
});

export const ConnectTokenSchema = z.object({
  clientUserId: z.string().optional(),
});
