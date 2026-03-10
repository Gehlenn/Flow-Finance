type UsageSnapshot = {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
};

type BillingHookPayload = {
  userId: string;
  plan: 'free' | 'pro';
  event: 'usage_recorded' | 'limit_reached' | 'upgrade_required';
  resource: 'transactions' | 'aiQueries' | 'bankConnections';
  amount: number;
  at: string;
  metadata?: Record<string, unknown>;
};

const usageByUser = new Map<string, Record<string, UsageSnapshot>>();
const billingHooksByUser = new Map<string, BillingHookPayload[]>();

export function getUserUsage(userId: string): Record<string, UsageSnapshot> {
  return usageByUser.get(userId) || {};
}

export function setUserUsage(userId: string, usage: Record<string, UsageSnapshot>): void {
  usageByUser.set(userId, usage);
}

export function appendBillingHook(userId: string, payload: BillingHookPayload): void {
  const current = billingHooksByUser.get(userId) || [];
  current.push(payload);
  billingHooksByUser.set(userId, current.slice(-1000));
}

export function getBillingHookCount(userId: string): number {
  return (billingHooksByUser.get(userId) || []).length;
}
