import { Firestore } from 'firebase-admin/firestore';
import { getFirestoreOrNull, isFirebaseConfigured } from '../../utils/firestoreAdmin';
import { Tenant, Workspace, WorkspacePlan, WorkspaceSubscription, WorkspaceUser } from '../../types';
import { buildEntitlements, normalizeTenant, normalizeWorkspace } from './workspaceStoreHelpers';

const TENANTS_COLLECTION = 'tenants';
const WORKSPACES_COLLECTION = 'workspaces';
const WORKSPACE_MEMBERS_COLLECTION = 'workspace_members';
const USERS_COLLECTION = 'users';

function nowIso(): string {
  return new Date().toISOString();
}

async function getDb(): Promise<Firestore | null> {
  return getFirestoreOrNull('WorkspaceStoreFirestore');
}

function tenantCollection(db: Firestore) {
  return db.collection(TENANTS_COLLECTION);
}

function workspaceCollection(db: Firestore) {
  return db.collection(WORKSPACES_COLLECTION);
}

function workspaceMembersCollection(db: Firestore) {
  return db.collection(WORKSPACE_MEMBERS_COLLECTION);
}

function usersCollection(db: Firestore) {
  return db.collection(USERS_COLLECTION);
}

function workspaceMemberDocId(workspaceId: string, userId: string): string {
  return `${workspaceId}_${userId}`;
}

function toTenant(data: Record<string, unknown>, tenantId: string): Tenant {
  return normalizeTenant({
    tenantId,
    name: String(data.name || ''),
    plan: (data.plan === 'pro' ? 'pro' : 'free') as WorkspacePlan,
    createdAt: String(data.createdAt || nowIso()),
    updatedAt: String(data.updatedAt || data.createdAt || nowIso()),
  });
}

function toWorkspace(data: Record<string, unknown>, workspaceId: string): Workspace {
  const plan = data.plan === 'pro' ? 'pro' : 'free';
  return normalizeWorkspace({
    workspaceId,
    tenantId: String(data.tenantId || workspaceId),
    name: String(data.name || ''),
    isDefault: Boolean(data.isDefault),
    createdAt: String(data.createdAt || nowIso()),
    updatedAt: String(data.updatedAt || data.createdAt || nowIso()),
    plan,
    status: data.status === 'suspended' ? 'suspended' : 'active',
    billingEmail: typeof data.billingEmail === 'string' ? data.billingEmail : undefined,
    billingCustomerId: typeof data.billingCustomerId === 'string' ? data.billingCustomerId : undefined,
    subscription: data.subscription as WorkspaceSubscription | undefined,
    entitlements: (data.entitlements as Workspace['entitlements']) || buildEntitlements(plan),
  });
}

function toWorkspaceUser(data: Record<string, unknown>, docId: string): WorkspaceUser {
  return {
    userId: String(data.userId || docId),
    workspaceId: String(data.workspaceId || ''),
    tenantId: String(data.tenantId || ''),
    role: data.role === 'owner' || data.role === 'admin' || data.role === 'viewer' ? data.role : 'member',
    joinedAt: String(data.joinedAt || data.createdAt || nowIso()),
    invitedBy: typeof data.invitedBy === 'string' ? data.invitedBy : undefined,
    status: data.status === 'invited' || data.status === 'removed' ? data.status : 'active',
  };
}

export async function getWorkspaceFirestoreStatus(): Promise<{
  configured: boolean;
  ready: boolean;
}> {
  if (!isFirebaseConfigured()) {
    return { configured: false, ready: false };
  }

  const db = await getDb();
  return { configured: true, ready: db !== null };
}

export async function createTenantInFirestore(name: string, ownerUserId: string): Promise<{ tenant: Tenant; workspace: Workspace }> {
  const db = await getDb();
  if (!db) {
    throw new Error('Firestore unavailable');
  }

  const createdAt = nowIso();
  const tenantRef = tenantCollection(db).doc();
  const workspaceRef = workspaceCollection(db).doc();
  const membershipRef = workspaceMembersCollection(db).doc(workspaceMemberDocId(workspaceRef.id, ownerUserId));

  const tenant: Tenant = {
    tenantId: tenantRef.id,
    name: name.trim(),
    plan: 'free',
    createdAt,
    updatedAt: createdAt,
  };

  const workspace: Workspace = {
    workspaceId: workspaceRef.id,
    tenantId: tenantRef.id,
    name: name.trim(),
    isDefault: true,
    createdAt,
    updatedAt: createdAt,
    plan: 'free',
    status: 'active',
    entitlements: buildEntitlements('free'),
  };

  const batch = db.batch();
  batch.set(tenantRef, {
    id: tenant.tenantId,
    name: tenant.name,
    plan: tenant.plan,
    createdAt,
    updatedAt: createdAt,
    ownerUserId,
  });
  batch.set(workspaceRef, {
    id: workspace.workspaceId,
    tenantId: workspace.tenantId,
    name: workspace.name,
    plan: workspace.plan,
    isDefault: true,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    entitlements: workspace.entitlements,
  });
  batch.set(membershipRef, {
    id: membershipRef.id,
    tenantId: tenant.tenantId,
    workspaceId: workspace.workspaceId,
    userId: ownerUserId,
    role: 'owner',
    status: 'active',
    joinedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  });
  batch.set(usersCollection(db).doc(ownerUserId), {
    activeTenantId: tenant.tenantId,
    activeWorkspaceId: workspace.workspaceId,
    updatedAt: createdAt,
  }, { merge: true });
  await batch.commit();

  return { tenant, workspace };
}

