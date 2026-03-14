/**
 * FORECAST LISTENER
 *
 * Reprocessa previsões de cashflow ao detectar transações novas ou importadas.
 */

import { subscribeToFinancialEvents } from '../eventEngine';
import { cashflowPredictionEngine } from '../../engines/finance/cashflowPrediction/cashflowPredictionEngine';
import type { FinancialEvent } from '../../../models/FinancialEvent';
import type { Transaction } from '../../../types';

const TRIGGER_TYPES: FinancialEvent['type'][] = [
  'transaction_created',
  'transactions_imported',
  'bank_transactions_synced',
];

export function registerForecastListener(): () => void {
  return subscribeToFinancialEvents((event) => {
    if (!TRIGGER_TYPES.includes(event.type)) return;

    const payload = event.payload as Record<string, unknown> | null ?? {};
    const transactions = (payload.transactions as Transaction[]) ?? [];

    if (transactions.length === 0) return;

    try {
      cashflowPredictionEngine.predict({ transactions, balance: (payload.balance as number) ?? 0 });
      console.debug(`[ForecastListener] Previsão recalculada via evento "${event.type}" (${transactions.length} transações)`);
    } catch (err) {
      console.error('[ForecastListener] Erro ao recalcular previsão:', err);
    }
  });
}
