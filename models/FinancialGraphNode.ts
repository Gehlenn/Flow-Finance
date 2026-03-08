/**
 * FINANCIAL GRAPH NODE — src/models/FinancialGraphNode.ts
 *
 * Represents a vertex in the Financial Intelligence Graph.
 * Nodes model real-world financial entities: users, accounts,
 * transactions, merchants, categories, and subscriptions.
 */

export type FinancialGraphNodeType =
  | 'user'
  | 'account'
  | 'transaction'
  | 'merchant'
  | 'category'
  | 'subscription';

export interface FinancialGraphNode {
  id:        string;
  type:      FinancialGraphNodeType;
  label:     string;
  metadata?: FinancialGraphNodeMetadata;
}

// ─── Per-type metadata shapes ─────────────────────────────────────────────────

export interface UserNodeMeta {
  user_id: string;
}

export interface AccountNodeMeta {
  account_id: string;
  account_type: string;
  balance: number;
  currency: string;
}

export interface TransactionNodeMeta {
  transaction_id: string;
  amount: number;
  type: 'Receita' | 'Despesa';
  date: string;
  category: string;
  merchant?: string;
  source?: string;
}

export interface MerchantNodeMeta {
  name: string;
  total_spent: number;
  visit_count: number;
  avg_amount: number;
  last_seen: string;
  category_hint?: string;
}

export interface CategoryNodeMeta {
  name: string;
  total_amount: number;
  transaction_count: number;
  percentage_of_total: number;
  trend: 'up' | 'down' | 'stable';
}

export interface SubscriptionNodeMeta {
  name: string;
  amount: number;
  cycle: string;
  last_charge: string;
  next_expected: string | null;
  total_spent: number;
  logo: string;
}

export type FinancialGraphNodeMetadata =
  | UserNodeMeta
  | AccountNodeMeta
  | TransactionNodeMeta
  | MerchantNodeMeta
  | CategoryNodeMeta
  | SubscriptionNodeMeta
  | Record<string, unknown>;
