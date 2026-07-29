export interface FinancialPattern {
  id: string;
  type:
    | 'weekend_spending'
    | 'frequent_merchant'
    | 'salary_day'
    | 'delivery_pattern'
    | 'category_preference';
  value: string;
  confidence: number;
  updated_at: string;
}
