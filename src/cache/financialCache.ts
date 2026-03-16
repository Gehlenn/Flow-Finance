/**
 * FINANCIAL CACHE
 *
 * Cache Map-based com TTL por entrada.
 * Suporta invalidação individual e por prefixo de chave.
 *
 * API:
 *   financialCache.get(key)
 *   financialCache.set(key, value, ttlMs?)
 *   financialCache.invalidate(key)
 *   financialCache.invalidateByPrefix(prefix) → number (invalidated count)
 *   financialCache.clear()
 *   financialCache.size() → number
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // ms epoch; Infinity = sem expiração
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos

class FinancialCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
    this.store.set(key, {
      value,
      expiresAt: ttlMs === Infinity ? Infinity : Date.now() + ttlMs,
    });
  }

  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Remove todas as entradas cujas chaves começam com `prefix`.
   * @returns Número de entradas removidas.
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    // Não descarta entradas expiradas aqui — apenas conta as armazenadas
    return this.store.size;
  }
}

export const financialCache = new FinancialCache();
export type { FinancialCache };
