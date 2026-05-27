import { Account, DEFAULT_ACCOUNT } from '../../models/Account';

type FinanceServiceContextLike = {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  createId?: () => string;
  now?: () => string;
};

export function assertScopedEntityOwnership(
  entity: { id: string; user_id?: string; workspace_id?: string },
  context: Pick<FinanceServiceContextLike, 'userId' | 'workspaceId'>,
  entityLabel: string,
): void {
  if (entity.user_id && entity.user_id !== context.userId) {
    throw new Error(`${entityLabel} does not belong to the active user context`);
  }

  if (context.workspaceId && entity.workspace_id && entity.workspace_id !== context.workspaceId) {
    throw new Error(`${entityLabel} does not belong to the active workspace context`);
  }
}

export function forceScopedEntityContext<T extends { id: string; user_id?: string; tenant_id?: string; workspace_id?: string }>(
  entity: T,
  context: Pick<FinanceServiceContextLike, 'userId' | 'tenantId' | 'workspaceId'>,
): T {
  return {
    ...entity,
    user_id: context.userId,
    tenant_id: context.tenantId || undefined,
    workspace_id: context.workspaceId || undefined,
  };
}

export function defaultCreateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tmp_${crypto.randomUUID()}`;
  }

  return `tmp_${Math.random().toString(36).slice(2, 11)}`;
}

export function nowIso(now: FinanceServiceContextLike['now']): string {
  return (now ? now() : new Date().toISOString());
}

export function createId(createIdFn?: FinanceServiceContextLike['createId']): string {
  return createIdFn ? createIdFn() : defaultCreateId();
}

export function applyIdMapToCollection<TItem extends { id: string }>(
  items: TItem[],
  idMap?: Record<string, string>,
): TItem[] {
  if (!idMap || Object.keys(idMap).length === 0) {
    return items;
  }

  return items.map((item) => {
    const nextId = idMap[item.id];
    return nextId ? { ...item, id: nextId } : item;
  });
}

export function createDefaultAccount(
  userId: string,
  tenantId?: string | null,
  workspaceId?: string | null,
  createIdFn?: FinanceServiceContextLike['createId'],
  now?: FinanceServiceContextLike['now'],
): Account {
  return {
    id: createId(createIdFn),
    user_id: userId,
    tenant_id: tenantId || undefined,
    workspace_id: workspaceId || undefined,
    name: DEFAULT_ACCOUNT.name,
    type: DEFAULT_ACCOUNT.type,
    balance: DEFAULT_ACCOUNT.balance,
    currency: DEFAULT_ACCOUNT.currency,
    created_at: nowIso(now),
  };
}
