/**
 * FINANCIAL EVENT ENGINE
 *
 * Event bus reativo para o Flow Finance.
 * Conecta todos os subsistemas via eventos desacoplados.
 *
 * Fluxo:
 *   emitFinancialEvent(event)
 *       ↓
 *   subscribers notificados
 *       ↓
 *   listeners disparam análises (autopilot, insights, risks)
 *       ↓
 *   eventos armazenados em localStorage
 */

import { FinancialEvent, FinancialEventType } from '../../models/FinancialEvent';
import { makeId, now } from '../../utils/helpers';
import { Transaction } from '../../types';
import { Account } from '../../models/Account';
import { buildFinancialGraph, invalidateGraphCache } from '../ai/financialGraph';
import { detectFinancialLeaks } from '../ai/leakDetector';
import { generateMonthlyReport } from '../finance/reportEngine';
import { getActiveWorkspaceScopedStorageKey } from '../utils/workspaceStorage';


// ─── PART 5 — Storage ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'flow_financial_events';
const MAX_EVENTS  = 200;

function readEvents(): FinancialEvent[] {
  try {
    return JSON.parse(localStorage.getItem(getActiveWorkspaceScopedStorageKey(STORAGE_KEY)) || '[]');
  } catch {
    return [];
  }
}

function persistEvent(event: FinancialEvent): void {
  const events = readEvents();
  const trimmed = [event, ...events].slice(0, MAX_EVENTS);
  localStorage.setItem(getActiveWorkspaceScopedStorageKey(STORAGE_KEY), JSON.stringify(trimmed));
}

// ─── PART 2 — In-memory subscriber registry ───────────────────────────────────

type EventCallback = (event: FinancialEvent) => void;

const subscribers: EventCallback[] = [];

// ─── PART 2 — Core bus functions ─────────────────────────────────────────────

/** Emite um evento, persiste e notifica todos os subscribers. */
export function emitFinancialEvent(
  event: Omit<FinancialEvent, 'id' | 'created_at'>
): FinancialEvent {
  const full: FinancialEvent = {
    ...event,
    id: makeId(),
    created_at: now(),
  };
  persistEvent(full);
  subscribers.forEach(cb => {
    try { cb(full); } catch (e) { console.error('[EventEngine] subscriber error', e); }
  });
  return full;
}

/** Registra um callback para todos os eventos. Retorna função de cancelamento. */
export function subscribeToFinancialEvents(callback: EventCallback): () => void {
  subscribers.push(callback);
  return () => {
    const idx = subscribers.indexOf(callback);
    if (idx > -1) subscribers.splice(idx, 1);
  };
}

/** Registra um callback apenas para um tipo específico de evento. */
export function subscribeToEvent(
  type: FinancialEventType,
  callback: EventCallback
): () => void {
  const wrapped: EventCallback = (e) => { if (e.type === type) callback(e); };
  return subscribeToFinancialEvents(wrapped);
}

/** Retorna todos os eventos armazenados (mais recentes primeiro). */
export function getFinancialEvents(): FinancialEvent[] {
  return readEvents();
}

/** Retorna eventos filtrados por tipo. */
export function getEventsByType(type: FinancialEventType): FinancialEvent[] {
  return readEvents().filter(e => e.type === type);
}

/** Limpa todos os eventos armazenados. */
export function clearFinancialEvents(): void {
  localStorage.removeItem(getActiveWorkspaceScopedStorageKey(STORAGE_KEY));
}

// ─── PART 3 — Typed event helpers ────────────────────────────────────────────

export const FinancialEventEmitter = {
  transactionCreated(payload: unknown) {
    return emitFinancialEvent({ type: 'transaction_created', payload });
  },
  recurringGenerated(payload: unknown) {
    return emitFinancialEvent({ type: 'recurring_generated', payload });
  },
  insightGenerated(payload: unknown) {
    return emitFinancialEvent({ type: 'insight_generated', payload });
  },
  riskDetected(payload: unknown) {
    return emitFinancialEvent({ type: 'risk_detected', payload });
  },
  autopilotAction(payload: unknown) {
    return emitFinancialEvent({ type: 'autopilot_action', payload });
  },
  goalCreated(payload: unknown) {
    return emitFinancialEvent({ type: 'goal_created', payload });
  },
  transactionsImported(payload: unknown) {
    return emitFinancialEvent({ type: 'transactions_imported', payload });
  },
  bankTransactionsSynced(payload: unknown) {
    return emitFinancialEvent({ type: 'bank_transactions_synced', payload });
  },
};

// ─── PART 4 — Reactive listener pipeline ─────────────────────────────────────

/**
 * Inicializa o pipeline de listeners reativos.
 * Deve ser chamado uma vez na inicialização do app.
 *
 * transaction_created
 *   → runFinancialAutopilot  (lazy import para evitar circular)
 *   → generateFinancialInsights
 *   → detectFinancialRisks
 */
export function initEventListeners(
  getState: () => {
    transactions: Transaction[];
    accounts: Account[];
    userId: string;
    onAutopilotActions?: (actions: any[]) => void;
    onInsights?: (insights: any[]) => void;
    onRisks?: (risks: any[]) => void;
  }
): () => void {
  const unsubscribe = subscribeToFinancialEvents(async (event) => {
    // Só reage a eventos de transação ou goal
    if (
      event.type !== 'transaction_created' &&
      event.type !== 'goal_created' &&
      event.type !== 'recurring_generated' &&
      event.type !== 'transactions_imported' &&
      event.type !== 'bank_transactions_synced'
    ) return;

    const { transactions, accounts, userId, onAutopilotActions, onInsights, onRisks } = getState();

    try {
      // PART 6 — Run AI Orchestrator on relevant events
      const { runAIOrchestrator } = await import('../ai/aiOrchestrator');
      const orchestratorResult = await runAIOrchestrator(userId, accounts, transactions);

      // Emit events for each result
      if (orchestratorResult.insights.length > 0) {
        emitFinancialEvent({ type: 'insight_generated', payload: { count: orchestratorResult.insights.length, top: orchestratorResult.insights[0] } });
        onInsights?.(orchestratorResult.insights);
      }

      if (orchestratorResult.risks.length > 0) {
        emitFinancialEvent({ type: 'risk_detected', payload: { count: orchestratorResult.risks.length, top: orchestratorResult.risks[0] } });
        onRisks?.(orchestratorResult.risks);
      }

      if (orchestratorResult.autopilot_actions.length > 0) {
        emitFinancialEvent({ type: 'autopilot_action', payload: { count: orchestratorResult.autopilot_actions.length, top: orchestratorResult.autopilot_actions[0] } });
        onAutopilotActions?.(orchestratorResult.autopilot_actions);
      }

      // Rebuild graph
      invalidateGraphCache();
      buildFinancialGraph(userId, accounts, transactions);

      // Run leak detection and report generation
      const leaks = detectFinancialLeaks(transactions);
      const report = generateMonthlyReport(transactions);

      // TODO: handle leaks and report in UI
    } catch (e) {
      console.error('[EventEngine] listener pipeline error:', e);
    }
  });

  return unsubscribe;
}
