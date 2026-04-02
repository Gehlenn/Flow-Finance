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
import { API_ENDPOINTS, getAuthHeaders } from '../config/api.config';


// ─── PART 5 — Storage ─────────────────────────────────────────────────────────

const MAX_EVENTS  = 200;
let eventCache: FinancialEvent[] = [];

function buildEventEndpoint(): string {
  return API_ENDPOINTS.USER.PROFILE.replace('/user/profile', '/finance/events');
}

async function persistEventRemotely(event: FinancialEvent): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    return;
  }

  await fetch(buildEventEndpoint(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: event.id,
      type: event.type,
      aggregateId: typeof (event.payload as Record<string, unknown> | undefined)?.id === 'string'
        ? String((event.payload as Record<string, unknown>).id)
        : undefined,
      aggregateType: String(event.type).includes('goal')
        ? 'goal'
        : String(event.type).includes('transaction')
          ? 'transaction'
          : 'financial_event',
      payload: typeof event.payload === 'object' && event.payload !== null
        ? event.payload as Record<string, unknown>
        : { value: event.payload },
      occurredAt: event.created_at,
    }),
  }).catch((error) => {
    console.warn('[EventEngine] Failed to persist event remotely:', error);
  });
}

export async function refreshFinancialEvents(limit = MAX_EVENTS): Promise<FinancialEvent[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    return eventCache;
  }

  try {
    const response = await fetch(`${buildEventEndpoint()}?limit=${limit}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return eventCache;
    }

    const body = await response.json() as {
      events?: Array<{ id: string; type: FinancialEventType; payload: unknown; occurredAt: string }>;
    };

    eventCache = (body.events || []).map((event) => ({
      id: event.id,
      type: event.type,
      payload: event.payload,
      created_at: event.occurredAt,
    }));
    return eventCache;
  } catch (error) {
    console.warn('[EventEngine] Failed to fetch remote events:', error);
    return eventCache;
  }
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
  eventCache = [full, ...eventCache].slice(0, MAX_EVENTS);
  void persistEventRemotely(full);
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
  return eventCache;
}

/** Retorna eventos filtrados por tipo. */
export function getEventsByType(type: FinancialEventType): FinancialEvent[] {
  return eventCache.filter(e => e.type === type);
}

/** Limpa todos os eventos armazenados. */
export function clearFinancialEvents(): void {
  eventCache = [];
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
