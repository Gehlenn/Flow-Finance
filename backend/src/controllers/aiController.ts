import { Request, Response } from 'express';
import { generateContent, countTokens } from '../config/gemini';
import { ResponseSchema } from '@google/generative-ai';
import logger from '../config/logger';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import {
  InterpretRequest,
  InterpretResponse,
  ScanReceiptRequest,
  ScanReceiptResponse,
  ClassifyTransactionsRequest,
  ClassifyTransactionsResponse,
  GenerateInsightsRequest,
  GenerateInsightsResponse,
  TransactionData,
  ReminderData,
  ReceiptScanResult,
  TransactionClassification,
  DailyInsight,
  StrategicReport,
} from '../types';

// ─── INTERPRET — Parse smart input (text → transactions/reminders) ─────────────

export const interpretController = asyncHandler(async (req: Request, res: Response) => {
  const { text, memoryContext } = req.body as InterpretRequest;

  if (!text || text.trim().length === 0) {
    throw new AppError(400, 'Text is required');
  }

  logger.debug({ userId: req.userId, textLength: text.length }, 'Interpret request');

  const schema = {
    type: 'object',
    properties: {
      intent: { type: 'string' },
      transactions: { type: 'array' },
      reminders: { type: 'array' }
    }
  };

  const prompt = `Aja como o cérebro financeiro do app Flow Finance.
Analise o texto: "${text}".
${memoryContext ? `\nContexto do usuário: ${memoryContext}` : ''}

Regras de categoria:
- 'Pessoal': Gastos dia a dia, mercado, lazer, contas
- 'Trabalho': Aluguel de sala, materiais, cursos, consultas
- 'Negócio': Investimentos, marketing, receitas
- 'Investimento': Ações, CDB, aportes

Responda em JSON estruturado conforme o schema.`;

  try {
    const result = await generateContent(prompt, {
      responseMimeType: 'application/json',
      responseSchema: schema as unknown as ResponseSchema,
    });

    const parsed = JSON.parse(result);
    const response: InterpretResponse = {
      intent: parsed.intent,
      data: parsed.intent === 'transaction'
        ? (parsed.transactions || [] as TransactionData[])
        : (parsed.reminders || [] as ReminderData[])
    };

    res.json(response);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Interpret error');
    throw new AppError(500, 'Failed to interpret input', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ─── SCAN RECEIPT — OCR document parsing ───────────────────────────────────────

export const scanReceiptController = asyncHandler(async (req: Request, res: Response) => {
  const { imageBase64, imageMimeType, context } = req.body as ScanReceiptRequest;

  if (!imageBase64 || !imageMimeType) {
    throw new AppError(400, 'imageBase64 and imageMimeType are required');
  }

  logger.debug({ userId: req.userId, mimeType: imageMimeType }, 'Scan receipt request');

  const prompt = `Aja como scanner OCR especializado em documentos financeiros.
Extraia dados EXATOS da imagem:
1. Valor total final
2. Descrição/favorecido
3. Data (ISO format)
4. Categoria: 'Pessoal', 'Trabalho', 'Negócio' ou 'Investimento'
5. Tipo: 'Receita' ou 'Despesa'

${context ? `Contexto adicional: ${context}` : ''}

Responda em JSON.`;

  try {
    const result = await generateContent(prompt);
    const parsed = JSON.parse(result) as ReceiptScanResult;
    const response: ScanReceiptResponse = parsed;
    res.json(response);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Scan receipt error');
    throw new AppError(500, 'Failed to scan receipt', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ─── CLASSIFY TRANSACTIONS ────────────────────────────────────────────────────

export const classifyTransactionsController = asyncHandler(async (req: Request, res: Response) => {
  const { transactions } = req.body as ClassifyTransactionsRequest;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new AppError(400, 'transactions array is required');
  }

  logger.debug({ userId: req.userId, count: transactions.length }, 'Classify transactions request');

  const prompt = `Classifique estas transações:
${JSON.stringify(transactions, null, 2)}

Para cada uma, determine:
- category: 'Pessoal', 'Trabalho', 'Negócio' ou 'Investimento'
- type: 'Receita' ou 'Despesa'
- confidence: 0-1

Responda em JSON array.`;

  try {
    const result = await generateContent(prompt);
    const parsed = JSON.parse(result) as TransactionClassification[];
    const response: ClassifyTransactionsResponse = parsed;
    res.json(response);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Classify transactions error');
    throw new AppError(500, 'Failed to classify transactions');
  }
});

// ─── INSIGHTS — Generate financial insights ──────────────────────────────────

export const generateInsightsController = asyncHandler(async (req: Request, res: Response) => {
  const { transactions, type } = req.body as GenerateInsightsRequest;

  if (!Array.isArray(transactions)) {
    throw new AppError(400, 'transactions array is required');
  }

  if (type !== 'daily' && type !== 'strategic') {
    throw new AppError(400, 'type must be "daily" or "strategic"');
  }

  logger.debug({ userId: req.userId, type, count: transactions.length }, 'Generate insights request');

  const prompt = type === 'daily'
    ? `Analise estas transações e gere 3-5 insights curtos para o dia:
${JSON.stringify(transactions, null, 2)}

Foco: padrões recentes, alertas, dicas práticas.
Responda em JSON array com { title, description, type: 'padrão'|'alerta'|'dica' }.`
    : `Analise profundamente estas transações e gere relatório estratégico:
${JSON.stringify(transactions, null, 2)}

Estruture em:
1. Resumo Executivo
2. Pontos Fortes
3. Fraquezas
4. Riscos
5. Oportunidades
6. Ações Práticas

Responda em JSON estruturado.`;

  try {
    const result = await generateContent(prompt);
    const parsed = JSON.parse(result);

    let response: GenerateInsightsResponse;
    if (type === 'daily') {
      response = { insights: parsed as DailyInsight[] };
    } else {
      response = { report: parsed as StrategicReport };
    }

    res.json(response);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Generate insights error');
    throw new AppError(500, 'Failed to generate insights');
  }
});

// ─── TOKEN COUNT ──────────────────────────────────────────────────────────────

export const tokenCountController = asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    throw new AppError(400, 'text is required');
  }

  logger.debug({ userId: req.userId, textLength: text.length }, 'Token count request');

  try {
    const tokenCount = await countTokens(text);
    res.json({ tokenCount });
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Token count error');
    throw new AppError(500, 'Failed to count tokens');
  }
});
