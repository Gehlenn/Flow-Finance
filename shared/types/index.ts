// Centralização dos tipos compartilhados Flow Finance
// Todos os tipos, enums e interfaces padronizados para uso frontend/backend

// ─── TRANSACTIONS ───────────────────────────────────────────────────────────
export type TransactionType = 'Receita' | 'Despesa';
export type CategoryType = 'Pessoal' | 'Trabalho' | 'Negócio' | 'Investimento';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: CategoryType;
  description: string;
  date: string; // ISO
  accountId?: string;
  merchant?: string;
  paymentMethod?: 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'transfer';
  source?: 'manual' | 'ai_text' | 'ai_image' | 'import';
  confidenceScore?: number;
  receiptImage?: string;
  recurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'monthly';
  recurrenceInterval?: number;
  generated?: boolean;
}

// ─── ACCOUNTS ───────────────────────────────────────────────────────────────
export type AccountType = 'bank' | 'cash' | 'credit_card' | 'investment';
export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  createdAt: string;
}

// ─── BANK CONNECTIONS ───────────────────────────────────────────────────────
export type ConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error';
export type BankProvider = 'mock' | 'pluggy' | 'belvo' | 'truelayer' | 'custom';
export interface BankConnection {
  id: string;
  userId: string;
  bankName: string;
  provider: BankProvider;
  connectionStatus: ConnectionStatus;
  externalAccountId?: string;
  accountType?: 'checking' | 'savings' | 'credit' | 'investment';
  balance?: number;
  lastSync?: string;
  errorMessage?: string;
  createdAt: string;
}

// ─── GOALS ──────────────────────────────────────────────────────────────────
export type GoalStatus = 'on_track' | 'at_risk' | 'completed' | 'overdue';
export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  category?: CategoryType;
  color?: string;
  icon?: string;
  createdAt: string;
}

// ─── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  merchant: string;
  cycle: 'monthly' | 'yearly' | 'unknown';
  occurrences: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── FINANCIAL EVENTS ───────────────────────────────────────────────────────
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
  createdAt: string;
}

// ─── GRAPH ─────────────────────────────────────────────────────────────────
export type FinancialGraphNodeType =
  | 'user'
  | 'account'
  | 'transaction'
  | 'merchant'
  | 'category'
  | 'subscription';
export interface FinancialGraphNode {
  id: string;
  type: FinancialGraphNodeType;
  label: string;
  metadata?: Record<string, unknown>;
}
export type FinancialGraphRelation =
  | 'owns'
  | 'has_transaction'
  | 'paid_to'
  | 'belongs_to'
  | 'is_subscription'
  | 'co_occurs'
  | 'same_category'
  | 'transferred_to'
  | 'recurring_from';
export interface FinancialGraphEdge {
  from: string;
  to: string;
  relation: FinancialGraphRelation | string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

// ─── SAAS & BILLING ────────────────────────────────────────────────────────
export type PlanName = 'free' | 'pro';
export type UserRole = 'member' | 'admin';
export type ResourceKind = 'transactions' | 'aiQueries' | 'bankConnections';
export type FeatureKey = 'advancedInsights' | 'multiBankSync' | 'adminConsole' | 'prioritySupport';
export interface SaaSContext {
  userId: string;
  role: UserRole;
  plan: PlanName;
}
export interface PlanLimits {
  transactionsPerMonth: number;
  aiQueriesPerMonth: number;
  bankConnections: number;
}
export interface BillingHookPayload {
  userId: string;
  plan: PlanName;
  event: 'usage_recorded' | 'limit_reached' | 'upgrade_required';
  resource: ResourceKind;
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
}

// ─── RUNTIME GUARDS ────────────────────────────────────────────────────────
export type GuardStatus = 'ok' | 'warning' | 'error' | 'critical';
export interface GuardResult {
  guard: string;
  status: GuardStatus;
  message?: string;
  retryable?: boolean;
  timestamp: number;
}
export interface RuntimeConfig {
  apiHealthCheckInterval?: number;
  versionCheckInterval?: number;
  enableChunkRetry?: boolean;
  enableAutoReload?: boolean;
}
export interface APIHealthResponse {
  status: string;
  timestamp?: string;
  uptime?: number;
  version?: string;
}
export interface VersionResponse {
  version: string;
  environment?: string;
}

// ─── JWT ───────────────────────────────────────────────────────────────────
export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
  tokenType?: 'access' | 'refresh';
  jti?: string;
}
