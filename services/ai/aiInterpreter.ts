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

// Local type definitions
interface TransactionData {
  amount: number;
  description: string;
  category: any;
  type: any;
}

interface ReminderData {
  title: string;
  date?: string;
  type: string;
  amount?: number;
  priority: string;
}
import { getAIMemory, AIMemory } from './aiMemory';
import { logAIDebug } from './aiDebugService';

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
}

// ─── Memory context builder ───────────────────────────────────────────────────

export async function buildMemoryContext(userId: string): Promise<{
  memories: AIMemory[];
  contextBlock: string;
}> {
  const memories = await getAIMemory(userId);
  if (memories.length === 0) return { memories: [], contextBlock: '' };

  const lines = memories.map(m =>
    `- ${m.key}: ${m.value} (confiança: ${Math.round(m.confidence * 100)}%)`
  );

  const contextBlock = `
CONTEXTO DO USUÁRIO (memória aprendida):
${lines.join('\n')}
Use essas informações para melhorar a precisão da classificação.
  `.trim();

  return { memories, contextBlock };
}

// ─── Confidence estimator ─────────────────────────────────────────────────────

export function estimateConfidence(data: TransactionData[] | ReminderData[], intent: string): number {
  if (!data || data.length === 0) return 0.1;
  const item = data[0];
  let score = 0.5;
  if (item.amount && item.amount > 0) score += 0.15;
  if (item.description && item.description.length > 3) score += 0.1;
  if (item.category) score += 0.1;
  if (item.type) score += 0.1;
  if (intent !== 'unknown') score += 0.05;
  return Math.min(parseFloat(score.toFixed(2)), 1.0);
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
      parsed_transaction: output.intent === 'transaction' ? output.data[0] : undefined,
      predicted_category: output.data[0]?.category,
      confidence,
      processing_ms,
      raw_response: JSON.stringify(result.data).slice(0, 500),
    });

    return output;
  } catch (err: any) {
    const processing_ms = Date.now() - start;
    logAIDebug({
      input,
      error: err?.message || 'Erro desconhecido no interpretador',
      processing_ms,
    });
    return {
      intent: 'unknown',
      modality: 'text',
      data: [],
      confidence: 0,
      memory_context_used: [],
      raw_input: input,
      processing_ms,
      enriched: false,
    };
  }
}

// ─── Interpret Image ──────────────────────────────────────────────────────────

export async function interpretImage(
  base64: string,
  mimeType: string,
  hint: string,
  userId: string,
  geminiImageFn: (b: string, m: string, t?: string) => Promise<any[]>
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
      parsed_transaction: data[0],
      predicted_category: data[0]?.category,
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
  } catch (err: any) {
    logAIDebug({ input: '[imagem]', error: err?.message, processing_ms: Date.now() - start });
    return {
      intent: 'unknown', modality: 'image', data: [], confidence: 0,
      memory_context_used: [], raw_input: '[image]', processing_ms: Date.now() - start, enriched: false,
    };
  }
}