export async function createWorkspaceInFirestore(name: string, ownerUserId: string, tenantId: string): Promise<Workspace> {
  const db = await getDb();
  if (!db) {
    throw new Error('Firestore unavailable');
  }

  const tenantSnapshot = await tenantCollection(db).doc(tenantId).get();
  if (!tenantSnapshot.exists) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const tenant = toTenant((tenantSnapshot.data() || {}) as Record<string, unknown>, tenantSnapshot.id);
  const createdAt = nowIso();
  const workspaceRef = workspaceCollection(db).doc();
  const membershipRef = workspaceMembersCollection(db).doc(workspaceMemberDocId(workspaceRef.id, ownerUserId));

  const workspace: Workspace = {
    workspaceId: workspaceRef.id,
    tenantId,
    name: name.trim(),
    isDefault: false,
    createdAt,
    updatedAt: createdAt,
    plan: tenant.plan,
    status: 'active',
    entitlements: buildEntitlements(tenant.plan),
  };

  const batch = db.batch();
  batch.set(workspaceRef, {
    id: workspace.workspaceId,
    tenantId: workspace.tenantId,
    name: workspace.name,
    plan: workspace.plan,
    isDefault: false,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    entitlements: workspace.entitlements,
  });
  batch.set(membershipRef, {
    id: membershipRef.id,
    tenantId,
    workspaceId: workspace.workspaceId,
    userId: ownerUserId,
    role: 'owner',
    status: 'active',
    joinedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  });
  batch.set(tenantCollection(db).doc(tenantId), {
    updatedAt: createdAt,
  }, { merge: true });
  batch.set(usersCollection(db).doc(ownerUserId), {
    activeTenantId: tenantId,
    activeWorkspaceId: workspace.workspaceId,
    updatedAt: createdAt,
  }, { merge: true });
  await batch.commit();

  return workspace;
}

export async function getWorkspaceFromFirestore(workspaceId: string): Promise<Workspace | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const snapshot = await workspaceCollection(db).doc(workspaceId).get();
  if (!snapshot.exists) {
    return undefined;
  }

  return toWorkspace((snapshot.data() || {}) as Record<string, unknown>, snapshot.id);
}

export async function listWorkspacesForUserFromFirestore(userId: string): Promise<Workspace[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const membershipSnapshot = await workspaceMembersCollection(db)
    .where('userId', '==', userId)
    .get();

  const memberships = membershipSnapshot.docs
    .map((snapshot) => toWorkspaceUser((snapshot.data() || {}) as Record<string, unknown>, snapshot.id))
    .filter((membership) => membership.status === 'active');

  if (!memberships.length) {
    return [];
  }

  const workspaceSnapshots = await Promise.all(
    memberships.map((membership) => workspaceCollection(db).doc(membership.workspaceId).get()),
  );

  return workspaceSnapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => toWorkspace((snapshot.data() || {}) as Record<string, unknown>, snapshot.id));
}

export async function listTenantsForUserFromFirestore(userId: string): Promise<Tenant[]> {
  const workspaces = await listWorkspacesForUserFromFirestore(userId);
  if (!workspaces.length) {
    return [];
  }

  const db = await getDb();
  if (!db) {
    return [];
  }

  const tenantIds = [...new Set(workspaces.map((workspace) => workspace.tenantId))];
  const tenantSnapshots = await Promise.all(
    tenantIds.map((tenantId) => tenantCollection(db).doc(tenantId).get()),
  );

  return tenantSnapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => toTenant((snapshot.data() || {}) as Record<string, unknown>, snapshot.id));
}

export async function getTenantFromFirestore(tenantId: string): Promise<Tenant | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const snapshot = await tenantCollection(db).doc(tenantId).get();
  if (!snapshot.exists) {
    return undefined;
  }

  return toTenant((snapshot.data() || {}) as Record<string, unknown>, snapshot.id);
}

