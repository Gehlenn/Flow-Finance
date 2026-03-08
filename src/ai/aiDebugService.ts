import { Transaction } from '../../types';

const STORAGE_KEY = 'flow_ai_debug';
const MAX_LOGS = 100; // Limite para não encher o localStorage

// ─── Model (PART 4) ───────────────────────────────────────────────────────────

export interface AIDebugEntry {
  id: string;
  input: string;
  parsed_transaction?: Partial<Transaction>;
  predicted_category?: string;
  confidence?: number;
  timestamp: string;
  // Extras opcionais para richer debug
  intent?: string;
  raw_response?: string;
  processing_ms?: number;
  error?: string;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function readLogs(): AIDebugEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// ─── PART 5: Functions ───────────────────────────────────────────────────────

export function logAIDebug(entry: Omit<AIDebugEntry, 'id' | 'timestamp'>): void {
  const logs = readLogs();
  const newEntry: AIDebugEntry = {
    ...entry,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
  };

  // Insere no início e mantém limite
  const trimmed = [newEntry, ...logs].slice(0, MAX_LOGS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function getAIDebugLogs(): AIDebugEntry[] {
  return readLogs();
}

export function clearAIDebugLogs(): void {
  localStorage.removeItem(STORAGE_KEY);
}
