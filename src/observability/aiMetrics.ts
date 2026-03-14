/**
 * AI METRICS — Buffer circular para observabilidade de chamadas de IA.
 *
 * Grava até MAX_ENTRIES por tipo de métrica.
 * API pública:
 *   recordAIMetric(type, value, meta?)
 *   getAIMetrics(type?)                  → AIMetricEntry[]
 *   getAIMetricsSummary()                → AIMetricsSummary
 *   clearAIMetrics()
 */

export type AIMetricType =
  | 'ai_call'
  | 'ai_error'
  | 'ai_latency'
  | 'cache_hit'
  | 'cache_miss'
  | 'event_processed';

export interface AIMetricEntry {
  type: AIMetricType;
  value: number;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface AIMetricsSummary {
  ai_calls:         number;
  ai_errors:        number;
  avg_latency_ms:   number;
  cache_hit_rate:    number;
  events_processed: number;
  recorded_at:      string;
}

const MAX_ENTRIES = 200;

const buffers = new Map<AIMetricType, AIMetricEntry[]>();

function getBuffer(type: AIMetricType): AIMetricEntry[] {
  if (!buffers.has(type)) buffers.set(type, []);
  return buffers.get(type)!;
}

/**
 * Grava uma entrada de métrica. Se o buffer estiver cheio, a entrada mais antiga é descartada.
 */
export function recordAIMetric(
  type: AIMetricType,
  value: number,
  meta?: Record<string, unknown>,
): void {
  const buf = getBuffer(type);
  const entry: AIMetricEntry = { type, value, timestamp: new Date().toISOString(), meta };
  buf.push(entry);
  if (buf.length > MAX_ENTRIES) buf.shift();
}

/**
 * Retorna todas as entradas gravadas.
 * @param type — se fornecido, filtra pelo tipo. Caso contrário retorna todos.
 */
export function getAIMetrics(type?: AIMetricType): AIMetricEntry[] {
  if (type) return [...(buffers.get(type) ?? [])];
  return Array.from(buffers.values()).flat();
}

/**
 * Retorna um resumo agregado de todas as métricas.
 */
export function getAIMetricsSummary(): AIMetricsSummary {
  const calls   = getBuffer('ai_call').length;
  const errors  = getBuffer('ai_error').length;
  const latencies = getBuffer('ai_latency').map((e) => e.value);
  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;

  const hits   = getBuffer('cache_hit').length;
  const misses = getBuffer('cache_miss').length;
  const total  = hits + misses;
  const hitRate = total > 0 ? hits / total : 0;

  return {
    ai_calls:         calls,
    ai_errors:        errors,
    avg_latency_ms:   Math.round(avgLatency),
    cache_hit_rate:    Number(hitRate.toFixed(4)),
    events_processed: getBuffer('event_processed').length,
    recorded_at:      new Date().toISOString(),
  };
}

/**
 * Apaga todos os buffers de métricas.
 */
export function clearAIMetrics(): void {
  buffers.clear();
}
