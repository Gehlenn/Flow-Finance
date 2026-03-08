export type FinancialEventType =
  | 'transaction_created'
  | 'recurring_generated'
  | 'insight_generated'
  | 'risk_detected'
  | 'autopilot_action'
  | 'goal_created'
  | 'transactions_imported'
  | 'bank_transactions_synced';

export interface FinancialEvent {
  id: string;
  type: FinancialEventType;
  payload: unknown;
  created_at: string;
}
