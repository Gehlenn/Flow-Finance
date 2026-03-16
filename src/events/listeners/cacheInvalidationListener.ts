/**
 * CACHE INVALIDATION LISTENER
 *
 * Observa mutações financeiras e invalida as entradas de cache relevantes
 * para garantir que nenhuma leitura retorne dados stale.
 */

import { subscribeToFinancialEvents } from '../eventEngine';
import { financialCache } from '../../cache/financialCache';
import type { FinancialEvent } from '../../../models/FinancialEvent';

type InvalidationRule = {
  eventType: FinancialEvent['type'];
  prefixes: string[];
};

const INVALIDATION_RULES: InvalidationRule[] = [
  {
    eventType: 'transaction_created',
    prefixes: ['cashflow:', 'moneymap:', 'forecast:', 'analytics:'],
  },
  {
    eventType: 'transactions_imported',
    prefixes: ['cashflow:', 'moneymap:', 'forecast:', 'analytics:'],
  },
  {
    eventType: 'bank_transactions_synced',
    prefixes: ['cashflow:', 'moneymap:', 'forecast:', 'analytics:'],
  },
  {
    eventType: 'recurring_generated',
    prefixes: ['forecast:', 'cashflow:'],
  },
  {
    eventType: 'goal_created',
    prefixes: ['goals:'],
  },
  {
    eventType: 'risk_detected',
    prefixes: ['analytics:'],
  },
];

export function registerCacheInvalidationListener(): () => void {
  return subscribeToFinancialEvents((event) => {
    const rules = INVALIDATION_RULES.filter((r) => r.eventType === event.type);
    if (rules.length === 0) return;

    const allPrefixes = new Set(rules.flatMap((r) => r.prefixes));
    allPrefixes.forEach((prefix) => {
      const invalidated = financialCache.invalidateByPrefix(prefix);
      if (invalidated > 0) {
        console.debug(`[CacheInvalidationListener] ${invalidated} entrada(s) invalidada(s) para prefixo "${prefix}" via evento "${event.type}"`);
      }
    });
  });
}
