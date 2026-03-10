import { BillingHookPayload } from './types';

type BillingHookListener = (payload: BillingHookPayload) => void;

const listeners = new Set<BillingHookListener>();
const BILLING_LOG_KEY = 'flow_saas_billing_hooks';

export type BillingHookTransport = (payload: BillingHookPayload) => Promise<void>;

let transport: BillingHookTransport | null = null;

function persistBillingHook(payload: BillingHookPayload): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    const existing = JSON.parse(localStorage.getItem(BILLING_LOG_KEY) || '[]') as BillingHookPayload[];
    const trimmed = [...existing, payload].slice(-500);
    localStorage.setItem(BILLING_LOG_KEY, JSON.stringify(trimmed));
  } catch {
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
    return JSON.parse(localStorage.getItem(BILLING_LOG_KEY) || '[]') as BillingHookPayload[];
  } catch {
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
      console.error('[BillingHooks] Transport failed:', error);
    });
  }

  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error('[BillingHooks] Listener failed:', error);
    }
  });
}