export async function getWorkspaceUsersFromFirestore(workspaceId: string): Promise<WorkspaceUser[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const snapshot = await workspaceMembersCollection(db)
    .where('workspaceId', '==', workspaceId)
    .get();

  return snapshot.docs
    .map((docSnapshot) => toWorkspaceUser((docSnapshot.data() || {}) as Record<string, unknown>, docSnapshot.id))
    .filter((membership) => membership.status === 'active');
}

export async function addWorkspaceUserToFirestore(
  workspaceId: string,
  userId: string,
  role: WorkspaceUser['role'],
  invitedBy?: string,
): Promise<WorkspaceUser | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const workspace = await getWorkspaceFromFirestore(workspaceId);
  if (!workspace) {
    return undefined;
  }

  const docId = workspaceMemberDocId(workspaceId, userId);
  const memberRef = workspaceMembersCollection(db).doc(docId);
  const current = await memberRef.get();
  if (current.exists) {
    return toWorkspaceUser((current.data() || {}) as Record<string, unknown>, current.id);
  }

  const joinedAt = nowIso();
  const workspaceUser: WorkspaceUser = {
    userId,
    workspaceId,
    tenantId: workspace.tenantId,
    role,
    invitedBy,
    joinedAt,
    status: 'active',
  };

  await memberRef.set({
    id: docId,
    ...workspaceUser,
    createdAt: joinedAt,
    updatedAt: joinedAt,
  });

  return workspaceUser;
}

export async function removeWorkspaceUserFromFirestore(userId: string, workspaceId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  const docId = workspaceMemberDocId(workspaceId, userId);
  const memberRef = workspaceMembersCollection(db).doc(docId);
  const current = await memberRef.get();
  if (!current.exists) {
    return false;
  }

  await memberRef.set({
    status: 'removed',
    updatedAt: nowIso(),
  }, { merge: true });

  return true;
}

export async function setLastWorkspaceForUserInFirestore(userId: string, workspaceId: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  const workspace = await getWorkspaceFromFirestore(workspaceId);
  await usersCollection(db).doc(userId).set({
    activeWorkspaceId: workspaceId,
    activeTenantId: workspace?.tenantId,
    updatedAt: nowIso(),
  }, { merge: true });
}

export async function getLastWorkspaceForUserFromFirestore(userId: string): Promise<Workspace | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const snapshot = await usersCollection(db).doc(userId).get();
  if (!snapshot.exists) {
    return undefined;
  }

  const activeWorkspaceId = snapshot.get('activeWorkspaceId');
  if (typeof activeWorkspaceId !== 'string' || !activeWorkspaceId.trim()) {
    return undefined;
  }

  return getWorkspaceFromFirestore(activeWorkspaceId);
}

export async function findWorkspaceByBillingCustomerIdFromFirestore(billingCustomerId: string): Promise<Workspace | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const snapshot = await workspaceCollection(db)
    .where('billingCustomerId', '==', billingCustomerId)
    .limit(1)
    .get();

  const first = snapshot.docs[0];
  if (!first) {
    return undefined;
  }

  return toWorkspace((first.data() || {}) as Record<string, unknown>, first.id);
}

export async function updateWorkspaceBillingInFirestore(
  workspaceId: string,
  input: {
    plan?: WorkspacePlan;
    billingEmail?: string;
    billingCustomerId?: string;
    subscription?: WorkspaceSubscription;
  },
): Promise<Workspace | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const workspace = await getWorkspaceFromFirestore(workspaceId);
  if (!workspace) {
    return undefined;
  }

  const nextPlan = input.plan || workspace.plan;
  const updatedAt = nowIso();
  const updatedWorkspace: Workspace = normalizeWorkspace({
    ...workspace,
    plan: nextPlan,
    billingEmail: input.billingEmail || workspace.billingEmail,
    billingCustomerId: input.billingCustomerId || workspace.billingCustomerId,
    subscription: input.subscription || workspace.subscription,
    entitlements: buildEntitlements(nextPlan),
    updatedAt,
    status: 'active',
  });

  const batch = db.batch();
  batch.set(workspaceCollection(db).doc(workspaceId), {
    plan: updatedWorkspace.plan,
    billingEmail: updatedWorkspace.billingEmail,
    billingCustomerId: updatedWorkspace.billingCustomerId,
    subscription: updatedWorkspace.subscription,
    entitlements: updatedWorkspace.entitlements,
    status: updatedWorkspace.status,
    updatedAt,
  }, { merge: true });
  batch.set(tenantCollection(db).doc(updatedWorkspace.tenantId), {
    plan: updatedWorkspace.plan,
    updatedAt,
  }, { merge: true });
  await batch.commit();

  return updatedWorkspace;
}
