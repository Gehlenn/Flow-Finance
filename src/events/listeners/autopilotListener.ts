/**
 * AUTOPILOT LISTENER
 *
 * Observa eventos financeiros e dispara análise do FinancialAutopilot
 * quando uma transação é criada ou importada.
 */

import { subscribeToFinancialEvents } from '../eventEngine';
import { FinancialAutopilot } from '../../engines/autopilot/financialAutopilot';
import type { FinancialEvent } from '../../../models/FinancialEvent';

const autopilot = new FinancialAutopilot();

const TRIGGER_TYPES: FinancialEvent['type'][] = [
  'transaction_created',
  'transactions_imported',
  'bank_transactions_synced',
];

export function registerAutopilotListener(): () => void {
  return subscribeToFinancialEvents((event) => {
    if (!TRIGGER_TYPES.includes(event.type)) return;

    const payload = event.payload as Record<string, unknown> | null ?? {};
    const alerts = autopilot.analyze({
      monthlyExpenses: (payload.monthlyExpenses as number) ?? 0,
      monthlyIncome:   (payload.monthlyIncome   as number) ?? 0,
      currentBalance:  (payload.currentBalance  as number) ?? 0,
      userId:          payload.userId as string | undefined,
    });

    if (alerts.length > 0) {
      console.info(`[AutopilotListener] ${alerts.length} alerta(s) gerado(s) via evento "${event.type}"`);
    }
  });
}
