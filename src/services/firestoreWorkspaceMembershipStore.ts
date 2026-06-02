import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import type {
  TenantMemberDocument,
  WorkspaceMemberDocument,
  WorkspaceRole,
} from './firestoreWorkspaceTypes';
import { writeAuditLogEvent } from './firestoreWorkspaceAuditStore';

const FIREBASE_WORKSPACE_CONFIG_ERROR = new Error('Workspace sync requires Firebase configuration.');
const FIREBASE_WORKSPACE_CONTEXT_ERROR = new Error('Workspace sync requires a workspaceId and tenantId.');

function nowIso(): string {
  return new Date().toISOString();
}

function hasWorkspaceContext(workspaceId?: string, tenantId?: string): boolean {
  return Boolean(workspaceId?.trim()) && Boolean(tenantId?.trim());
}

function membershipCollection() {
  return collection(db, 'workspace_members');
}

function tenantMemberCollection() {
  return collection(db, 'tenant_members');
}

function workspaceMemberDocId(workspaceId: string, userId: string): string {
  return `${workspaceId}_${userId}`;
}

function tenantMemberDocId(tenantId: string, userId: string): string {
  return `${tenantId}_${userId}`;
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberDocument[]> {
  if (!isFirebaseConfigured) {
    return [];
  }

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
  if (!isFirebaseConfigured) {
    throw FIREBASE_WORKSPACE_CONFIG_ERROR;
  }
  if (!hasWorkspaceContext(input.workspaceId, input.tenantId)) {
    throw FIREBASE_WORKSPACE_CONTEXT_ERROR;
  }

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
  if (!isFirebaseConfigured) {
    throw FIREBASE_WORKSPACE_CONFIG_ERROR;
  }
  if (!hasWorkspaceContext(input.workspaceId, input.tenantId)) {
    throw FIREBASE_WORKSPACE_CONTEXT_ERROR;
  }

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
