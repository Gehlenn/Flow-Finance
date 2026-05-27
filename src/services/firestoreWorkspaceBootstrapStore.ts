import { collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../../services/firebase';
import type {
  AuditLogDocument,
  TenantDocument,
  UserIdentity,
  WorkspaceDocument,
  WorkspaceMemberDocument,
  WorkspaceSummary,
} from './firestoreWorkspaceTypes';

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

function createFallbackWorkspaceSummary(identity: UserIdentity, explicitName?: string): WorkspaceSummary {
  return {
    workspaceId: `local-${identity.userId}`,
    tenantId: `local-tenant-${identity.userId}`,
    name: buildWorkspaceName(identity, explicitName),
    tenantName: buildTenantName(identity),
    plan: 'free',
    role: 'owner',
    isDefault: true,
  };
}

export async function listUserWorkspaceSummaries(userId?: string | null): Promise<WorkspaceSummary[]> {
  const resolvedUserId = userId || getCurrentUserId();
  if (!resolvedUserId) {
    return [];
  }

  if (!isFirebaseConfigured) {
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
  if (!isFirebaseConfigured) {
    return createFallbackWorkspaceSummary(identity, explicitName);
  }

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

  const auditRef = doc(collection(db, 'audit_logs', tenantRef.id, 'events'));
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
