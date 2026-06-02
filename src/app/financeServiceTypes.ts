import type { Account } from '../../models/Account';
import type { Alert, Goal, Reminder, Receivable, Transaction } from '../../types';

export type FinancialCollections = {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  reminders: Reminder[];
  receivables: Receivable[];
  alerts: Alert[];
};

export type EntityCollections = Pick<FinancialCollections, 'accounts' | 'transactions' | 'goals' | 'reminders' | 'receivables'>;
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
