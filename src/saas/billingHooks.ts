import { BillingHookPayload } from './types';

type BillingHookListener = (payload: BillingHookPayload) => void;

const listeners = new Set<BillingHookListener>();

export function onBillingHook(listener: BillingHookListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitBillingHook(payload: BillingHookPayload): void {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error('[BillingHooks] Listener failed:', error);
    }
  });
}
