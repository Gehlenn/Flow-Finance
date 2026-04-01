import { useState } from 'react';
import { Account } from '../models/Account';
import { Alert, Category, Goal, Reminder, Transaction, TransactionType } from '../types';

interface UseCashFlowStateOptions {
  userId: string | null;
  cloudSyncEnabled: boolean;
  setCloudSyncEnabled: (enabled: boolean) => void;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  setSyncStatus: (status: 'idle' | 'syncing' | 'synced' | 'error') => void;
}

export function useCashFlowState(_options: UseCashFlowStateOptions) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts] = useState<Alert[]>([]);
  const [reminders] = useState<Reminder[]>([]);
  const [goals] = useState<Goal[]>([]);
  const [accounts] = useState<Account[]>([]);

  const handleAddTransactions = (newItems: Partial<Transaction>[]) => {
    const normalized = newItems.map((item) => ({
      ...item,
      id: item.id || Math.random().toString(36).slice(2, 11),
      amount: item.amount || 0,
      description: item.description || 'Lancamento Flow',
      type: (item.type as TransactionType) || TransactionType.DESPESA,
      category: (item.category as Category) || Category.PESSOAL,
      date: item.date || new Date().toISOString(),
    })) as Transaction[];

    setTransactions((current) => [...normalized, ...current]);
  };

  return {
    transactions,
    alerts,
    reminders,
    goals,
    accounts,
    handleAddTransactions,
  };
}
