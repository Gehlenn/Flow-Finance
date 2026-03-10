import { z } from 'zod';

export const CFOSchema = z.object({
  question: z.string().min(1, 'question is required'),
  context: z.string().optional(),
  intent: z.string().optional(),
});

export const InterpretSchema = z.object({
  text: z.string().min(1, 'text is required'),
  memoryContext: z.string().optional(),
});

export const ScanReceiptSchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required'),
  imageMimeType: z.string().min(1, 'imageMimeType is required'),
  context: z.string().optional(),
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
  text: z.string().min(1, 'text is required'),
});
