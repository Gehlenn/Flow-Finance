import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import type { AuditLogDocument, WorkspaceScopedEntity } from './firestoreWorkspaceTypes';
import type { SyncEntity } from './sync/syncTypes';
import {
  hasWorkspaceContext,
  nowIso,
  resolveAuditAction,
  stampEntityContext,
} from './firestoreWorkspaceEntityHelpers';

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefinedDeep(item)]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}

function workspaceEntityCollection(workspaceId: string, entity: WorkspaceScopedEntity) {
  return collection(db, 'workspaces', workspaceId, entity);
}

function auditEventCollection(tenantId: string) {
  return collection(db, 'audit_logs', tenantId, 'events');
}

export async function upsertWorkspaceCollectionDocument<T extends {
  id: string;
  tenant_id?: string;
  workspace_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
} & Record<string, unknown>>(
  entity: Extract<WorkspaceScopedEntity, 'insights' | 'imports' | 'subscriptions'>,
  documentInput: T,
  context: { userId: string; tenantId: string; workspaceId: string },
): Promise<T> {
  if (!isFirebaseConfigured) {
    throw new Error('Workspace sync requires Firebase configuration.');
  }
  if (!hasWorkspaceContext(context.workspaceId, context.tenantId)) {
    throw new Error('Workspace sync requires a workspaceId and tenantId.');
  }

  const stamped = stripUndefinedDeep(stampEntityContext(documentInput, context));
  await setDoc(
    doc(workspaceEntityCollection(context.workspaceId, entity), String(stamped.id)),
    stamped,
    { merge: true },
  );

  return stamped;
}

export async function replaceWorkspaceEntityCollection<T extends { id: string } & Record<string, unknown>>(
  entity: SyncEntity,
  nextItems: T[],
  previousItems: T[],
  context: { userId: string; tenantId: string; workspaceId: string },
): Promise<{
  success: boolean;
  upserted: number;
  deleted: number;
  latestServerUpdatedAt: string;
  reconciledIds: Array<{ clientId: string; serverId: string }>;
}> {
  if (!isFirebaseConfigured) {
    return {
      success: true,
      upserted: nextItems.length,
      deleted: Math.max(previousItems.length - nextItems.length, 0),
      latestServerUpdatedAt: nowIso(),
      reconciledIds: [],
    };
  }
  if (!hasWorkspaceContext(context.workspaceId, context.tenantId)) {
    throw new Error('Workspace sync requires a workspaceId and tenantId.');
  }

  const collectionRef = workspaceEntityCollection(context.workspaceId, entity);
  const batch = writeBatch(db);
  const now = nowIso();
  const previousById = new Map(previousItems.map((item) => [String(item.id), item]));
  const reconciledIds: Array<{ clientId: string; serverId: string }> = [];
  const normalizedNextItems = nextItems.map((item) => {
    const originalId = String(item.id);
    const serverId = originalId.startsWith('tmp_') || originalId.startsWith('flow_')
      ? doc(collectionRef).id
      : originalId;

    if (serverId !== originalId) {
      reconciledIds.push({ clientId: originalId, serverId });
    }

    return stripUndefinedDeep(stampEntityContext({
      ...item,
      id: serverId,
    }, context));
  });

  const nextIdSet = new Set(normalizedNextItems.map((item) => String(item.id)));
  let upserted = 0;
  let deleted = 0;

  for (const item of normalizedNextItems) {
    const previous = previousById.get(String(item.id));
    batch.set(doc(collectionRef, String(item.id)), item, { merge: true });

    const auditRef = doc(auditEventCollection(context.tenantId));
    batch.set(auditRef, {
      id: auditRef.id,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      action: resolveAuditAction(entity, previous ? 'updated' : 'created'),
      resourceType: entity,
      resourceId: String(item.id),
      metadata: {
        entity,
        workspaceId: context.workspaceId,
      },
      createdAt: now,
    } satisfies AuditLogDocument);

    upserted += 1;
  }

  for (const previous of previousItems) {
    if (nextIdSet.has(String(previous.id))) {
      continue;
    }

    batch.delete(doc(collectionRef, String(previous.id)));

    const auditRef = doc(auditEventCollection(context.tenantId));
    batch.set(auditRef, {
      id: auditRef.id,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      action: resolveAuditAction(entity, 'deleted'),
      resourceType: entity,
      resourceId: String(previous.id),
      metadata: {
        entity,
        workspaceId: context.workspaceId,
      },
      createdAt: now,
    } satisfies AuditLogDocument);

    deleted += 1;
  }

  await batch.commit();

  return {
    success: true,
    upserted,
    deleted,
    latestServerUpdatedAt: now,
    reconciledIds,
  };
}
