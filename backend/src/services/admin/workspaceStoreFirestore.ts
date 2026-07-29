import { Firestore } from 'firebase-admin/firestore';
import { getFirestoreOrNull, isFirebaseConfigured } from '../../utils/firestoreAdmin';
import { Tenant, Workspace, WorkspacePlan, WorkspaceSubscription, WorkspaceUser } from '../../types';
import { AppError } from '../../shared/AppError';
import { buildEntitlements, normalizeTenant, normalizeWorkspace } from './workspaceStoreHelpers';
import { assertCanAssignWorkspaceRole, assertCanRemoveWorkspaceMember } from './workspaceMembershipPolicy';

const TENANTS_COLLECTION = 'tenants';
const WORKSPACES_COLLECTION = 'workspaces';
const WORKSPACE_MEMBERS_COLLECTION = 'workspace_members';
const TENANT_MEMBERS_COLLECTION = 'tenant_members';
const AUDIT_LOGS_COLLECTION = 'audit_logs';
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

function tenantMembersCollection(db: Firestore) {
  return db.collection(TENANT_MEMBERS_COLLECTION);
}

function auditLogEventsCollection(db: Firestore, tenantId: string) {
  return db.collection(AUDIT_LOGS_COLLECTION).doc(tenantId).collection('events');
}

function usersCollection(db: Firestore) {
  return db.collection(USERS_COLLECTION);
}

function workspaceMemberDocId(workspaceId: string, userId: string): string {
  return `${workspaceId}_${userId}`;
}

function tenantMemberDocId(tenantId: string, userId: string): string {
  return `${tenantId}_${userId}`;
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

  return db.runTransaction(async (transaction) => {
    // The user document is a deterministic transaction guard: concurrent
    // onboarding requests for the same identity conflict and retry instead of
    // creating two personal tenants/workspaces.
    const userRef = usersCollection(db).doc(ownerUserId);
    await transaction.get(userRef);
    const memberships = await transaction.get(
      workspaceMembersCollection(db).where('userId', '==', ownerUserId),
    );

    for (const membershipSnapshot of memberships.docs) {
      const membership = toWorkspaceUser((membershipSnapshot.data() || {}) as Record<string, unknown>, membershipSnapshot.id);
      if (membership.status !== 'active' || membership.role !== 'owner') {
        continue;
      }

      const workspaceSnapshot = await transaction.get(workspaceCollection(db).doc(membership.workspaceId));
      if (!workspaceSnapshot.exists) {
        continue;
      }

      const workspace = toWorkspace((workspaceSnapshot.data() || {}) as Record<string, unknown>, workspaceSnapshot.id);
      if (!workspace.isDefault || workspace.status !== 'active') {
        continue;
      }

      const tenantSnapshot = await transaction.get(tenantCollection(db).doc(workspace.tenantId));
      if (!tenantSnapshot.exists) {
        continue;
      }

      const tenant = toTenant((tenantSnapshot.data() || {}) as Record<string, unknown>, tenantSnapshot.id);
      const updatedAt = nowIso();
      const tenantMembershipRef = tenantMembersCollection(db).doc(tenantMemberDocId(tenant.tenantId, ownerUserId));
      transaction.set(tenantMembershipRef, {
        id: tenantMembershipRef.id,
        tenantId: tenant.tenantId,
        workspaceId: workspace.workspaceId,
        userId: ownerUserId,
        role: 'owner',
        status: 'active',
        joinedAt: membership.joinedAt,
        updatedAt,
      }, { merge: true });
      transaction.set(userRef, {
        activeTenantId: tenant.tenantId,
        activeWorkspaceId: workspace.workspaceId,
        updatedAt,
      }, { merge: true });

      return { tenant, workspace };
    }

    const createdAt = nowIso();
    const tenantRef = tenantCollection(db).doc();
    const workspaceRef = workspaceCollection(db).doc();
    const membershipRef = workspaceMembersCollection(db).doc(workspaceMemberDocId(workspaceRef.id, ownerUserId));
    const tenantMembershipRef = tenantMembersCollection(db).doc(tenantMemberDocId(tenantRef.id, ownerUserId));
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

    transaction.set(tenantRef, {
      id: tenant.tenantId, name: tenant.name, plan: tenant.plan, createdAt, updatedAt: createdAt, ownerUserId,
    });
    transaction.set(workspaceRef, {
      id: workspace.workspaceId, tenantId: workspace.tenantId, name: workspace.name, plan: workspace.plan,
      isDefault: true, status: 'active', createdAt, updatedAt: createdAt, entitlements: workspace.entitlements,
    });
    transaction.set(membershipRef, {
      id: membershipRef.id, tenantId: tenant.tenantId, workspaceId: workspace.workspaceId, userId: ownerUserId,
      role: 'owner', status: 'active', joinedAt: createdAt, createdAt, updatedAt: createdAt,
    });
    transaction.set(tenantMembershipRef, {
      id: tenantMembershipRef.id, tenantId: tenant.tenantId, workspaceId: workspace.workspaceId, userId: ownerUserId,
      role: 'owner', status: 'active', joinedAt: createdAt, createdAt, updatedAt: createdAt,
    });
    transaction.set(userRef, {
      activeTenantId: tenant.tenantId, activeWorkspaceId: workspace.workspaceId, updatedAt: createdAt,
    }, { merge: true });

    return { tenant, workspace };
  });
}

