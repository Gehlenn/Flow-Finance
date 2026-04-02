import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Account } from '../models/Account';
import { Alert, Goal, Reminder, Transaction } from '../types';
import { detectAndLearnPatterns } from '../src/ai/aiMemory';
import { runAdaptiveLearning } from '../src/ai/adaptiveAIEngine';
import { FinancialEventEmitter } from '../src/events/eventEngine';
import { initEventListeners } from '../src/events/eventEngine';
import {
  createAccount,
  createAlert,
  createDefaultAccount,
  createGoal,
  createReminder,
  createTransactions,
  deleteAccount,
  deleteAlert,
  deleteGoal,
  deleteReminder,
  deleteTransactions,
  contributeGoal,
  FinancialCollections,
  toggleReminder,
  updateAccount,
  updateGoal,
  updateReminder,
  updateTransaction,
} from '../src/app/financeService';
import { useSyncEngine } from './useSyncEngine';

interface UseFinancialStateOptions {
  userId: string | null;
  activeTenantId: string | null;
  activeWorkspaceId: string | null;
  syncEngine: ReturnType<typeof useSyncEngine>;
}

export function useFinancialState(options: UseFinancialStateOptions) {
  const { userId, activeTenantId, activeWorkspaceId, syncEngine } = options;

  const workspaceDefaultAccountRef = useRef<string | null>(null);
  const accounts = syncEngine.entities.accounts;
  const transactions = syncEngine.entities.transactions;
  const goals = syncEngine.entities.goals;
  const reminders = syncEngine.profile.reminders;
  const alerts = syncEngine.profile.alerts;

  useEffect(() => {
    if (!activeWorkspaceId || workspaceDefaultAccountRef.current !== activeWorkspaceId) {
      workspaceDefaultAccountRef.current = null;
    }
  }, [activeWorkspaceId]);

  const collections = useMemo<FinancialCollections>(() => ({
    accounts,
    transactions,
    goals,
    reminders,
    alerts,
  }), [accounts, alerts, goals, reminders, transactions]);

  const serviceContext = useMemo(() => {
    if (!userId) {
      return null;
    }

    return {
      userId,
      tenantId: activeTenantId,
      workspaceId: activeWorkspaceId,
      collections,
      syncProfile: syncEngine.syncProfile,
      syncEntities: syncEngine.syncEntities,
      emitTransactionCreated: FinancialEventEmitter.transactionCreated,
    };
  }, [activeTenantId, activeWorkspaceId, collections, syncEngine.syncEntities, syncEngine.syncProfile, userId]);

  useEffect(() => {
    if (userId && transactions.length >= 3) {
      detectAndLearnPatterns(userId, transactions);
      runAdaptiveLearning(userId, transactions).catch((error) => {
        console.error('Falha ao executar aprendizado adaptativo:', error);
      });
    }
  }, [transactions, userId]);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    return initEventListeners(() => ({
      transactions,
      accounts,
      userId,
    }));
  }, [accounts, transactions, userId]);

  useEffect(() => {
    if (!serviceContext || !activeWorkspaceId || !syncEngine.backendSyncEnabled || !syncEngine.hasLoadedEntities) {
      return;
    }

    if (accounts.length > 0 || workspaceDefaultAccountRef.current === activeWorkspaceId) {
      return;
    }

    workspaceDefaultAccountRef.current = activeWorkspaceId;
    const defaultAccount = createDefaultAccount(userId!, activeTenantId, activeWorkspaceId, undefined, undefined);
    void syncEngine.syncEntities(
      { accounts: [defaultAccount] },
      { accounts: [] },
    ).catch((error) => {
      console.error('Falha ao criar conta padrao do workspace:', error);
      workspaceDefaultAccountRef.current = null;
    });
  }, [
    accounts.length,
    activeWorkspaceId,
    activeTenantId,
    serviceContext,
    syncEngine,
    userId,
  ]);

  const addTransactions = useCallback(async (input: Partial<Transaction>[]) => {
    if (!serviceContext) return;
    await createTransactions(input, serviceContext);
  }, [serviceContext]);

  const updateSingleTransaction = useCallback(async (transaction: Transaction) => {
    if (!serviceContext) return;
    await updateTransaction(transaction, serviceContext);
  }, [serviceContext]);

  const deleteSingleTransaction = useCallback(async (transactionId: string) => {
    if (!serviceContext) return;
    await deleteTransactions([transactionId], serviceContext);
  }, [serviceContext]);

  const deleteMultipleTransactions = useCallback(async (transactionIds: string[]) => {
    if (!serviceContext) return;
    await deleteTransactions(transactionIds, serviceContext);
  }, [serviceContext]);

  const createSingleAccount = useCallback(async (input: {
    name: string;
    type: Account['type'];
    balance: number;
  }) => {
    if (!serviceContext) return;
    await createAccount(input, serviceContext);
  }, [serviceContext]);

  const updateSingleAccount = useCallback(async (account: Account) => {
    if (!serviceContext) return;
    await updateAccount(account, serviceContext);
  }, [serviceContext]);

  const deleteSingleAccount = useCallback(async (accountId: string) => {
    if (!serviceContext) return;
    await deleteAccount(accountId, serviceContext);
  }, [serviceContext]);

  const createSingleGoal = useCallback(async (goal: Omit<Goal, 'id'>) => {
    if (!serviceContext) return;
    await createGoal(goal, serviceContext);
  }, [serviceContext]);

  const updateSingleGoal = useCallback(async (goal: Goal) => {
    if (!serviceContext) return;
    await updateGoal(goal, serviceContext);
  }, [serviceContext]);

  const deleteSingleGoal = useCallback(async (goalId: string) => {
    if (!serviceContext) return;
    await deleteGoal(goalId, serviceContext);
  }, [serviceContext]);

  const contributeToGoal = useCallback(async (goalId: string, amount: number) => {
    if (!serviceContext) return;
    await contributeGoal(goalId, amount, serviceContext);
  }, [serviceContext]);

  const addReminder = useCallback(async (reminder: Partial<Reminder>) => {
    if (!serviceContext) return;
    await createReminder(reminder, serviceContext);
  }, [serviceContext]);

  const addReminders = useCallback(async (items: Partial<Reminder>[]) => {
    for (const item of items) {
      await addReminder(item);
    }
  }, [addReminder]);

  const updateSingleReminder = useCallback(async (reminder: Reminder) => {
    if (!serviceContext) return;
    await updateReminder(reminder, serviceContext);
  }, [serviceContext]);

  const deleteSingleReminder = useCallback(async (reminderId: string) => {
    if (!serviceContext) return;
    await deleteReminder(reminderId, serviceContext);
  }, [serviceContext]);

  const toggleSingleReminder = useCallback(async (reminderId: string) => {
    if (!serviceContext) return;
    await toggleReminder(reminderId, serviceContext);
  }, [serviceContext]);

  const addSingleAlert = useCallback(async (alert: Omit<Alert, 'id'>) => {
    if (!serviceContext) return;
    await createAlert(alert, serviceContext);
  }, [serviceContext]);

  const deleteSingleAlert = useCallback(async (alertId: string) => {
    if (!serviceContext) return;
    await deleteAlert(alertId, serviceContext);
  }, [serviceContext]);

  return {
    transactions,
    accounts,
    goals,
    reminders,
    alerts,
    addTransactions,
    updateTransaction: updateSingleTransaction,
    deleteTransaction: deleteSingleTransaction,
    deleteTransactions: deleteMultipleTransactions,
    createAccount: createSingleAccount,
    updateAccount: updateSingleAccount,
    deleteAccount: deleteSingleAccount,
    createGoal: createSingleGoal,
    updateGoal: updateSingleGoal,
    deleteGoal: deleteSingleGoal,
    contributeGoal: contributeToGoal,
    addReminder,
    addReminders,
    updateReminder: updateSingleReminder,
    deleteReminder: deleteSingleReminder,
    toggleReminder: toggleSingleReminder,
    addAlert: addSingleAlert,
    deleteAlert: deleteSingleAlert,
  };
}
