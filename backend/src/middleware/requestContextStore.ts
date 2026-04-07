import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextSnapshot {
  requestId?: string;
  routeScope?: string;
  userId?: string;
  userEmail?: string;
  tenantId?: string;
  workspaceId?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextSnapshot>();

export function runWithRequestContext<T>(
  context: RequestContextSnapshot,
  callback: () => T,
): T {
  return requestContextStorage.run({ ...context }, callback);
}

export function updateRequestContext(context: Partial<RequestContextSnapshot>): void {
  const current = requestContextStorage.getStore();
  if (!current) {
    return;
  }

  Object.assign(current, context);
}

export function getRequestContextSnapshot(): RequestContextSnapshot | undefined {
  const current = requestContextStorage.getStore();
  return current ? { ...current } : undefined;
}

export function getRequestContextValue<TKey extends keyof RequestContextSnapshot>(
  key: TKey,
): RequestContextSnapshot[TKey] | undefined {
  return requestContextStorage.getStore()?.[key];
}