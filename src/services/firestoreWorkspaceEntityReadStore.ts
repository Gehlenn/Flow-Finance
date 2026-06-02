import { collection, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import { Account } from '../../models/Account';
import { Goal, Receivable, Reminder, Transaction } from '../../types';
import type { EntityState, WorkspaceScopedEntity } from './firestoreWorkspaceTypes';
import {
  createEmptyEntityState,
  hasWorkspaceId,
  loadE2ESeedEntities,
  sortAccounts,
  sortGoals,
  sortReceivables,
  sortReminders,
  sortTransactions,
} from './firestoreWorkspaceEntityHelpers';

function workspaceEntityCollection(workspaceId: string, entity: WorkspaceScopedEntity) {
  return collection(db, 'workspaces', workspaceId, entity);
}

export async function listWorkspaceCollectionDocuments<T extends { id: string }>(
  workspaceId: string,
  entity: Extract<WorkspaceScopedEntity, 'insights' | 'imports' | 'subscriptions'>,
): Promise<T[]> {
  if (!isFirebaseConfigured || !hasWorkspaceId(workspaceId)) {
    return [];
  }

  const snapshot = await getDocs(workspaceEntityCollection(workspaceId, entity));
  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as T);
}

export async function loadWorkspaceEntities(workspaceId: string): Promise<EntityState> {
  if (!hasWorkspaceId(workspaceId)) {
    return createEmptyEntityState();
  }

  const seeded = loadE2ESeedEntities(workspaceId);
  if (seeded) {
    return seeded;
  }

  if (!isFirebaseConfigured) {
    return createEmptyEntityState();
  }

  const [accountSnapshot, transactionSnapshot, goalSnapshot, reminderSnapshot, receivableSnapshot] = await Promise.all([
    getDocs(workspaceEntityCollection(workspaceId, 'accounts')),
    getDocs(workspaceEntityCollection(workspaceId, 'transactions')),
    getDocs(workspaceEntityCollection(workspaceId, 'goals')),
    getDocs(workspaceEntityCollection(workspaceId, 'reminders')),
    getDocs(workspaceEntityCollection(workspaceId, 'receivables')),
  ]);

  return {
    accounts: sortAccounts(accountSnapshot.docs.map((snapshot) => snapshot.data() as Account)),
    transactions: sortTransactions(transactionSnapshot.docs.map((snapshot) => snapshot.data() as Transaction)),
    goals: sortGoals(goalSnapshot.docs.map((snapshot) => snapshot.data() as Goal)),
    reminders: sortReminders(reminderSnapshot.docs.map((snapshot) => snapshot.data() as Reminder)),
    receivables: sortReceivables(receivableSnapshot.docs.map((snapshot) => snapshot.data() as Receivable)),
  };
}
