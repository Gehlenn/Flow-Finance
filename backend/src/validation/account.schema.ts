import { z } from 'zod';

export const AccountTypeSchema = z.enum(['bank', 'cash', 'credit_card', 'investment']);

export const AccountSchema = z.object({
  id: z.string().min(1).optional(),
  user_id: z.string().min(1),
  name: z.string().min(1),
  type: AccountTypeSchema,
  balance: z.number().finite(),
  currency: z.string().min(3).max(3).default('BRL'),
  created_at: z.string().datetime().optional(),
});

export const AccountUpdateSchema = AccountSchema.partial().extend({
  id: z.string().min(1),
});
