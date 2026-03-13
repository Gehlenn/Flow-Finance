import { Request, Response } from 'express';
import { generateContent, estimateTokens } from '../config/ai';
// AI provider with automatic fallback (OpenAI → Gemini)

import logger from '../config/logger';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { safeJsonParse, validateAIResponse } from '../utils/jsonHelpers';
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

function buildInterpretFallbackResponse(): InterpretResponse {
  return {
    intent: 'transaction',
    data: [],
  };
}

function buildInsightsFallbackResponse(type: 'daily' | 'strategic'): GenerateInsightsResponse {
  if (type === 'daily') {
    return { insights: [] };
  }

  return {
    report: {
      summary: 'Não foi possível gerar o relatório estratégico agora.',
      strengths: [],
      weaknesses: [],
      risks: [],
      opportunities: [],
      actions: [],
    },
  };
}

// ─── INTERPRET — Parse smart input (text → transactions/reminders) ─────────────

export const interpretController = asyncHandler(async (req: Request, res: Response) => {
  const { text, memoryContext } = req.body as InterpretRequest;

  if (!text || text.trim().length === 0) {
    throw new AppError(400, 'Text is required');
  }

  logger.debug({ userId: req.userId, textLength: text.length }, 'Interpret request');

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
    });

    const parsed = safeJsonParse(result, 'interpret');
    validateAIResponse(parsed, ['intent'], 'interpret');
    
    const response: InterpretResponse = {
      intent: parsed.intent,
      data: parsed.intent === 'transaction'
        ? (parsed.transactions || [] as TransactionData[])
        : (parsed.reminders || [] as ReminderData[])
    };

    res.json(response);
  } catch (error) {
    logger.warn({ error, userId: req.userId }, 'Interpret unavailable, returning fallback response');
    res.json(buildInterpretFallbackResponse());
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
    const parsed = safeJsonParse<ReceiptScanResult>(result, 'scan-receipt');
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
    const parsed = safeJsonParse<TransactionClassification[]>(result, 'classify-transactions');
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
    const parsed = safeJsonParse(result, `insights-${type}`);

    let response: GenerateInsightsResponse;
    if (type === 'daily') {
      response = { insights: parsed as DailyInsight[] };
    } else {
      response = { report: parsed as StrategicReport };
    }

    res.json(response);
  } catch (error) {
    logger.warn({ error, userId: req.userId, type }, 'Generate insights unavailable, returning fallback response');
    res.json(buildInsightsFallbackResponse(type));
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
    const tokenCount = await estimateTokens(text);
    res.json({ tokenCount });
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Token count error');
    throw new AppError(500, 'Failed to count tokens');
  }
});

// ─── CFO CONTROLLER — free‑form financial assistant using OpenAI ─────────────
export const cfoController = asyncHandler(async (req: Request, res: Response) => {
  const { question, context, intent } = req.body as { question: string; context: string; intent: string };

  logger.info({ path: '/api/ai/cfo', method: 'POST', hasQuestion: !!question, hasContext: !!context }, 'CFO endpoint called');

  if (!question || typeof question !== 'string') {
    logger.warn({ received: req.body }, 'CFO request missing question');
    throw new AppError(400, 'question is required');
  }

  logger.info({ intent, questionLength: question.length }, 'CFO request received');

  const SAFETY_PREAMBLE = `
Você é o CFO Virtual do Flow Finance, um assistente financeiro pessoal.

REGRAS OBRIGATÓRIAS:
1. Nunca faça garantias financeiras absolutas.
2. Use sempre linguagem consultiva: "Com base nos seus dados...", "A análise sugere...", "Considerando seu histórico..."
3. Seja direto, objetivo e em português brasileiro.
4. Respostas com no máximo 4 parágrafos curtos.
5. Quando houver risco, avise com clareza mas sem alarmismo.
6. Nunca invente dados — use APENAS o contexto fornecido.
7. Se não houver dados suficientes, diga isso claramente.
`.trim();

  const intentGuide: Record<string, string> = {
    spending_advice:     'O usuário quer saber se pode gastar. Analise o impacto no saldo projetado.',
    budget_question:     'O usuário quer entender seu orçamento. Foque nos números do mês atual e projeções.',
    risk_question:       'O usuário está preocupado com riscos. Destaque alertas e pontos de atenção.',
    savings_question:    'O usuário quer economizar. Sugira cortes com base nas categorias dominantes.',
    investment_question: 'O usuário quer investir. Avalie o saldo disponível antes de fazer sugestões.',
    general_finance:     'Responda a pergunta financeira com base nos dados disponíveis.',
  };

  const prompt = `
${SAFETY_PREAMBLE}

CONTEXTO FINANCEIRO:
${context}

TIPO DE PERGUNTA: ${intentGuide[intent] || intent}

PERGUNTA DO USUÁRIO: "${question}"

Responda de forma consultiva, personalizada e baseada exclusivamente nos dados acima.
`;

  logger.debug({ promptLength: prompt.length }, 'Calling generateContent for CFO');

  try {
    const answer = await generateContent(prompt);
    logger.info({ answerLength: answer?.length || 0 }, 'CFO response generated successfully');
    res.json({ answer });
  } catch (error: any) {
    logger.error({ 
      error: error?.message || String(error),
      errorType: error?.constructor?.name,
      stack: error?.stack,
      status: error?.status,
    }, 'CFO generation error');
    throw new AppError(500, `Failed to generate CFO response: ${error?.message || 'Unknown error'}`);
  }
});
