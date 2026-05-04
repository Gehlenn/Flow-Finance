import { BillingHookPayload } from './types';

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
      if (!ok) console.warn('[BillingHooks] Dropping invalid hook record:', entry);
      return ok;
    });
    const trimmed = [...valid, payload].slice(-500);
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
    const raw = JSON.parse(localStorage.getItem(BILLING_LOG_KEY) || '[]') as unknown[];
    return raw.filter((entry): entry is BillingHookPayload => {
      const ok = isValidHookPayload(entry);
      if (!ok) console.warn('[BillingHooks] Skipping invalid hook record on read:', entry);
      return ok;
    });
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
