export type FinancialSignalKind =
  | 'cash_warning'
  | 'expense_pattern'
  | 'projected_gap'
  | 'fixed_expense_detected'
  | 'subscription_detected'
  | 'opportunity';

export type FinancialSignalSeverity = 'info' | 'attention' | 'urgent';

export interface FinancialSignal {
  id: string;
  kind: FinancialSignalKind;
  severity: FinancialSignalSeverity;
  title: string;
  description: string;
  suggestedAction?: string;
  evidence: Record<string, unknown>;
  computed_at: string;
}
