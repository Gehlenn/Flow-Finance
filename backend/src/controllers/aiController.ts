import { Request, Response } from 'express';
import { generateContent, estimateTokens } from '../config/ai';
// AI provider with automatic fallback (OpenAI → Gemini)

import logger from '../config/logger';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { safeJsonParse, validateAIResponse } from '../utils/jsonHelpers';
import { validatePromptInput, getSafeBlockedResponse } from '../services/ai/PromptInjectionGuard';
import { buildCfoPrompt, buildInsightsFallbackResponse, buildInterpretFallbackResponse, normalizeCFORequestInput } from './aiControllerHelpers';
export { normalizeCFORequestInput, summarizeConfidenceSummary } from './aiControllerHelpers';
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

type RequestAIContext = {
  workspaceId?: string;
  requestId?: string;
  userId?: string;
};

function getAIRequestContext(req: Request): RequestAIContext {
  const contextReq = req as Request & { workspaceId?: string; requestId?: string };
  return {
    workspaceId: contextReq.workspaceId,
    requestId: contextReq.requestId,
    userId: req.userId,
  };
}

function setAIResponseHeaders(res: Response, result: Awaited<ReturnType<typeof generateContent>>): void {
  res.setHeader('x-ai-provider', result.provider);
  res.setHeader('x-ai-model', result.model);
  res.setHeader('x-ai-input-tokens', String(result.inputTokens));
  res.setHeader('x-ai-output-tokens', String(result.outputTokens));
  res.setHeader('x-ai-total-tokens', String(result.tokensUsed));
  res.setHeader('x-ai-estimated-cost-usd', String(result.estimatedCostUsd));
  res.setHeader('x-ai-cost-evidence', result.costEvidence);
  res.setHeader('x-ai-workspace-id', result.workspaceId ?? '');
  if (result.latencyMs !== undefined) {
    res.setHeader('x-ai-latency-ms', String(result.latencyMs));
  }
}

// ─── INTERPRET — Parse smart input (text → transactions/reminders) ─────────────

export const interpretController = asyncHandler(async (req: Request, res: Response) => {
  const { text, memoryContext } = req.body as InterpretRequest;
  const aiRequestContext = getAIRequestContext(req);

  if (!text || text.trim().length === 0) {
    throw new AppError(400, 'Text is required');
  }

  // Prompt injection guard
  const guardResult = validatePromptInput(text);
  if (guardResult.level === 'block') {
    logger.warn(
      { riskScore: guardResult.riskScore, reasons: guardResult.reasons, userId: req.userId },
      'Interpret request blocked by PromptInjectionGuard'
    );
    res.status(400).json(buildInterpretFallbackResponse());
    return;
  }

  const sanitizedText = guardResult.sanitizedInput;
  logger.debug({ userId: req.userId, textLength: sanitizedText.length }, 'Interpret request');

  const prompt = `Aja como assistente de caixa operacional do Flow Finance para empresas de servico.
Analise o texto: "${sanitizedText}".
${memoryContext ? `\nContexto do usuário: ${memoryContext}` : ''}

Regras de categoria:
- 'Operacao': custos recorrentes do servico, equipe, ferramentas, fornecedores
- 'Receita': recebimentos confirmados, contratos, servicos prestados
- 'Recebivel': valor previsto ou pendente que ainda nao entrou no caixa
- 'Imposto': tributos, taxas e obrigacoes fiscais
- 'Investimento operacional': compra ou melhoria necessaria para entregar o servico

Responda em JSON estruturado conforme o schema.`;

  try {
    const result = await generateContent(prompt, {
      responseMimeType: 'application/json',
    }, {
      operation: 'interpret',
      source: 'aiController',
      requestId: aiRequestContext.requestId,
      workspaceId: aiRequestContext.workspaceId,
      userId: aiRequestContext.userId,
    });

    const parsed = safeJsonParse(result.content, 'interpret');
    validateAIResponse(parsed, ['intent'], 'interpret');
    const parsedRecord = parsed as {
      intent?: unknown;
      transactions?: TransactionData[];
      reminders?: ReminderData[];
    };
    const intent = parsedRecord.intent === 'reminder' ? 'reminder' : 'transaction';

    const response: InterpretResponse = {
      intent,
      data: intent === 'transaction'
        ? (parsedRecord.transactions || [] as TransactionData[])
        : (parsedRecord.reminders || [] as ReminderData[])
    };

    setAIResponseHeaders(res, result);
    res.json(response);
  } catch (error) {
    logger.warn({
      error,
      userId: req.userId,
      textLength: sanitizedText.length,
      fallback: 'interpret-empty',
    }, 'Interpret unavailable, returning fallback response');
    res.json(buildInterpretFallbackResponse());
  }
});

