import type { TransactionData, ReminderData } from '../../types';
import type { AIMemory } from './aiMemory';

export function buildMemoryContextBlock(memories: AIMemory[]): string {
  if (memories.length === 0) return '';

  const lines = memories.map((memory) => `- ${memory.key}: ${memory.value} (confiança: ${Math.round(memory.confidence * 100)}%)`);

  return `
CONTEXTO DO USUÁRIO (memória aprendida):
${lines.join('\n')}
Use essas informações para melhorar a precisão da classificação.
  `.trim();
}

export function estimateInterpreterConfidence(
  data: TransactionData[] | ReminderData[],
  intent: string,
): number {
  if (!data || data.length === 0) return 0.1;

  const item = data[0];
  let score = 0.5;

  if ('amount' in item && item.amount && item.amount > 0) score += 0.15;
  if ('description' in item && item.description && item.description.length > 3) score += 0.1;
  if ('category' in item && item.category) score += 0.1;
  if (item.type) score += 0.1;
  if (intent !== 'unknown') score += 0.05;

  return Math.min(parseFloat(score.toFixed(2)), 1.0);
}

export function buildUnknownTextInterpretation(params: {
  input: string;
  memories: AIMemory[];
  processingMs: number;
  enriched: boolean;
  message: string;
  suggestion: string;
  kind?: 'ai_unavailable' | 'ai_uncertain';
  confidence?: number;
}): {
  intent: 'unknown';
  modality: 'text';
  data: [];
  confidence: number;
  memory_context_used: string[];
  raw_input: string;
  processing_ms: number;
  enriched: boolean;
  diagnostic: {
    kind: 'ai_unavailable' | 'ai_uncertain';
    message: string;
    suggestion?: string;
  };
} {
  return {
    intent: 'unknown',
    modality: 'text',
    data: [],
    confidence: params.confidence ?? 0.1,
    memory_context_used: params.memories.map((memory) => memory.key),
    raw_input: params.input,
    processing_ms: params.processingMs,
    enriched: params.enriched,
    diagnostic: {
      kind: params.kind ?? 'ai_uncertain',
      message: params.message,
      suggestion: params.suggestion,
    },
  };
}

export function buildUnknownImageInterpretation(params: {
  processingMs: number;
}): {
  intent: 'unknown';
  modality: 'image';
  data: [];
  confidence: number;
  memory_context_used: [];
  raw_input: string;
  processing_ms: number;
  enriched: false;
} {
  return {
    intent: 'unknown',
    modality: 'image',
    data: [],
    confidence: 0,
    memory_context_used: [],
    raw_input: '[image]',
    processing_ms: params.processingMs,
    enriched: false,
  };
}
