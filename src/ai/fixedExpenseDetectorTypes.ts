import { Transaction } from '../../types';

export type FixedExpenseCategory =
  | 'housing'
  | 'utilities'
  | 'subscription'
  | 'insurance'
  | 'education'
  | 'fitness'
  | 'transport'
  | 'financing'
  | 'other_fixed';

export interface FixedExpense {
  id: string;
  name: string;
  category: FixedExpenseCategory;
  amount: number;
  amount_min: number;
  amount_max: number;
  amount_trend: 'increasing' | 'stable' | 'decreasing';
  day_of_month: number | null;
  occurrences: number;
  last_date: string;
  next_expected: string | null;
  confidence: number;
  logo: string;
  transactions: Transaction[];
}

export interface FixedExpenseReport {
  expenses: FixedExpense[];
  total_monthly: number;
  total_annual: number;
  by_category: Record<FixedExpenseCategory, number>;
  commitment_ratio?: number;
  highest_expense: FixedExpense | null;
  count: number;
  has_housing: boolean;
  has_insurance: boolean;
}

export interface ExpensePattern {
  name: string;
  keywords: string[];
  category: FixedExpenseCategory;
  logo: string;
  min_amount?: number;
}