// ─── SCAN RECEIPT — OCR document parsing ───────────────────────────────────────

export const scanReceiptController = asyncHandler(async (req: Request, res: Response) => {
  const { imageBase64, imageMimeType, context } = req.body as ScanReceiptRequest;
  const aiRequestContext = getAIRequestContext(req);

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
    const result = await generateContent(prompt, undefined, {
      operation: 'scan_receipt',
      source: 'aiController',
      requestId: aiRequestContext.requestId,
      workspaceId: aiRequestContext.workspaceId,
      userId: aiRequestContext.userId,
    });
    const parsed = safeJsonParse<ReceiptScanResult>(result.content, 'scan-receipt');
    const response: ScanReceiptResponse = parsed;
    setAIResponseHeaders(res, result);
    res.json(response);
  } catch (error) {
    logger.error({
      error,
      userId: req.userId,
      fallback: 'scan-receipt-failed',
    }, 'Scan receipt error');
    throw new AppError(500, 'Failed to scan receipt', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ─── CLASSIFY TRANSACTIONS ────────────────────────────────────────────────────

export const classifyTransactionsController = asyncHandler(async (req: Request, res: Response) => {
  const { transactions } = req.body as ClassifyTransactionsRequest;
  const aiRequestContext = getAIRequestContext(req);

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
    const result = await generateContent(prompt, undefined, {
      operation: 'classify_transactions',
      source: 'aiController',
      requestId: aiRequestContext.requestId,
      workspaceId: aiRequestContext.workspaceId,
      userId: aiRequestContext.userId,
    });
    const parsed = safeJsonParse<TransactionClassification[]>(result.content, 'classify-transactions');
    const response: ClassifyTransactionsResponse = parsed;
    setAIResponseHeaders(res, result);
    res.json(response);
  } catch (error) {
    logger.error({
      error,
      userId: req.userId,
      count: transactions.length,
      fallback: 'classify-transactions-failed',
    }, 'Classify transactions error');
    throw new AppError(500, 'Failed to classify transactions');
  }
});

// ─── INSIGHTS — Generate financial insights ──────────────────────────────────

export const generateInsightsController = asyncHandler(async (req: Request, res: Response) => {
  const { transactions, type } = req.body as GenerateInsightsRequest;
  const aiRequestContext = getAIRequestContext(req);

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
    : `Analise estas transacoes e gere uma leitura semanal de caixa operacional:
${JSON.stringify(transactions, null, 2)}

Estruture em:
1. Resumo de caixa
2. Previsto vs realizado
3. Recebiveis pendentes ou vencidos
4. Riscos da semana
5. Proxima acao operacional

Responda em JSON estruturado.`;

  try {
    const result = await generateContent(prompt, undefined, {
      operation: type === 'daily' ? 'generate_insights_daily' : 'generate_insights_strategic',
      source: 'aiController',
      requestId: aiRequestContext.requestId,
      workspaceId: aiRequestContext.workspaceId,
      userId: aiRequestContext.userId,
    });
    const parsed = safeJsonParse(result.content, `insights-${type}`);

    let response: GenerateInsightsResponse;
    if (type === 'daily') {
      response = { insights: parsed as DailyInsight[] };
    } else {
      response = { report: parsed as StrategicReport };
    }

    setAIResponseHeaders(res, result);
    res.json(response);
  } catch (error) {
    logger.warn({
      error,
      userId: req.userId,
      type,
      transactionCount: transactions.length,
      fallback: type === 'daily' ? 'daily-empty' : 'strategic-empty',
    }, 'Generate insights unavailable, returning fallback response');
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
    logger.error({
      error,
      userId: req.userId,
      textLength: text.length,
      fallback: 'token-count-failed',
    }, 'Token count error');
    throw new AppError(500, 'Failed to count tokens');
  }
});

// ─── CFO CONTROLLER — free‑form financial assistant using OpenAI ─────────────
const CFO_FALLBACK_ANSWER = 'Nao consegui gerar a resposta consultiva agora. Verifique a sessao e tente novamente em alguns instantes.';
const CFO_FALLBACK_DIAGNOSTIC = {
  kind: 'ai_unavailable',
  message: 'A geracao da resposta consultiva falhou antes de concluir a analise.',
  suggestion: 'Use os valores confirmados do dashboard para decidir agora e tente novamente em alguns instantes.',
} as const;

export const cfoController = asyncHandler(async (req: Request, res: Response) => {
  const { question, context, intent } = normalizeCFORequestInput(req.body as {
    question?: unknown;
    context?: unknown;
    intent?: unknown;
  });
  const aiRequestContext = getAIRequestContext(req);

  // Prompt injection guard — camada de proteção antes de chamar o LLM
  const guardResult = validatePromptInput(question);
  if (guardResult.level === 'block') {
    logger.warn(
      { riskScore: guardResult.riskScore, reasons: guardResult.reasons, userId: req.userId },
      'CFO request blocked by PromptInjectionGuard'
    );
    res.status(400).json({ answer: getSafeBlockedResponse() });
    return;
  }
  if (guardResult.level === 'review') {
    logger.info(
      { riskScore: guardResult.riskScore, reasons: guardResult.reasons, userId: req.userId },
      'CFO request flagged for review by PromptInjectionGuard — proceeding with sanitized input'
    );
  }

  // Use sanitized input going forward
  const sanitizedQuestion = guardResult.sanitizedInput;

  logger.info({ path: '/api/ai/cfo', method: 'POST', hasQuestion: true, hasContext: context.length > 0 }, 'CFO endpoint called');

  logger.info({ intent, questionLength: sanitizedQuestion.length }, 'CFO request received');

  const prompt = buildCfoPrompt({
    context,
    intent,
    question: sanitizedQuestion,
  });

  logger.debug({ promptLength: prompt.length }, 'Calling generateContent for CFO');

  try {
    const answer = await generateContent(prompt, undefined, {
      operation: 'cfo_answer',
      source: 'aiController',
      requestId: aiRequestContext.requestId,
      workspaceId: aiRequestContext.workspaceId,
      userId: aiRequestContext.userId,
    });
    logger.info({ answerLength: answer.content?.length || 0, workspaceId: aiRequestContext.workspaceId ?? null }, 'CFO response generated successfully');
    setAIResponseHeaders(res, answer);
    res.json({ answer: answer.content });
  } catch (error: unknown) {
    const normalizedError = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
    logger.error({
      event: 'ai_cfo_request_failed',
      error: normalizedError.message,
      errorType: normalizedError.constructor.name,
      status: (error as { status?: number } | null | undefined)?.status,
      userId: req.userId,
      path: req.path,
      hasContext: context.length > 0,
      questionLength: sanitizedQuestion.length,
      contextLength: context.length,
      intent,
      fallback: 'cfo-fallback-answer',
    }, 'CFO generation error; returning fallback answer');
    res.json({
      answer: CFO_FALLBACK_ANSWER,
      response_depth: 'reduced',
      diagnostic: CFO_FALLBACK_DIAGNOSTIC,
      explainability: {
        reasons_used: ['Fallback operacional da IA', 'Resposta consultiva nao foi gerada pelo provedor'],
        evidence: {
          data_quality_note: 'O backend retornou fallback depois de erro do provedor.',
          base_sufficiency: context.length > 0 ? 'strong' : 'limited',
        },
        confidence_band: 'low',
      },
    });
  }
});
