import type { Receivable, Reminder } from '../../types';
import type { EntityCollections, FinanceServiceContext } from './financeServiceTypes';
import { removeReminderReceivable, upsertReminderReceivable } from '../finance/receivableService';

type SyncableCollectionKey = keyof EntityCollections;

export type ReminderReceivableContext = Pick<
  FinanceServiceContext,
  'userId' | 'tenantId' | 'workspaceId' | 'createId' | 'now'
>;

function buildCollectionUpdate<K extends SyncableCollectionKey>(
  key: K,
  items: EntityCollections[K],
): Partial<EntityCollections> {
  return { [key]: items } as Partial<EntityCollections>;
}

export async function syncEntityCollection<K extends SyncableCollectionKey>(
  context: FinanceServiceContext,
  key: K,
  nextItems: EntityCollections[K],
  previousItems: EntityCollections[K],
): Promise<EntityCollections[K]> {
  return (await syncEntityCollectionResult(context, key, nextItems, previousItems)).entities[key];
}

export async function syncEntityCollectionResult<K extends SyncableCollectionKey>(
  context: FinanceServiceContext,
  key: K,
  nextItems: EntityCollections[K],
  previousItems: EntityCollections[K],
): Promise<Awaited<ReturnType<FinanceServiceContext['syncEntities']>>> {
  const syncResult = await context.syncEntities(
    buildCollectionUpdate(key, nextItems),
    buildCollectionUpdate(key, previousItems),
  );

  return syncResult;
}

export function buildReminderReceivableContext(context: FinanceServiceContext): ReminderReceivableContext {
  return {
    userId: context.userId,
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    createId: context.createId,
    now: context.now,
  };
}

export function buildNextReminderReceivables(
  receivables: Receivable[],
  reminder: Reminder,
  context: FinanceServiceContext,
): Receivable[] {
  return upsertReminderReceivable(receivables, reminder, buildReminderReceivableContext(context));
}

export function removeReminderReceivableForReminder(
  receivables: Receivable[],
  reminderId: string,
): Receivable[] {
  return removeReminderReceivable(receivables, reminderId);
}

export async function syncReminderCollections(
  context: FinanceServiceContext,
  nextReminders: Reminder[],
  previousReminders: Reminder[],
  nextReceivables: Receivable[],
  previousReceivables: Receivable[],
): Promise<{ reminders: Reminder[]; receivables: Receivable[] }> {
  return syncReminderCollectionsResult(context, nextReminders, previousReminders, nextReceivables, previousReceivables);
}

export async function syncReminderCollectionsResult(
  context: FinanceServiceContext,
  nextReminders: Reminder[],
  previousReminders: Reminder[],
  nextReceivables: Receivable[],
  previousReceivables: Receivable[],
): Promise<{ reminders: Reminder[]; receivables: Receivable[] }> {
  const syncResult = await context.syncEntities(
    {
      reminders: nextReminders,
      receivables: nextReceivables,
    },
    {
      reminders: previousReminders,
      receivables: previousReceivables,
    },
  );

  return {
    reminders: syncResult.entities.reminders,
    receivables: syncResult.entities.receivables,
  };
}
