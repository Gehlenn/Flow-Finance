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
