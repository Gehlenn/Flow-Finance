import { Account } from '../../../models/Account';
import { Goal, Receivable, Reminder, Transaction } from '../../../types';
import { extractSyncPayloads, pullSyncEntities } from './cloudSyncClient';

export interface WorkspaceSyncEntities {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  reminders: Reminder[];
  receivables: Receivable[];
}

type WorkspaceSyncPayload = Account | Transaction | Goal | Reminder | Receivable;

export function createEmptyWorkspaceSyncEntities(): WorkspaceSyncEntities {
  return {
    accounts: [],
    transactions: [],
    goals: [],
    reminders: [],
    receivables: [],
  };
}

export async function mapPulledWorkspaceSyncEntities(
  workspaceId: string,
): Promise<WorkspaceSyncEntities> {
  const syncData = await pullSyncEntities<WorkspaceSyncPayload>({ workspaceId });
  const entities = syncData.entities || {};

  return {
    accounts: extractSyncPayloads(entities.accounts || []) as Account[],
    transactions: extractSyncPayloads(entities.transactions || []) as Transaction[],
    goals: extractSyncPayloads(entities.goals || []) as Goal[],
    reminders: extractSyncPayloads(entities.reminders || []) as Reminder[],
    receivables: extractSyncPayloads(entities.receivables || []) as Receivable[],
  };
}
