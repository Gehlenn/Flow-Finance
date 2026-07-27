import type { Category, TransactionType } from '../../types';

export type ImportFormat = 'ofx' | 'csv' | 'pdf' | 'unknown';

export interface ImportedTransaction {
  raw_date: string;
  raw_amount: number;
  raw_description: string;
  raw_type?: TransactionType;
  category?: Category;
  merchant?: string;
  type?: TransactionType;
  confidence?: number;
  selected: boolean;
  duplicate?: boolean;
}
