/**
 * AI INTERPRETER — Camada 1 do pipeline de IA
 *
 * Responsabilidades:
 *   1. Receber input do usuário (texto, voz, imagem)
 *   2. Enriquecer o prompt com contexto de memória
 *   3. Invocar o modelo de linguagem
 *   4. Retornar saída estruturada com confidence score
 *   5. Logar no AI Debug
 */

import { Transaction, TransactionType } from '../../types';
import { TransactionData, ReminderData } from '../../types';

import { getAIMemory, AIMemory } from './aiMemory';
import { logAIDebug } from './aiDebugService';
import { logWarn } from '../utils/logger';
import {
  buildMemoryContextBlock,
  buildUnknownImageInterpretation,
  buildUnknownTextInterpretation,
  estimateInterpreterConfidence,
} from './aiInterpreterHelpers';

// ─── Output Types ─────────────────────────────────────────────────────────────

export type InputModality = 'text' | 'voice' | 'image';

export interface InterpreterOutput {
  intent: 'transaction' | 'reminder' | 'unknown';
  modality: InputModality;
  data: TransactionData[] | ReminderData[];
  confidence: number;
  memory_context_used: string[];
  raw_input: string;
  processing_ms: number;
  enriched: boolean; // true se a memória influenciou o resultado
  diagnostic?: {
    kind: 'ai_unavailable' | 'ai_uncertain';
    message: string;
    suggestion?: string;
  };
}

// ─── Memory context builder ───────────────────────────────────────────────────

export async function buildMemoryContext(userId: string): Promise<{
  memories: AIMemory[];
  contextBlock: string;
}> {
  const memories = await getAIMemory(userId);
  return { memories, contextBlock: buildMemoryContextBlock(memories) };
}

// ─── Confidence estimator ─────────────────────────────────────────────────────

export function estimateConfidence(data: TransactionData[] | ReminderData[], intent: string): number {
  return estimateInterpreterConfidence(data, intent);
}

// ─── Interpret Text ───────────────────────────────────────────────────────────

export async function interpretText(
  input: string,
  userId: string,
  geminiProcessFn: (text: string) => Promise<{ intent: string; data: TransactionData[] | ReminderData[] }>
): Promise<InterpreterOutput> {
  const start = Date.now();
  const { memories, contextBlock } = await buildMemoryContext(userId);
  const enriched = memories.length > 0;

  // Injeta contexto de memória no input para enriquecer o prompt
  const enrichedInput = enriched
    ? `${input}\n\n[${contextBlock}]`
    : input;

  try {
    const result = await geminiProcessFn(enrichedInput);

    // Normaliza intents inválidos para 'unknown'
    const validIntents = ['transaction', 'reminder'];
    if (!validIntents.includes(result.intent)) {
      logAIDebug({
        input,
        intent: 'unknown',
        error: 'Intent invalido retornado pelo interpretador',
        processing_ms: Date.now() - start,
      });
      return buildUnknownTextInterpretation({
        input,
        memories,
        processingMs: Date.now() - start,
        enriched,
        message: 'Nao consegui classificar esta entrada com seguranca.',
        suggestion: 'Tente descrever o lancamento com valor, data e contexto mais claros.',
      });
    }

    const confidence = estimateConfidence(result.data, result.intent);
    const processing_ms = Date.now() - start;

    const output: InterpreterOutput = {
      intent: result.intent as 'transaction' | 'reminder',
      modality: 'text',
      data: result.data,
      confidence,
      memory_context_used: memories.map(m => m.key),
      raw_input: input,
      processing_ms,
      enriched,
    };

    logAIDebug({
      input,
      intent: output.intent,
      parsed_transaction: output.intent === 'transaction' ? (output.data[0] as Partial<Transaction>) : undefined,
      predicted_category: output.intent === 'transaction' ? (output.data[0] as TransactionData | undefined)?.category : undefined,
      confidence,
      processing_ms,
      raw_response: JSON.stringify(result.data).slice(0, 500),
    });

    return output;
  } catch (error: unknown) {
    const processing_ms = Date.now() - start;
    logWarn('[AI Interpreter] Text interpretation failed; returning unknown intent', {
      userId,
      inputLength: input.length,
      error: error instanceof Error ? error.message : error,
    });
    logAIDebug({
      input,
      error: error instanceof Error ? error.message : 'Erro desconhecido no interpretador',
      processing_ms,
    });
    return buildUnknownTextInterpretation({
      input,
      memories: [],
      processingMs: processing_ms,
      enriched: false,
      kind: 'ai_unavailable',
      confidence: 0,
      message: 'A IA de entrada falhou ao processar este texto.',
      suggestion: 'Tente novamente ou use o modo manual para registrar o lancamento.',
    });
  }
}

// ─── Interpret Image ──────────────────────────────────────────────────────────

export async function interpretImage(
  base64: string,
  mimeType: string,
  hint: string,
  userId: string,
  geminiImageFn: (b: string, m: string, t?: string) => Promise<TransactionData[]>
): Promise<InterpreterOutput> {
  const start = Date.now();
  const { memories, contextBlock } = await buildMemoryContext(userId);
  const enriched = memories.length > 0;
  const enrichedHint = enriched ? `${hint}\n${contextBlock}` : hint;

  try {
    const data = await geminiImageFn(base64, mimeType, enrichedHint);
    const confidence = estimateConfidence(data, 'transaction');
    const processing_ms = Date.now() - start;

    logAIDebug({
      input: `[imagem] ${hint || ''}`,
      intent: 'transaction',
      parsed_transaction: data[0] as Partial<Transaction>,
      predicted_category: (data[0] as TransactionData | undefined)?.category,
      confidence,
      processing_ms,
    });

    return {
      intent: 'transaction',
      modality: 'image',
      data,
      confidence,
      memory_context_used: memories.map(m => m.key),
      raw_input: `[image:${mimeType}]`,
      processing_ms,
      enriched,
    };
  } catch (error: unknown) {
    logWarn('[AI Interpreter] Image interpretation failed; returning unknown intent', {
      userId,
      mimeType,
      hintLength: hint?.length ?? 0,
      error: error instanceof Error ? error.message : error,
    });
    logAIDebug({
      input: '[imagem]',
      error: error instanceof Error ? error.message : String(error ?? 'unknown-error'),
      processing_ms: Date.now() - start,
    });
    return buildUnknownImageInterpretation({
      processingMs: Date.now() - start,
    });
  }
}
