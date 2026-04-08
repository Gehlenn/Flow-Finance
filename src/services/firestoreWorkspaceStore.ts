import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  QueryConstraint,
  startAfter,
  query,
  setDoc,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { Account } from '../../models/Account';
import { Goal, Transaction, Alert, Reminder } from '../../types';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type WorkspaceSummary = {
  workspaceId: string;
  tenantId: string;
  name: string;
  tenantName?: string;
  plan: 'free' | 'pro';
  role: WorkspaceRole;
  isDefault: boolean;
};

export type TenantDocument = {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  createdAt: string;
  updatedAt: string;
  ownerUserId: string;
};

export type WorkspaceDocument = {
  id: string;
  tenantId: string;
  tenantName?: string;
  name: string;
  plan: 'free' | 'pro';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMemberDocument = {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: 'active' | 'invited' | 'disabled';
  createdAt: string;
  updatedAt: string;
};

export type TenantMemberDocument = {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
};

export type AuditLogDocument = {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogCursor = {
  createdAt: string;
  id: string;
};

export type WorkspaceInsightDocument = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  severity?: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WorkspaceImportDocument = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  user_id: string;
  source: string;
  status: 'pending' | 'completed' | 'failed';
  imported_count?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WorkspaceSubscriptionDocument = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  merchant?: string;
  amount: number;
  cycle: 'monthly' | 'weekly' | 'annual' | 'unknown';
  status: 'active' | 'paused' | 'cancelled';
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserIdentity = {
  userId: string;
  name?: string | null;
  email?: string | null;
};

export type SyncEntity = 'accounts' | 'transactions' | 'goals' | 'reminders';
export type WorkspaceScopedEntity = SyncEntity | 'insights' | 'imports' | 'subscriptions';

export type ProfileState = {
  name: string | null;
  theme: 'light' | 'dark';
  alerts: Alert[];
  reminders: Reminder[];
};

export type EntityState = {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  reminders: Reminder[];
};

export type SyncEntityIdMap = Record<string, string>;

const DEFAULT_WORKSPACE_NAME = 'Workspace Pessoal';
const DEFAULT_TENANT_NAME = 'Tenant Pessoal';

function nowIso(): string {
  return new Date().toISOString();
}

function getCurrentUserId(): string | null {
  return auth.currentUser?.uid || null;
}

function buildTenantName(identity: UserIdentity): string {
  const trimmed = identity.name?.trim();
  return trimmed && trimmed.length > 0 ? `Tenant de ${trimmed}` : DEFAULT_TENANT_NAME;
}

function buildWorkspaceName(identity: UserIdentity, explicitName?: string): string {
  const trimmedExplicit = explicitName?.trim();
  if (trimmedExplicit) {
    return trimmedExplicit;
  }

  const trimmed = identity.name?.trim();
  return trimmed && trimmed.length > 0 ? `Workspace de ${trimmed}` : DEFAULT_WORKSPACE_NAME;
}

function membershipCollection() {
  return collection(db, 'workspace_members');
}

function workspaceCollection() {
  return collection(db, 'workspaces');
}

function tenantCollection() {
  return collection(db, 'tenants');
}

function tenantMemberCollection() {
  return collection(db, 'tenant_members');
}

function workspaceEntityCollection(workspaceId: string, entity: WorkspaceScopedEntity) {
  return collection(db, 'workspaces', workspaceId, entity);
}

function auditEventCollection(tenantId: string) {
  return collection(db, 'audit_logs', tenantId, 'events');
}

function workspaceMemberDocId(workspaceId: string, userId: string): string {
  return `${workspaceId}_${userId}`;
}

function tenantMemberDocId(tenantId: string, userId: string): string {
  return `${tenantId}_${userId}`;
}

export async function writeAuditLogEvent(event: Omit<AuditLogDocument, 'id' | 'createdAt'>): Promise<void> {
  const eventRef = doc(auditEventCollection(event.tenantId));
  await setDoc(eventRef, {
    id: eventRef.id,
    ...event,
    createdAt: nowIso(),
  } satisfies AuditLogDocument);
}

export async function listUserWorkspaceSummaries(userId?: string | null): Promise<WorkspaceSummary[]> {
  const resolvedUserId = userId || getCurrentUserId();
  if (!resolvedUserId) {
    return [];
  }

  const memberSnapshot = await getDocs(query(
    membershipCollection(),
    where('userId', '==', resolvedUserId),
    where('status', '==', 'active'),
  ));

  if (memberSnapshot.empty) {
    return [];
  }

  const memberships = memberSnapshot.docs.map((snapshot) => snapshot.data() as WorkspaceMemberDocument);
  const workspaceDocs = await Promise.all(memberships.map((membership) =>
    getDoc(doc(db, 'workspaces', membership.workspaceId)),
  ));

  const workspaceById = new Map(
    workspaceDocs
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => {
        const data = snapshot.data() as WorkspaceDocument;
        return [snapshot.id, data] as const;
      }),
  );

  const summaries: WorkspaceSummary[] = [];

  for (const membership of memberships) {
    const workspace = workspaceById.get(membership.workspaceId);
    if (!workspace) {
      continue;
    }

    summaries.push({
      workspaceId: membership.workspaceId,
      tenantId: membership.tenantId,
      name: workspace.name,
      tenantName: workspace.tenantName || workspace.name,
      plan: workspace.plan || 'free',
      role: membership.role || 'member',
      isDefault: workspace.isDefault ?? false,
    });
  }

  return summaries.sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }
      return left.name.localeCompare(right.name, 'pt-BR');
    });
}

