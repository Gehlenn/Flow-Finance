/**
 * TESTES — financialCache + aiMetrics + event listeners
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── financialCache ───────────────────────────────────────────────────────────

describe('financialCache', () => {
  let financialCache: typeof import('../../src/cache/financialCache').financialCache;

  beforeEach(async () => {
    // Re-import to get a fresh singleton state... we can only reset via clear()
    const mod = await import('../../src/cache/financialCache');
    financialCache = mod.financialCache;
    financialCache.clear();
  });

  it('set e get retorna o valor antes do TTL expirar', () => {
    financialCache.set('key1', 42, 5000);
    expect(financialCache.get<number>('key1')).toBe(42);
  });

  it('get retorna undefined para chave inexistente', () => {
    expect(financialCache.get('nao-existe')).toBeUndefined();
  });

  it('get retorna undefined após TTL expirar', () => {
    vi.useFakeTimers();
    financialCache.set('exp', 'valor', 100);
    vi.advanceTimersByTime(200);
    expect(financialCache.get('exp')).toBeUndefined();
    vi.useRealTimers();
  });

  it('invalidate remove entrada específica', () => {
    financialCache.set('x', 1);
    expect(financialCache.invalidate('x')).toBe(true);
    expect(financialCache.get('x')).toBeUndefined();
  });

  it('invalidate retorna false para chave inexistente', () => {
    expect(financialCache.invalidate('ghost')).toBe(false);
  });

  it('invalidateByPrefix remove apenas entradas com prefixo', () => {
    financialCache.set('cashflow:a', 1);
    financialCache.set('cashflow:b', 2);
    financialCache.set('forecast:x', 3);

    const removed = financialCache.invalidateByPrefix('cashflow:');
    expect(removed).toBe(2);
    expect(financialCache.get('cashflow:a')).toBeUndefined();
    expect(financialCache.get('cashflow:b')).toBeUndefined();
    expect(financialCache.get<number>('forecast:x')).toBe(3);
  });

  it('invalidateByPrefix retorna 0 se nenhuma chave coincidir', () => {
    financialCache.set('other:key', 99);
    expect(financialCache.invalidateByPrefix('cashflow:')).toBe(0);
  });

  it('clear remove todas as entradas', () => {
    financialCache.set('a', 1);
    financialCache.set('b', 2);
    financialCache.clear();
    expect(financialCache.size()).toBe(0);
  });

  it('size reporta contagem correta', () => {
    financialCache.set('p', 1);
    financialCache.set('q', 2);
    expect(financialCache.size()).toBe(2);
  });
});

// ─── aiMetrics ───────────────────────────────────────────────────────────────

describe('aiMetrics', () => {
  let mod: typeof import('../../src/observability/aiMetrics');

  beforeEach(async () => {
    mod = await import('../../src/observability/aiMetrics');
    mod.clearAIMetrics();
  });

  it('recordAIMetric e getAIMetrics retornam entrada gravada', () => {
    mod.recordAIMetric('ai_call', 1);
    const entries = mod.getAIMetrics('ai_call');
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('ai_call');
    expect(entries[0].value).toBe(1);
  });

  it('getAIMetrics sem filtro retorna todos os tipos', () => {
    mod.recordAIMetric('ai_call', 1);
    mod.recordAIMetric('ai_error', 1);
    const all = mod.getAIMetrics();
    expect(all.length).toBe(2);
  });

  it('buffer circular não excede MAX_ENTRIES (200)', () => {
    for (let i = 0; i < 210; i++) mod.recordAIMetric('ai_call', i);
    expect(mod.getAIMetrics('ai_call').length).toBe(200);
  });

  it('getAIMetricsSummary agrega valores corretamente', () => {
    mod.recordAIMetric('ai_call', 1);
    mod.recordAIMetric('ai_call', 1);
    mod.recordAIMetric('ai_error', 1);
    mod.recordAIMetric('ai_latency', 100);
    mod.recordAIMetric('ai_latency', 200);
    mod.recordAIMetric('cache_hit', 1);
    mod.recordAIMetric('cache_miss', 1);
    mod.recordAIMetric('event_processed', 1);

    const s = mod.getAIMetricsSummary();
    expect(s.ai_calls).toBe(2);
    expect(s.ai_errors).toBe(1);
    expect(s.avg_latency_ms).toBe(150);
    expect(s.cache_hit_rate).toBe(0.5);
    expect(s.events_processed).toBe(1);
  });

  it('getAIMetricsSummary com buffers vazios retorna zeros', () => {
    const s = mod.getAIMetricsSummary();
    expect(s.ai_calls).toBe(0);
    expect(s.ai_errors).toBe(0);
    expect(s.avg_latency_ms).toBe(0);
    expect(s.cache_hit_rate).toBe(0);
    expect(s.events_processed).toBe(0);
  });

  it('clearAIMetrics apaga todos os buffers', () => {
    mod.recordAIMetric('ai_call', 1);
    mod.clearAIMetrics();
    expect(mod.getAIMetrics()).toHaveLength(0);
  });

  it('meta é persistida na entrada', () => {
    mod.recordAIMetric('ai_call', 1, { model: 'gemini-2.0-flash' });
    const entries = mod.getAIMetrics('ai_call');
    expect(entries[0].meta).toEqual({ model: 'gemini-2.0-flash' });
  });
});

// ─── cacheInvalidationListener ───────────────────────────────────────────────

describe('cacheInvalidationListener', () => {
  it('invalida prefixo cashflow ao emitir transaction_created', async () => {
    const { financialCache } = await import('../../src/cache/financialCache');
    const { registerCacheInvalidationListener } = await import('../../src/events/listeners/cacheInvalidationListener');
    const { emitFinancialEvent } = await import('../../src/events/eventEngine');

    financialCache.clear();
    financialCache.set('cashflow:user1', { total: 100 });
    financialCache.set('other:key', 99);

    const cleanup = registerCacheInvalidationListener();
    emitFinancialEvent({ type: 'transaction_created', payload: {} });
    cleanup();

    expect(financialCache.get('cashflow:user1')).toBeUndefined();
    expect(financialCache.get<number>('other:key')).toBe(99);
  });
});

// ─── auditListener ───────────────────────────────────────────────────────────

describe('auditListener', () => {
  it('chama logAuditEvent para cada evento emitido', async () => {
    const auditMod = await import('../../src/security/auditLogService');
    const spy = vi.spyOn(auditMod, 'logAuditEvent');

    const { registerAuditListener } = await import('../../src/events/listeners/auditListener');
    const { emitFinancialEvent } = await import('../../src/events/eventEngine');

    const cleanup = registerAuditListener();
    emitFinancialEvent({ type: 'goal_created', payload: { id: 'g1' } });
    cleanup();

    expect(spy).toHaveBeenCalledWith(
      'goal_created',
      'financial_event',
      'g1',
      expect.objectContaining({ source: 'event_bus' }),
    );
    spy.mockRestore();
  });
});

// ─── registerListeners (smoke test) ──────────────────────────────────────────

describe('registerEventListeners', () => {
  it('retorna função de cleanup sem lançar exceção', async () => {
    const { registerEventListeners } = await import('../../src/events/listeners/registerListeners');
    const cleanup = registerEventListeners();
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });
});
