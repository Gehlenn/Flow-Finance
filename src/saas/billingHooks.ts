import { BillingHookPayload } from './types';
import { trackProductEvent } from '../app/productAnalytics';
import { logWarn } from '../utils/logger';

type BillingHookListener = (payload: BillingHookPayload) => void;

const listeners = new Set<BillingHookListener>();
const BILLING_LOG_KEY = 'flow_saas_billing_hooks';

export type BillingHookTransport = (payload: BillingHookPayload) => Promise<void>;

let transport: BillingHookTransport | null = null;

function isValidHookPayload(entry: unknown): entry is BillingHookPayload {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.userId === 'string' &&
    typeof e.plan === 'string' &&
    typeof e.event === 'string' &&
    typeof e.resource === 'string' &&
    typeof e.amount === 'number' &&
    typeof e.at === 'string'
  );
}

function persistBillingHook(payload: BillingHookPayload): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    const raw = JSON.parse(localStorage.getItem(BILLING_LOG_KEY) || '[]') as unknown[];
    const valid = raw.filter((entry): entry is BillingHookPayload => {
      const ok = isValidHookPayload(entry);
      if (!ok) {
        logWarn('[BillingHooks] Dropping invalid hook record', {
          entry,
          fallback: 'billing-hook-invalid-record-dropped',
        });
      }
      return ok;
    });
    const trimmed = [...valid, payload].slice(-500);
    localStorage.setItem(BILLING_LOG_KEY, JSON.stringify(trimmed));
  } catch (error) {
    logWarn('[BillingHooks] Failed to persist billing hook payload; ignoring storage write', {
      error,
      fallback: 'billing-hook-persist-failed',
    });
    // Ignore persistence errors to keep billing hooks non-blocking.
  }
}

export function configureBillingTransport(nextTransport: BillingHookTransport | null): void {
  transport = nextTransport;
}

export function getPersistedBillingHooks(): BillingHookPayload[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = JSON.parse(localStorage.getItem(BILLING_LOG_KEY) || '[]') as unknown[];
    return raw.filter((entry): entry is BillingHookPayload => {
      const ok = isValidHookPayload(entry);
      if (!ok) {
        logWarn('[BillingHooks] Skipping invalid hook record on read', {
          entry,
          fallback: 'billing-hook-invalid-record-read',
        });
      }
      return ok;
    });
  } catch (error) {
    logWarn('[BillingHooks] Failed to read persisted billing hooks; returning empty list', {
      error,
      fallback: 'billing-hook-read-failed',
    });
    return [];
  }
}

export function onBillingHook(listener: BillingHookListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitBillingHook(payload: BillingHookPayload): void {
  persistBillingHook(payload);

  if (transport) {
    void transport(payload).catch((error) => {
      trackProductEvent('integration_error_observed', {
        integration: 'billing_hooks',
        stage: 'transport',
        workspace_id: payload.workspaceId || null,
        resource: payload.resource,
      });
      logWarn('[BillingHooks] Transport failed', {
        error,
        payload,
        fallback: 'billing-hook-transport-failed',
      });
    });
  }

  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      logWarn('[BillingHooks] Listener failed', {
        error,
        payload,
        fallback: 'billing-hook-listener-failed',
      });
    }
  });
}