export async function createPersonalWorkspace(identity: UserIdentity, explicitName?: string): Promise<WorkspaceSummary> {
  const tenantRef = doc(tenantCollection());
  const workspaceRef = doc(workspaceCollection());
  const memberRef = doc(membershipCollection(), `${workspaceRef.id}_${identity.userId}`);
  const now = nowIso();
  const tenantName = buildTenantName(identity);
  const workspaceName = buildWorkspaceName(identity, explicitName);

  const tenant: TenantDocument = {
    id: tenantRef.id,
    name: tenantName,
    plan: 'free',
    createdAt: now,
    updatedAt: now,
    ownerUserId: identity.userId,
  };

  const workspace: WorkspaceDocument = {
    id: workspaceRef.id,
    tenantId: tenantRef.id,
    tenantName,
    name: workspaceName,
    plan: 'free',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };

  const membership: WorkspaceMemberDocument = {
    id: memberRef.id,
    tenantId: tenantRef.id,
    workspaceId: workspaceRef.id,
    userId: identity.userId,
    role: 'owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const auditRef = doc(auditEventCollection(tenantRef.id));
  const batch = writeBatch(db);
  batch.set(tenantRef, tenant);
  batch.set(workspaceRef, workspace);
  batch.set(memberRef, membership);
  batch.set(doc(db, 'users', identity.userId), {
    name: identity.name || null,
    email: identity.email || null,
    activeTenantId: tenant.id,
    activeWorkspaceId: workspace.id,
    updatedAt: now,
  }, { merge: true });
  batch.set(auditRef, {
    id: auditRef.id,
    tenantId: tenant.id,
    workspaceId: workspace.id,
    userId: identity.userId,
    action: 'workspace.created',
    resourceType: 'workspace',
    resourceId: workspace.id,
    metadata: {
      workspaceName: workspace.name,
      tenantName: tenant.name,
      source: 'firestore-bootstrap',
    },
    createdAt: now,
  } satisfies AuditLogDocument);
  await batch.commit();
  await setDoc(doc(tenantMemberCollection(), tenantMemberDocId(tenant.id, identity.userId)), {
    id: tenantMemberDocId(tenant.id, identity.userId),
    tenantId: tenant.id,
    workspaceId: workspace.id,
    userId: identity.userId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  } satisfies TenantMemberDocument, { merge: true });

  return {
    workspaceId: workspace.id,
    tenantId: tenant.id,
    name: workspace.name,
    tenantName: tenant.name,
    plan: workspace.plan,
    role: 'owner',
    isDefault: workspace.isDefault,
  };
}

export async function ensureActiveWorkspaceForUser(identity: UserIdentity): Promise<WorkspaceSummary> {
  const workspaces = await listUserWorkspaceSummaries(identity.userId);
  if (workspaces.length > 0) {
    return workspaces[0];
  }

  return createPersonalWorkspace(identity);
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberDocument[]> {
  const snapshot = await getDocs(query(
    membershipCollection(),
    where('workspaceId', '==', workspaceId),
    where('status', '==', 'active'),
  ));

  return snapshot.docs
    .map((memberSnapshot) => memberSnapshot.data() as WorkspaceMemberDocument)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function addWorkspaceMember(input: {
  tenantId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  invitedByUserId: string;
}): Promise<WorkspaceMemberDocument> {
  const now = nowIso();
  const memberId = workspaceMemberDocId(input.workspaceId, input.userId);
  const memberRef = doc(membershipCollection(), memberId);
  const tenantMemberRef = doc(tenantMemberCollection(), tenantMemberDocId(input.tenantId, input.userId));
  const member: WorkspaceMemberDocument = {
    id: memberId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    role: input.role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await Promise.all([
    setDoc(memberRef, member, { merge: true }),
    setDoc(tenantMemberRef, {
      id: tenantMemberRef.id,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } satisfies TenantMemberDocument, { merge: true }),
  ]);
  await writeAuditLogEvent({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.invitedByUserId,
    action: 'workspace.member_added',
    resourceType: 'workspace_member',
    resourceId: memberId,
    metadata: {
      memberUserId: input.userId,
      role: input.role,
    },
  });

  return member;
}

export async function removeWorkspaceMember(input: {
  tenantId: string;
  workspaceId: string;
  userId: string;
  removedByUserId: string;
}): Promise<void> {
  const memberRef = doc(membershipCollection(), workspaceMemberDocId(input.workspaceId, input.userId));
  const tenantMemberRef = doc(tenantMemberCollection(), tenantMemberDocId(input.tenantId, input.userId));

  await setDoc(memberRef, {
    status: 'disabled',
    updatedAt: nowIso(),
  }, { merge: true });

  const remainingMemberships = await getDocs(query(
    membershipCollection(),
    where('tenantId', '==', input.tenantId),
    where('userId', '==', input.userId),
    where('status', '==', 'active'),
  ));

  if (remainingMemberships.empty) {
    await setDoc(tenantMemberRef, {
      status: 'disabled',
      updatedAt: nowIso(),
    }, { merge: true });
  }

  await writeAuditLogEvent({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.removedByUserId,
    action: 'workspace.member_removed',
    resourceType: 'workspace_member',
    resourceId: workspaceMemberDocId(input.workspaceId, input.userId),
    metadata: {
      memberUserId: input.userId,
    },
  });
}

export async function listWorkspaceAuditEvents(input: {
  tenantId: string;
  workspaceId: string;
  maxItems?: number;
  fromDate?: string;
  toDate?: string;
  resourceType?: string;
}): Promise<AuditLogDocument[]> {
  const page = await listWorkspaceAuditEventsPage(input);
  return page.events;
}

export async function listWorkspaceAuditEventsPage(input: {
  tenantId: string;
  workspaceId: string;
  maxItems?: number;
  fromDate?: string;
  toDate?: string;
  resourceType?: string;
  after?: AuditLogCursor | null;
}): Promise<{ events: AuditLogDocument[]; nextCursor: AuditLogCursor | null }> {
  const constraints: QueryConstraint[] = [
    where('workspaceId', '==', input.workspaceId),
  ];

  if (input.resourceType) {
    constraints.push(where('resourceType', '==', input.resourceType));
  }

  if (input.fromDate) {
    constraints.push(where('createdAt', '>=', input.fromDate));
  }

  if (input.toDate) {
    constraints.push(where('createdAt', '<=', input.toDate));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(orderBy('id', 'desc'));
  if (input.after) {
    constraints.push(startAfter(input.after.createdAt, input.after.id));
  }
  constraints.push(limit(input.maxItems || 25));

  const snapshot = await getDocs(query(
    auditEventCollection(input.tenantId),
    ...constraints,
  ));

  const events = snapshot.docs.map((auditSnapshot) => auditSnapshot.data() as AuditLogDocument);
  const nextCursor = events.length === (input.maxItems || 25)
    ? {
      createdAt: events[events.length - 1]?.createdAt || '',
      id: events[events.length - 1]?.id || '',
    }
    : null;

  return {
    events,
    nextCursor,
  };
}

export async function listWorkspaceCollectionDocuments<T extends { id: string }>(
  workspaceId: string,
  entity: Extract<WorkspaceScopedEntity, 'insights' | 'imports' | 'subscriptions'>,
): Promise<T[]> {
  const snapshot = await getDocs(query(
    workspaceEntityCollection(workspaceId, entity),
    orderBy('updated_at', 'desc'),
  ));

  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as T);
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
  const stamped = stampEntityContext(documentInput, context);
  await setDoc(
    doc(workspaceEntityCollection(context.workspaceId, entity), String(stamped.id)),
    stamped,
    { merge: true },
  );

  return stamped;
}

export function subscribeToUserProfile(
  userId: string,
  onNext: (profile: ProfileState) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', userId),
    (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() as Partial<ProfileState> & { name?: string | null; theme?: 'light' | 'dark' } : {};
      onNext({
        name: data.name || null,
        theme: data.theme === 'dark' ? 'dark' : 'light',
        alerts: Array.isArray(data.alerts) ? data.alerts as Alert[] : [],
        reminders: Array.isArray(data.reminders) ? data.reminders as Reminder[] : [],
      });
    },
    onError,
  );
}

export async function saveUserProfile(userId: string, updates: Partial<ProfileState & { name: string }>): Promise<void> {
  await setDoc(doc(db, 'users', userId), {
    ...updates,
    updatedAt: nowIso(),
  }, { merge: true });
}

function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) => String(right.date).localeCompare(String(left.date)));
}

