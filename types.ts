
export enum TransactionType {
  RECEITA = 'Receita',
  DESPESA = 'Despesa'
}

export enum Category {
  PESSOAL = 'Pessoal',
  CONSULTORIO = 'Trabalho / Consultório',
  NEGOCIO = 'Negócio',
  INVESTIMENTO = 'Investimento'
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: Category;
  description: string;
  date: string;

  // v0.2 — campos opcionais
  account_id?: string;

  merchant?: string;

  payment_method?:
    | "cash"
    | "credit_card"
    | "debit_card"
    | "pix"
    | "transfer";

  source?:
    | "manual"
    | "ai_text"
    | "ai_image"
    | "import";

  confidence_score?: number;

  receipt_image?: string;

  recurring?: boolean;

  recurrence_type?:
    | "daily"
    | "weekly"
    | "monthly";

  recurrence_interval?: number;

  // Gerada dinamicamente pelo engine de recorrência (não salva no storage)
  generated?: boolean;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
  balance: number;
}

export interface Alert {
  id: string;
  category: Category | 'Geral';
  threshold: number;
  timeframe: 'mensal' | 'semanal';
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category: Category;
}

export enum ReminderType {
  PESSOAL = 'Pessoal',
  TRABALHO = 'Trabalho',
  NEGOCIO = 'Negócio',
  INVESTIMENTO = 'Investimento',
  SAUDE = 'Saúde'
}

export interface Reminder {
  id: string;
  title: string;
  date: string; // ISO format
  type: ReminderType;
  amount?: number;
  completed: boolean;
  priority: 'baixa' | 'media' | 'alta';
  isRecurring?: boolean; // Se repete mensalmente
}

// ─── AI Types ──────────────────────────────────────────────────────────────────

export interface TransactionData {
  amount: number;
  description: string;
  category: Category;
  type: TransactionType;
}

export interface ReminderData {
  title: string;
  date?: string;
  type: string;
  amount?: number;
  priority: 'baixa' | 'média' | 'alta';
}

export interface InterpretResponse {
  intent: 'transaction' | 'reminder';
  data: TransactionData[] | ReminderData[];
}
