// ─── JWT ──────────────────────────────────────────────────────────────────────

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// ─── COMMON TYPES ────────────────────────────────────────────────────────────

export type TransactionType = 'Receita' | 'Despesa';
export type CategoryType = 'Pessoal' | 'Trabalho' | 'Negócio' | 'Investimento';
export type PriorityType = 'baixa' | 'média' | 'alta';

// ─── TRANSACTION ──────────────────────────────────────────────────────────────

export interface TransactionData {
  amount: number;
  description: string;
  category: CategoryType;
  type: TransactionType;
}

// ─── REMINDER ─────────────────────────────────────────────────────────────────

export interface ReminderData {
  title: string;
  date?: string; // ISO date string
  type: string; // e.g., 'Pagamento', 'Reunião', 'Cliente', 'Tarefa', 'Saúde'
  amount?: number;
  priority: PriorityType;
}

// ─── INSIGHTS ─────────────────────────────────────────────────────────────────

export interface DailyInsight {
  title: string;
  description: string;
  type: 'padrão' | 'alerta' | 'dica';
}

export interface StrategicReport {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  opportunities: string[];
  actions: string[];
}

// ─── RECEIPT SCAN ─────────────────────────────────────────────────────────────

export interface ReceiptScanResult {
  amount: number;
  description: string;
  date: string; // ISO date string
  category: CategoryType;
  type: TransactionType;
}

// ─── TRANSACTION CLASSIFICATION ───────────────────────────────────────────────

export interface TransactionClassification {
  category: CategoryType;
  type: TransactionType;
  confidence: number; // 0-1
}

// ─── AI Requests/Responses ────────────────────────────────────────────────────

export interface InterpretRequest {
  text: string;
  memoryContext?: string;
}

export interface InterpretResponse {
  intent: 'transaction' | 'reminder';
  data: TransactionData[] | ReminderData[];
}

export interface ScanReceiptRequest {
  imageBase64: string;
  imageMimeType: string;
  context?: string;
}

export interface ScanReceiptResponse extends ReceiptScanResult {}

export interface ClassifyTransactionsRequest {
  transactions: Array<{ description: string; amount: number; date?: string }>;
}

export interface ClassifyTransactionsResponse extends Array<TransactionClassification> {}

export interface GenerateInsightsRequest {
  transactions: TransactionData[];
  type: 'daily' | 'strategic';
}

export interface GenerateInsightsResponse {
  insights?: DailyInsight[];
  report?: StrategicReport;
}

export interface TokenCountRequest {
  text: string;
}

export interface TokenCountResponse {
  tokenCount: number;
}

// ─── AUTH Responses ───────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  userId: string;
  email: string;
  expiresIn: number;
}

export interface RefreshResponse {
  token: string;
  expiresIn: number;
}

export interface ValidateResponse {
  valid: boolean;
  user?: {
    userId: string;
    email: string;
  };
  expiresIn?: number;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

// ─── ERROR Responses ──────────────────────────────────────────────────────────

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  statusCode: number;
  path?: string;
  details?: Record<string, any>;
}

// ─── SYSTEM ───────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
}

export interface VersionResponse {
  version: string;
  environment: 'development' | 'production' | 'test';
}

// ─── USER ─────────────────────────────────────────────────────────────────────

export interface User {
  userId: string;
  email: string;
  password?: string; // Not stored in production (use bcrypt or auth service)
  createdAt: string;
  lastLogin?: string;
}

export interface UserSession {
  userId: string;
  email: string;
  loginTime: number;
  expiresAt: number;
}