function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((left, right) => String(left.name).localeCompare(String(right.name), 'pt-BR'));
}

function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((left, right) => String(left.title).localeCompare(String(right.title), 'pt-BR'));
}

function sortReminders(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((left, right) => String(left.date).localeCompare(String(right.date), 'pt-BR'));
}

export async function loadWorkspaceEntities(workspaceId: string): Promise<EntityState> {
  const [accountSnapshot, transactionSnapshot, goalSnapshot, reminderSnapshot] = await Promise.all([
    getDocs(workspaceEntityCollection(workspaceId, 'accounts')),
    getDocs(workspaceEntityCollection(workspaceId, 'transactions')),
    getDocs(workspaceEntityCollection(workspaceId, 'goals')),
    getDocs(workspaceEntityCollection(workspaceId, 'reminders')),
  ]);

  return {
    accounts: sortAccounts(accountSnapshot.docs.map((snapshot) => snapshot.data() as Account)),
    transactions: sortTransactions(transactionSnapshot.docs.map((snapshot) => snapshot.data() as Transaction)),
    goals: sortGoals(goalSnapshot.docs.map((snapshot) => snapshot.data() as Goal)),
    reminders: sortReminders(reminderSnapshot.docs.map((snapshot) => snapshot.data() as Reminder)),
  };
}

function resolveAuditAction(entity: SyncEntity, operation: 'created' | 'updated' | 'deleted'): string {
  const singular = entity === 'accounts'
    ? 'account'
    : entity === 'transactions'
      ? 'transaction'
      : entity === 'goals'
        ? 'goal'
        : 'reminder';
  return `${singular}.${operation}`;
}

function stampEntityContext<T extends { id: string } & Record<string, unknown>>(
  entity: T,
  context: { userId: string; tenantId: string; workspaceId: string },
): T {
  return {
    ...entity,
    user_id: typeof entity.user_id === 'string' ? entity.user_id : context.userId,
    tenant_id: typeof entity.tenant_id === 'string' ? entity.tenant_id : context.tenantId,
    workspace_id: typeof entity.workspace_id === 'string' ? entity.workspace_id : context.workspaceId,
    updated_at: typeof entity.updated_at === 'string' ? entity.updated_at : nowIso(),
    created_at: typeof entity.created_at === 'string' ? entity.created_at : nowIso(),
  };
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

    return stampEntityContext({
      ...item,
      id: serverId,
    }, context);
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
