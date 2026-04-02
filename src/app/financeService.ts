import { Account, DEFAULT_ACCOUNT } from '../../models/Account';
import {
  Alert,
  Category,
  Goal,
  Reminder,
  Transaction,
  TransactionType,
} from '../../types';

export type FinancialCollections = {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  reminders: Reminder[];
  alerts: Alert[];
};

export type EntityCollections = Pick<FinancialCollections, 'accounts' | 'transactions' | 'goals'>;
export type ProfileCollections = Pick<FinancialCollections, 'reminders' | 'alerts'>;

export interface FinanceServiceContext {
  userId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  collections: FinancialCollections;
  syncProfile: (updates: Partial<{ name: string; theme: 'light' | 'dark' } & ProfileCollections>) => Promise<void>;
  syncEntities: (
    updates: Partial<EntityCollections>,
    previous?: Partial<EntityCollections>,
  ) => Promise<{
    entities: EntityCollections;
    idMaps: Partial<Record<keyof EntityCollections, Record<string, string>>>;
  }>;
  emitTransactionCreated?: (transaction: Transaction) => void;
  createId?: () => string;
  now?: () => string;
}

function assertScopedEntityOwnership(
  entity: { id: string; user_id?: string; workspace_id?: string },
  context: Pick<FinanceServiceContext, 'userId' | 'workspaceId'>,
  entityLabel: string,
): void {
  if (entity.user_id && entity.user_id !== context.userId) {
    throw new Error(`${entityLabel} does not belong to the active user context`);
  }

  if (context.workspaceId && entity.workspace_id && entity.workspace_id !== context.workspaceId) {
    throw new Error(`${entityLabel} does not belong to the active workspace context`);
  }
}

function defaultCreateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tmp_${crypto.randomUUID()}`;
  }

  return `tmp_${Math.random().toString(36).slice(2, 11)}`;
}

function nowIso(now: FinanceServiceContext['now']): string {
  return (now ? now() : new Date().toISOString());
}

function createId(createIdFn?: FinanceServiceContext['createId']): string {
  return createIdFn ? createIdFn() : defaultCreateId();
}

function applyIdMapToCollection<TItem extends { id: string }>(
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
  createIdFn?: FinanceServiceContext['createId'],
  now?: FinanceServiceContext['now'],
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

export async function createTransactions(
  input: Partial<Transaction>[],
  context: FinanceServiceContext,
): Promise<{ nextTransactions: Transaction[]; createdTransactions: Transaction[] }> {
  const createdTransactions = input.map((item) => ({
    ...item,
    id: item.id || createId(context.createId),
    user_id: item.user_id || context.userId,
    tenant_id: item.tenant_id || context.tenantId || undefined,
    workspace_id: item.workspace_id || context.workspaceId || undefined,
    date: item.date || nowIso(context.now),
    amount: Number.isFinite(item.amount) ? Number(item.amount) : 0,
    description: item.description?.trim() || 'Lancamento Flow',
    type: item.type || TransactionType.DESPESA,
    category: item.category || Category.PESSOAL,
  })) as Transaction[];

  const nextTransactions = [...createdTransactions, ...context.collections.transactions];
  const syncResult = await context.syncEntities(
    { transactions: nextTransactions },
    { transactions: context.collections.transactions },
  );

  const reconciledTransactions = applyIdMapToCollection(
    createdTransactions,
    syncResult.idMaps.transactions,
  );
  reconciledTransactions.forEach((transaction) => context.emitTransactionCreated?.(transaction));

  return {
    nextTransactions: syncResult.entities.transactions,
    createdTransactions: reconciledTransactions,
  };
}

export async function updateTransaction(
  updatedTransaction: Transaction,
  context: FinanceServiceContext,
): Promise<Transaction[]> {
  const nextTransactions = context.collections.transactions.map((transaction) =>
    transaction.id === updatedTransaction.id ? updatedTransaction : transaction,
  );

  const syncResult = await context.syncEntities(
    { transactions: nextTransactions },
    { transactions: context.collections.transactions },
  );

  return syncResult.entities.transactions;
}

export async function deleteTransactions(
  transactionIds: string[],
  context: FinanceServiceContext,
): Promise<Transaction[]> {
  for (const transactionId of transactionIds) {
    const transaction = context.collections.transactions.find((item) => item.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found in active context');
    }

    assertScopedEntityOwnership(transaction, context, 'Transaction');
  }

  const idSet = new Set(transactionIds);
  const nextTransactions = context.collections.transactions.filter((transaction) => !idSet.has(transaction.id));

  const syncResult = await context.syncEntities(
    { transactions: nextTransactions },
    { transactions: context.collections.transactions },
  );

  return syncResult.entities.transactions;
}

export async function createAccount(
  input: { name: string; type: Account['type']; balance: number },
  context: FinanceServiceContext,
): Promise<{ nextAccounts: Account[]; createdAccount: Account }> {
  const createdAccount: Account = {
    id: createId(context.createId),
    user_id: context.userId,
    tenant_id: context.tenantId || undefined,
    workspace_id: context.workspaceId || undefined,
    name: input.name.trim(),
    type: input.type,
    balance: Number.isFinite(input.balance) ? input.balance : 0,
    currency: 'BRL',
    created_at: nowIso(context.now),
  };

  const nextAccounts = [...context.collections.accounts, createdAccount];
  const syncResult = await context.syncEntities(
    { accounts: nextAccounts },
    { accounts: context.collections.accounts },
  );

  const reconciledAccount = applyIdMapToCollection(
    [createdAccount],
    syncResult.idMaps.accounts,
  )[0];

  return { nextAccounts: syncResult.entities.accounts, createdAccount: reconciledAccount };
}

export async function updateAccount(
  updatedAccount: Account,
  context: FinanceServiceContext,
): Promise<Account[]> {
  const nextAccounts = context.collections.accounts.map((account) =>
    account.id === updatedAccount.id ? updatedAccount : account,
  );

  const syncResult = await context.syncEntities(
    { accounts: nextAccounts },
    { accounts: context.collections.accounts },
  );

  return syncResult.entities.accounts;
}

export async function deleteAccount(
  accountId: string,
  context: FinanceServiceContext,
): Promise<Account[]> {
  const account = context.collections.accounts.find((item) => item.id === accountId);
  if (!account) {
    throw new Error('Account not found in active context');
  }

  assertScopedEntityOwnership(account, context, 'Account');

  if (context.collections.accounts.length <= 1) {
    throw new Error('Nao e permitido excluir a ultima conta ativa');
  }

  const nextAccounts = context.collections.accounts.filter((account) => account.id !== accountId);
  const syncResult = await context.syncEntities(
    { accounts: nextAccounts },
    { accounts: context.collections.accounts },
  );

  return syncResult.entities.accounts;
}

export async function createGoal(
  input: Omit<Goal, 'id'>,
  context: FinanceServiceContext,
): Promise<{ nextGoals: Goal[]; createdGoal: Goal }> {
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error('A meta precisa de um valor alvo positivo');
  }

  const createdGoal: Goal = {
    ...input,
    id: createId(context.createId),
    user_id: input.user_id || context.userId,
    tenant_id: input.tenant_id || context.tenantId || undefined,
    workspace_id: input.workspace_id || context.workspaceId || undefined,
    title: input.title.trim(),
    currentAmount: Math.min(Math.max(input.currentAmount || 0, 0), input.targetAmount),
  };

  const nextGoals = [...context.collections.goals, createdGoal];
  const syncResult = await context.syncEntities(
    { goals: nextGoals },
    { goals: context.collections.goals },
  );

  const reconciledGoal = applyIdMapToCollection(
    [createdGoal],
    syncResult.idMaps.goals,
  )[0];

  return { nextGoals: syncResult.entities.goals, createdGoal: reconciledGoal };
}

export async function updateGoal(
  updatedGoal: Goal,
  context: FinanceServiceContext,
): Promise<Goal[]> {
  const normalizedGoal: Goal = {
    ...updatedGoal,
    currentAmount: Math.min(Math.max(updatedGoal.currentAmount, 0), updatedGoal.targetAmount),
  };

  const nextGoals = context.collections.goals.map((goal) =>
    goal.id === normalizedGoal.id ? normalizedGoal : goal,
  );

  const syncResult = await context.syncEntities(
    { goals: nextGoals },
    { goals: context.collections.goals },
  );

  return syncResult.entities.goals;
}

export async function deleteGoal(
  goalId: string,
  context: FinanceServiceContext,
): Promise<Goal[]> {
  const goal = context.collections.goals.find((item) => item.id === goalId);
  if (!goal) {
    throw new Error('Goal not found in active context');
  }

  assertScopedEntityOwnership(goal, context, 'Goal');

  const nextGoals = context.collections.goals.filter((goal) => goal.id !== goalId);
  const syncResult = await context.syncEntities(
    { goals: nextGoals },
    { goals: context.collections.goals },
  );

  return syncResult.entities.goals;
}

export async function contributeGoal(
  goalId: string,
  amount: number,
  context: FinanceServiceContext,
): Promise<Goal[]> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('O aporte precisa ser positivo');
  }

  const nextGoals = context.collections.goals.map((goal) => {
    if (goal.id !== goalId) {
      return goal;
    }

    return {
      ...goal,
      currentAmount: Math.min(goal.currentAmount + amount, goal.targetAmount),
    };
  });

  const syncResult = await context.syncEntities(
    { goals: nextGoals },
    { goals: context.collections.goals },
  );

  return syncResult.entities.goals;
}

export async function createReminder(
  input: Partial<Reminder>,
  context: FinanceServiceContext,
): Promise<{ nextReminders: Reminder[]; createdReminder: Reminder }> {
  const createdReminder: Reminder = {
    id: createId(context.createId),
    title: input.title?.trim() || 'Novo evento',
    date: input.date || nowIso(context.now),
    type: input.type || 'Pessoal',
    completed: false,
    priority: input.priority || 'media',
    amount: input.amount,
    isRecurring: input.isRecurring,
  } as Reminder;

  const nextReminders = [createdReminder, ...context.collections.reminders];
  await context.syncProfile({ reminders: nextReminders });

  return { nextReminders, createdReminder };
}

export async function updateReminder(
  updatedReminder: Reminder,
  context: FinanceServiceContext,
): Promise<Reminder[]> {
  const nextReminders = context.collections.reminders.map((reminder) =>
    reminder.id === updatedReminder.id ? updatedReminder : reminder,
  );

  await context.syncProfile({ reminders: nextReminders });
  return nextReminders;
}

export async function deleteReminder(
  reminderId: string,
  context: FinanceServiceContext,
): Promise<Reminder[]> {
  const nextReminders = context.collections.reminders.filter((reminder) => reminder.id !== reminderId);
  await context.syncProfile({ reminders: nextReminders });
  return nextReminders;
}

export async function toggleReminder(
  reminderId: string,
  context: FinanceServiceContext,
): Promise<Reminder[]> {
  const nextReminders = context.collections.reminders.map((reminder) =>
    reminder.id === reminderId ? { ...reminder, completed: !reminder.completed } : reminder,
  );

  await context.syncProfile({ reminders: nextReminders });
  return nextReminders;
}

export async function createAlert(
  input: Omit<Alert, 'id'>,
  context: FinanceServiceContext,
): Promise<{ nextAlerts: Alert[]; createdAlert: Alert }> {
  const createdAlert: Alert = {
    id: createId(context.createId),
    category: input.category,
    threshold: input.threshold,
    timeframe: input.timeframe,
  };

  const nextAlerts = [createdAlert, ...context.collections.alerts];
  await context.syncProfile({ alerts: nextAlerts });

  return { nextAlerts, createdAlert };
}

export async function deleteAlert(
  alertId: string,
  context: FinanceServiceContext,
): Promise<Alert[]> {
  const nextAlerts = context.collections.alerts.filter((alert) => alert.id !== alertId);
  await context.syncProfile({ alerts: nextAlerts });
  return nextAlerts;
}