export async function createWorkspaceInFirestore(name: string, ownerUserId: string, tenantId: string): Promise<Workspace> {
  const db = await getDb();
  if (!db) {
    throw new Error('Firestore unavailable');
  }

  return db.runTransaction(async (transaction) => {
    const tenantRef = tenantCollection(db).doc(tenantId);
    const tenantSnapshot = await transaction.get(tenantRef);
    if (!tenantSnapshot.exists) {
      throw new AppError(404, `Tenant ${tenantId} not found`);
    }
    if (tenantSnapshot.get('ownerUserId') !== ownerUserId) {
      throw new AppError(403, 'Apenas o owner do tenant pode criar workspaces');
    }

    const tenant = toTenant((tenantSnapshot.data() || {}) as Record<string, unknown>, tenantSnapshot.id);
    const createdAt = nowIso();
    const workspaceRef = workspaceCollection(db).doc();
    const membershipRef = workspaceMembersCollection(db).doc(workspaceMemberDocId(workspaceRef.id, ownerUserId));
    const tenantMembershipRef = tenantMembersCollection(db).doc(tenantMemberDocId(tenantId, ownerUserId));
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

    transaction.set(workspaceRef, {
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
    transaction.set(membershipRef, {
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
    transaction.set(tenantMembershipRef, {
      id: tenantMembershipRef.id,
      tenantId,
      workspaceId: workspace.workspaceId,
      userId: ownerUserId,
      role: 'owner',
      status: 'active',
      joinedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    }, { merge: true });
    transaction.set(tenantRef, { updatedAt: createdAt }, { merge: true });
    transaction.set(usersCollection(db).doc(ownerUserId), {
      activeTenantId: tenantId,
      activeWorkspaceId: workspace.workspaceId,
      updatedAt: createdAt,
    }, { merge: true });

    return workspace;
  });
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
  actorUserId: string,
): Promise<WorkspaceUser | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  return db.runTransaction(async (transaction) => {
    const workspaceRef = workspaceCollection(db).doc(workspaceId);
    const memberRef = workspaceMembersCollection(db).doc(workspaceMemberDocId(workspaceId, userId));
    const actorRef = workspaceMembersCollection(db).doc(workspaceMemberDocId(workspaceId, actorUserId));
    const [workspaceSnapshot, actorSnapshot, currentSnapshot] = await Promise.all([
      transaction.get(workspaceRef), transaction.get(actorRef), transaction.get(memberRef),
    ]);
    if (!workspaceSnapshot.exists) {
      return undefined;
    }

    const actor = actorSnapshot.exists
      ? toWorkspaceUser((actorSnapshot.data() || {}) as Record<string, unknown>, actorSnapshot.id)
      : undefined;
    assertCanAssignWorkspaceRole(actor?.status === 'active' ? actor.role : undefined, role);

    const currentMembership = currentSnapshot.exists
      ? toWorkspaceUser((currentSnapshot.data() || {}) as Record<string, unknown>, currentSnapshot.id)
      : undefined;
    if (currentMembership?.status === 'active' && currentMembership.role === 'owner' && role !== 'owner') {
      const workspaceMemberships = await transaction.get(workspaceMembersCollection(db).where('workspaceId', '==', workspaceId));
      const activeOwnerCount = workspaceMemberships.docs
        .map((snapshot) => toWorkspaceUser((snapshot.data() || {}) as Record<string, unknown>, snapshot.id))
        .filter((membership) => membership.status === 'active' && membership.role === 'owner').length;
      assertCanRemoveWorkspaceMember(actor?.status === 'active' ? actor.role : undefined, currentMembership, activeOwnerCount);
    }

    const workspace = toWorkspace((workspaceSnapshot.data() || {}) as Record<string, unknown>, workspaceSnapshot.id);
    const joinedAt = nowIso();
    const workspaceUser: WorkspaceUser = {
      userId,
      workspaceId,
      tenantId: workspace.tenantId,
      role,
      invitedBy: actorUserId,
      joinedAt: currentMembership?.joinedAt || joinedAt,
      status: 'active',
    };
    const tenantMembershipRef = tenantMembersCollection(db).doc(tenantMemberDocId(workspace.tenantId, userId));
    const tenantMembershipSnapshot = await transaction.get(tenantMembershipRef);
    const auditRef = auditLogEventsCollection(db, workspace.tenantId).doc();

    transaction.set(memberRef, {
      id: memberRef.id,
      ...workspaceUser,
      createdAt: currentSnapshot.exists
        ? String(currentSnapshot.get('createdAt') || joinedAt)
        : joinedAt,
      updatedAt: joinedAt,
    }, { merge: true });
    transaction.set(tenantMembershipRef, tenantMembershipSnapshot.exists ? {
      status: 'active',
      updatedAt: joinedAt,
    } : {
      id: tenantMembershipRef.id,
      tenantId: workspace.tenantId,
      workspaceId,
      userId,
      role,
      status: 'active',
      joinedAt,
      createdAt: joinedAt,
      updatedAt: joinedAt,
    }, { merge: tenantMembershipSnapshot.exists });
    transaction.set(auditRef, {
      id: auditRef.id,
      tenantId: workspace.tenantId,
      workspaceId,
      userId: actorUserId,
      action: 'workspace.member_added',
      resourceType: 'workspace_member',
      resourceId: memberRef.id,
      metadata: { memberUserId: userId, role },
      createdAt: joinedAt,
    });

    return workspaceUser;
  });
}

export async function removeWorkspaceUserFromFirestore(userId: string, workspaceId: string, actorUserId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  return db.runTransaction(async (transaction) => {
    const memberRef = workspaceMembersCollection(db).doc(workspaceMemberDocId(workspaceId, userId));
    const actorRef = workspaceMembersCollection(db).doc(workspaceMemberDocId(workspaceId, actorUserId));
    const [currentSnapshot, actorSnapshot] = await Promise.all([transaction.get(memberRef), transaction.get(actorRef)]);
    if (!currentSnapshot.exists) {
      return false;
    }

    const current = toWorkspaceUser((currentSnapshot.data() || {}) as Record<string, unknown>, currentSnapshot.id);
    if (current.status !== 'active') {
      return false;
    }
    const actor = actorSnapshot.exists
      ? toWorkspaceUser((actorSnapshot.data() || {}) as Record<string, unknown>, actorSnapshot.id)
      : undefined;
    const workspaceMemberships = current.role === 'owner'
      ? await transaction.get(workspaceMembersCollection(db).where('workspaceId', '==', workspaceId))
      : undefined;
    const activeOwnerCount = workspaceMemberships?.docs
      .map((snapshot) => toWorkspaceUser((snapshot.data() || {}) as Record<string, unknown>, snapshot.id))
      .filter((membership) => membership.status === 'active' && membership.role === 'owner').length || 0;
    assertCanRemoveWorkspaceMember(actor?.status === 'active' ? actor.role : undefined, current, activeOwnerCount);

    const userMemberships = await transaction.get(workspaceMembersCollection(db).where('userId', '==', userId));
    const hasAnotherActiveWorkspace = userMemberships.docs.some((snapshot) => {
      const membership = toWorkspaceUser((snapshot.data() || {}) as Record<string, unknown>, snapshot.id);
      return snapshot.id !== memberRef.id && membership.tenantId === current.tenantId && membership.status === 'active';
    });
    const updatedAt = nowIso();
    const auditRef = auditLogEventsCollection(db, current.tenantId).doc();
    transaction.set(memberRef, { status: 'removed', updatedAt }, { merge: true });
    if (!hasAnotherActiveWorkspace) {
      transaction.set(tenantMembersCollection(db).doc(tenantMemberDocId(current.tenantId, userId)), {
        status: 'removed', updatedAt,
      }, { merge: true });
    }
    transaction.set(auditRef, {
      id: auditRef.id,
      tenantId: current.tenantId,
      workspaceId,
      userId: actorUserId,
      action: 'workspace.member_removed',
      resourceType: 'workspace_member',
      resourceId: memberRef.id,
      metadata: { memberUserId: userId },
      createdAt: updatedAt,
    });

    return true;
  });
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
