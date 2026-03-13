import { z } from 'zod';

export const TransactionSchema = z.object({
  amount: z.number().finite().max(999999999),
  description: z.string().min(1),
  category: z.enum(['Pessoal', 'Trabalho', 'Negócio', 'Investimento']),
  type: z.enum(['Receita', 'Despesa']),
  date: z.string().datetime().optional(),
});

export const TransactionsBatchSchema = z.object({
  transactions: z.array(TransactionSchema).min(1),
});
