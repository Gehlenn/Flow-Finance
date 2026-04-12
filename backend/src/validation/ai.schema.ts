import { z } from 'zod';

export const CFOSchema = z.object({
  question: z.string().trim().min(1, 'question is required').max(1000, 'question must be <= 1000 chars'),
  context: z.string().max(20000, 'context must be <= 20000 chars').optional(),
  intent: z.enum([
    'spending_advice',
    'cash_position',
    'risk_question',
    'savings_question',
    'monthly_summary',
    'receivables_question',
  ]).optional(),
});

export const InterpretSchema = z.object({
  text: z.string().trim().min(1, 'text is required').max(4000, 'text must be <= 4000 chars'),
  memoryContext: z.string().max(20000, 'memoryContext must be <= 20000 chars').optional(),
});

export const ScanReceiptSchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required'),
  imageMimeType: z.string().min(1, 'imageMimeType is required').max(120, 'imageMimeType must be <= 120 chars'),
  context: z.string().max(8000, 'context must be <= 8000 chars').optional(),
});

export const ClassifyTransactionsSchema = z.object({
  transactions: z.array(
    z.object({
      description: z.string().min(1),
      amount: z.number(),
      date: z.string().optional(),
    })
  ).min(1, 'transactions is required'),
});

export const GenerateInsightsSchema = z.object({
  transactions: z.array(
    z.object({
      amount: z.number(),
      description: z.string().min(1),
      category: z.enum(['Pessoal', 'Trabalho', 'Negócio', 'Investimento']),
      type: z.enum(['Receita', 'Despesa']),
    })
  ),
  type: z.enum(['daily', 'strategic']),
});

export const TokenCountSchema = z.object({
  text: z.string().trim().min(1, 'text is required').max(20000, 'text must be <= 20000 chars'),
});
