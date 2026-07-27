import { Account } from '../../models/Account';
import { Category, Goal, Reminder, Transaction, TransactionType, type Alert } from '../../types';
import type { FinanceServiceContext } from './financeServiceTypes';
import {
  assertScopedEntityOwnership,
  createDefaultAccount,
  createId,
  nowIso,
  forceScopedEntityContext,
} from './financeServiceHelpers';
import { applyIdMapToCollection } from '../utils/collectionIds';
import {
  buildNextReminderReceivables,
  removeReminderReceivableForReminder,
  syncEntityCollection,
  syncEntityCollectionResult,
  syncReminderCollections,
} from './financeServiceSyncHelpers';
import { trackProductEventOnce } from './productAnalytics';

export { createDefaultAccount } from './financeServiceHelpers';
export type {
  EntityCollections,
  FinanceServiceContext,
  FinancialCollections,
  ProfileCollections,
} from './financeServiceTypes';

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
  const syncResult = await syncEntityCollectionResult(
    context,
    'transactions',
    nextTransactions,
    context.collections.transactions,
  );

  const reconciledTransactions = applyIdMapToCollection(
    createdTransactions,
    syncResult.idMaps.transactions,
  );
  reconciledTransactions.forEach((transaction) => context.emitTransactionCreated?.(transaction));

  if (context.collections.transactions.length === 0 && reconciledTransactions.length > 0) {
    trackProductEventOnce('activation_first_transaction', context.workspaceId || context.tenantId || context.userId || 'local', {
      workspace: context.workspaceId || null,
      tenant: context.tenantId || null,
      created_count: reconciledTransactions.length,
      source: 'finance_service',
    });
  }

  return {
    nextTransactions: syncResult.entities.transactions,
    createdTransactions: reconciledTransactions,
  };
}

export async function updateTransaction(
  updatedTransaction: Transaction,
  context: FinanceServiceContext,
): Promise<Transaction[]> {
  const currentTransaction = context.collections.transactions.find((transaction) => transaction.id === updatedTransaction.id);
  if (!currentTransaction) {
    throw new Error('Transaction not found in active context');
  }

  assertScopedEntityOwnership(currentTransaction, context, 'Transaction');
  const normalizedTransaction = forceScopedEntityContext(updatedTransaction, context);

  const nextTransactions = context.collections.transactions.map((transaction) =>
    transaction.id === normalizedTransaction.id ? normalizedTransaction : transaction,
  );

  return syncEntityCollection(context, 'transactions', nextTransactions, context.collections.transactions);
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

  return syncEntityCollection(context, 'transactions', nextTransactions, context.collections.transactions);
}

export async function createAccount(
  input: { name: string; type: Account['type']; balance: number },
  context: FinanceServiceContext,
): Promise<{ nextAccounts: Account[]; createdAccount: Account }> {
  const createdAccount: Account = {
    ...createDefaultAccount(
      context.userId,
      context.tenantId,
      context.workspaceId,
      context.createId,
      context.now,
    ),
    name: input.name.trim(),
    type: input.type,
    balance: Number.isFinite(input.balance) ? input.balance : 0,
    currency: 'BRL',
  };

  const nextAccounts = [...context.collections.accounts, createdAccount];
  const syncResult = await syncEntityCollectionResult(
    context,
    'accounts',
    nextAccounts,
    context.collections.accounts,
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
  const currentAccount = context.collections.accounts.find((account) => account.id === updatedAccount.id);
  if (!currentAccount) {
    throw new Error('Account not found in active context');
  }

  assertScopedEntityOwnership(currentAccount, context, 'Account');
  const normalizedAccount = forceScopedEntityContext(updatedAccount, context);

  const nextAccounts = context.collections.accounts.map((account) =>
    account.id === normalizedAccount.id ? normalizedAccount : account,
  );

  return syncEntityCollection(context, 'accounts', nextAccounts, context.collections.accounts);
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
  return syncEntityCollection(context, 'accounts', nextAccounts, context.collections.accounts);
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
  const syncResult = await syncEntityCollectionResult(context, 'goals', nextGoals, context.collections.goals);

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
  const currentGoal = context.collections.goals.find((goal) => goal.id === updatedGoal.id);
  if (!currentGoal) {
    throw new Error('Goal not found in active context');
  }

  assertScopedEntityOwnership(currentGoal, context, 'Goal');
  const normalizedGoal: Goal = {
    ...forceScopedEntityContext(updatedGoal, context),
    currentAmount: Math.min(Math.max(updatedGoal.currentAmount, 0), updatedGoal.targetAmount),
  };

  const nextGoals = context.collections.goals.map((goal) =>
    goal.id === normalizedGoal.id ? normalizedGoal : goal,
  );

  return syncEntityCollection(context, 'goals', nextGoals, context.collections.goals);
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
  return syncEntityCollection(context, 'goals', nextGoals, context.collections.goals);
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

  return syncEntityCollection(context, 'goals', nextGoals, context.collections.goals);
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
  const reminderSyncResult = await syncEntityCollectionResult(
    context,
    'reminders',
    nextReminders,
    context.collections.reminders,
  );

  const reconciledReminder = applyIdMapToCollection(
    [createdReminder],
    reminderSyncResult.idMaps.reminders,
  )[0];

  const nextReceivables = buildNextReminderReceivables(
    context.collections.receivables,
    reconciledReminder,
    context,
  );

  if (nextReceivables !== context.collections.receivables) {
    await syncEntityCollection(context, 'receivables', nextReceivables, context.collections.receivables);
  }

  return { nextReminders: reminderSyncResult.entities.reminders, createdReminder: reconciledReminder };
}

export async function updateReminder(
  updatedReminder: Reminder,
  context: FinanceServiceContext,
): Promise<Reminder[]> {
  const nextReminders = context.collections.reminders.map((reminder) =>
    reminder.id === updatedReminder.id ? updatedReminder : reminder,
  );
  const nextReceivables = buildNextReminderReceivables(context.collections.receivables, updatedReminder, context);

  const syncResult = await syncReminderCollections(
    context,
    nextReminders,
    context.collections.reminders,
    nextReceivables,
    context.collections.receivables,
  );
  return syncResult.reminders;
}

export async function deleteReminder(
  reminderId: string,
  context: FinanceServiceContext,
): Promise<Reminder[]> {
  const nextReminders = context.collections.reminders.filter((reminder) => reminder.id !== reminderId);
  const nextReceivables = removeReminderReceivableForReminder(context.collections.receivables, reminderId);
  const syncResult = await syncReminderCollections(
    context,
    nextReminders,
    context.collections.reminders,
    nextReceivables,
    context.collections.receivables,
  );
  return syncResult.reminders;
}

export async function toggleReminder(
  reminderId: string,
  context: FinanceServiceContext,
): Promise<Reminder[]> {
  const nextReminders = context.collections.reminders.map((reminder) =>
    reminder.id === reminderId ? { ...reminder, completed: !reminder.completed } : reminder,
  );
  const toggledReminder = nextReminders.find((reminder) => reminder.id === reminderId);
  const nextReceivables = toggledReminder
    ? buildNextReminderReceivables(context.collections.receivables, toggledReminder, context)
    : context.collections.receivables;

  const syncResult = await syncReminderCollections(
    context,
    nextReminders,
    context.collections.reminders,
    nextReceivables,
    context.collections.receivables,
  );
  return syncResult.reminders;
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
