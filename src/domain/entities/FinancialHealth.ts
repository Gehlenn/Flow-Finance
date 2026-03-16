export interface FinancialHealth {
  userId: string;
  score: number;
  status: 'saudavel' | 'atencao' | 'critico';
  alerts: string[];
  computedAt: Date;
}
