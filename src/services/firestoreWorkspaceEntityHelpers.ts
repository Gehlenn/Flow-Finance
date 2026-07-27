import { Account } from '../../models/Account';
import { Goal, Receivable, Reminder, Transaction } from '../../types';
import type {
  EntityState,
  WorkspaceScopedEntity,
} from './firestoreWorkspaceTypes';
import type { SyncEntity } from './sync/syncTypes';
import { logWarn } from '../utils/logger';

export function nowIso(): string {
  return new Date().toISOString();
}

export function hasWorkspaceContext(workspaceId?: string, tenantId?: string): boolean {
  return Boolean(workspaceId?.trim()) && Boolean(tenantId?.trim());
}

export function hasWorkspaceId(workspaceId?: string): boolean {
  return Boolean(workspaceId?.trim());
}

export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) => String(right.date).localeCompare(String(left.date)));
}

export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((left, right) => String(left.name).localeCompare(String(right.name), 'pt-BR'));
}

export function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((left, right) => String(left.title).localeCompare(String(right.title), 'pt-BR'));
}

export function sortReminders(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((left, right) => String(left.date).localeCompare(String(right.date), 'pt-BR'));
}

export function sortReceivables(receivables: Receivable[]): Receivable[] {
  return [...receivables].sort((left, right) => String(left.due_date).localeCompare(String(right.due_date), 'pt-BR'));
}

export function createEmptyEntityState(): EntityState {
  return {
    accounts: [],
    transactions: [],
    goals: [],
    reminders: [],
    receivables: [],
  };
}

export function loadE2ESeedEntities(workspaceId: string): EntityState | null {
  const storage = typeof globalThis !== 'undefined' && 'localStorage' in globalThis
    ? (globalThis.localStorage as Storage)
    : null;

  const globalAny = globalThis as Record<string, unknown>;
  const isE2EAuth = (storage?.getItem('flow_e2e_auth') === '1') || globalAny.__FLOW_E2E_AUTH__ === true;
  if (!isE2EAuth) {
    return null;
  }

  const workspaceScopedSeedKey = `flow_e2e_seed_entities:${workspaceId}`;
  const rawSeed = storage?.getItem(workspaceScopedSeedKey)
    || storage?.getItem('flow_e2e_seed_entities');

  if (rawSeed) {
    try {
      const parsed = JSON.parse(rawSeed) as Partial<EntityState>;
      return {
        accounts: sortAccounts(Array.isArray(parsed.accounts) ? parsed.accounts as Account[] : []),
        transactions: sortTransactions(Array.isArray(parsed.transactions) ? parsed.transactions as Transaction[] : []),
        goals: sortGoals(Array.isArray(parsed.goals) ? parsed.goals as Goal[] : []),
        reminders: sortReminders(Array.isArray(parsed.reminders) ? parsed.reminders as Reminder[] : []),
        receivables: sortReceivables(Array.isArray(parsed.receivables) ? parsed.receivables as Receivable[] : []),
      };
    } catch (error) {
      logWarn('[FirestoreWorkspace] Failed to parse E2E entity seed', {
        error,
        workspaceId,
        fallback: 'firestore-workspace-e2e-seed-parse-failed',
      });
    }
  }

  const seededMap = globalAny.__FLOW_E2E_SEED_ENTITIES__ as Record<string, Partial<EntityState>> | undefined;
  const seededFromGlobal = seededMap?.[workspaceId] || seededMap?.default;
  if (seededFromGlobal) {
    return {
      accounts: sortAccounts(Array.isArray(seededFromGlobal.accounts) ? seededFromGlobal.accounts as Account[] : []),
      transactions: sortTransactions(Array.isArray(seededFromGlobal.transactions) ? seededFromGlobal.transactions as Transaction[] : []),
      goals: sortGoals(Array.isArray(seededFromGlobal.goals) ? seededFromGlobal.goals as Goal[] : []),
      reminders: sortReminders(Array.isArray(seededFromGlobal.reminders) ? seededFromGlobal.reminders as Reminder[] : []),
      receivables: sortReceivables(Array.isArray(seededFromGlobal.receivables) ? seededFromGlobal.receivables as Receivable[] : []),
    };
  }

  const today = nowIso();
  const userId = storage?.getItem('flow_e2e_user_id') || (globalAny.__FLOW_E2E_USER_ID__ as string | undefined) || 'e2e-user';
  const tenantId = `tenant-e2e-${userId}`;

  return {
    accounts: [],
    transactions: [
      {
        id: `tx-e2e-${workspaceId}`,
        user_id: userId,
        tenant_id: tenantId,
        workspace_id: workspaceId,
        amount: 42,
        type: 'Despesa' as Transaction['type'],
        category: 'Pessoal' as Transaction['category'],
        description: 'Restaurante',
        date: today,
      },
    ],
    goals: [],
    reminders: [],
    receivables: [],
  };
}

export function resolveAuditAction(entity: SyncEntity, operation: 'created' | 'updated' | 'deleted'): string {
  const singular = entity === 'accounts'
    ? 'account'
    : entity === 'transactions'
      ? 'transaction'
      : entity === 'goals'
        ? 'goal'
        : entity === 'receivables'
          ? 'receivable'
          : 'reminder';
  return `${singular}.${operation}`;
}

export function stampEntityContext<T extends { id: string } & Record<string, unknown>>(
  entity: T,
  context: { userId: string; tenantId: string; workspaceId: string },
): T {
  return {
    ...entity,
    user_id: context.userId,
    tenant_id: context.tenantId,
    workspace_id: context.workspaceId,
    updated_at: typeof entity.updated_at === 'string' ? entity.updated_at : nowIso(),
    created_at: typeof entity.created_at === 'string' ? entity.created_at : nowIso(),
  };
}
