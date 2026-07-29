/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, deleteField, doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'demo-flow-finance';
const rules = readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

let testEnv: RulesTestEnvironment;

function getFirestoreHostConfig() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [hostname, portValue] = host.split(':');
  return {
    host: hostname,
    port: Number(portValue || 8080),
  };
}

async function seedWorkspace() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'tenants', 'tenant-1'), {
      id: 'tenant-1',
      name: 'Tenant 1',
      plan: 'pro',
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
      ownerUserId: 'owner-1',
    });

    await setDoc(doc(db, 'workspaces', 'ws-1'), {
      id: 'ws-1',
      tenantId: 'tenant-1',
      tenantName: 'Tenant 1',
      name: 'Workspace 1',
      plan: 'pro',
      subscription: { id: 'sub-provider' },
      isDefault: true,
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await setDoc(doc(db, 'workspace_members', 'ws-1_owner-1'), {
      id: 'ws-1_owner-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'owner-1',
      role: 'owner',
      status: 'active',
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await setDoc(doc(db, 'workspace_members', 'ws-1_viewer-1'), {
      id: 'ws-1_viewer-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'viewer-1',
      role: 'viewer',
      status: 'active',
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await setDoc(doc(db, 'workspace_members', 'ws-1_admin-1'), {
      id: 'ws-1_admin-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'admin-1',
      role: 'admin',
      status: 'active',
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await setDoc(doc(db, 'workspaces', 'ws-1', 'billing_state', 'current'), {
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      plan: 'pro',
      status: 'active',
      updatedAt: '2026-04-02T00:00:00.000Z',
      updatedByUserId: 'system',
    });

    await setDoc(doc(db, 'workspaces', 'ws-1', 'accounts', 'acc-1'), {
      id: 'acc-1',
      name: 'Main account',
      type: 'checking',
      balance: 1200,
      currency: 'BRL',
      user_id: 'owner-1',
      tenant_id: 'tenant-1',
      workspace_id: 'ws-1',
      created_at: '2026-04-02T00:00:00.000Z',
      updated_at: '2026-04-02T00:00:00.000Z',
    });

    await setDoc(doc(db, 'audit_logs', 'tenant-1', 'events', 'evt-1'), {
      id: 'evt-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'owner-1',
      action: 'workspace.plan_changed',
      resourceType: 'workspace',
      resourceId: 'ws-1',
      createdAt: '2026-04-02T00:00:00.000Z',
    });

    await setDoc(doc(db, 'tenant_members', 'tenant-1_owner-1'), {
      id: 'tenant-1_owner-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'owner-1',
      status: 'active',
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await setDoc(doc(db, 'tenant_members', 'tenant-1_viewer-1'), {
      id: 'tenant-1_viewer-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'viewer-1',
      status: 'active',
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    await setDoc(doc(db, 'tenant_members', 'tenant-1_admin-1'), {
      id: 'tenant-1_admin-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'admin-1',
      status: 'active',
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
    });
  });
}

describe('firestore rules emulator', () => {
  beforeAll(async () => {
    const config = getFirestoreHostConfig();
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules,
        host: config.host,
        port: config.port,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedWorkspace();
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('allows a workspace member to read workspace accounts', async () => {
    const db = testEnv.authenticatedContext('viewer-1').firestore();
    await assertSucceeds(getDoc(doc(db, 'workspaces', 'ws-1', 'accounts', 'acc-1')));
  });

  it('blocks a viewer from creating workspace accounts', async () => {
    const db = testEnv.authenticatedContext('viewer-1').firestore();
    await assertFails(setDoc(doc(db, 'workspaces', 'ws-1', 'accounts', 'acc-2'), {
      id: 'acc-2',
      name: 'Forbidden account',
      type: 'checking',
      balance: 0,
      currency: 'BRL',
      user_id: 'viewer-1',
      tenant_id: 'tenant-1',
      workspace_id: 'ws-1',
      created_at: '2026-04-02T00:00:00.000Z',
      updated_at: '2026-04-02T00:00:00.000Z',
    }));
  });

  it('allows workspace members to read billing state', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();
    await assertSucceeds(getDoc(doc(db, 'workspaces', 'ws-1', 'billing_state', 'current')));
  });

  it('blocks owners and admins from writing billing state', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
    const adminDb = testEnv.authenticatedContext('admin-1').firestore();
    const stateRef = doc(ownerDb, 'workspaces', 'ws-1', 'billing_state', 'current');

    await assertFails(setDoc(stateRef, { plan: 'free' }, { merge: true }));
    await assertFails(setDoc(doc(adminDb, 'workspaces', 'ws-1', 'billing_state', 'pending'), {
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      plan: 'free',
      status: 'active',
    }));
    await assertFails(deleteDoc(stateRef));
  });

  it('allows managers to update workspace metadata but not billing-authoritative fields', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
    const adminDb = testEnv.authenticatedContext('admin-1').firestore();
    const ownerWorkspaceRef = doc(ownerDb, 'workspaces', 'ws-1');
    const adminWorkspaceRef = doc(adminDb, 'workspaces', 'ws-1');

    await assertSucceeds(setDoc(ownerWorkspaceRef, { name: 'Workspace Renamed' }, { merge: true }));

    for (const protectedChange of [
      { plan: 'free' },
      { status: 'active' },
      { entitlements: { aiQueries: 999 } },
      { billingEmail: 'attacker@example.com' },
      { billingCustomerId: 'cus_attacker' },
      { subscription: { id: 'sub_attacker' } },
      { subscription: deleteField() },
      { id: 'other-workspace' },
      { tenantId: 'tenant-other' },
    ]) {
      await assertFails(setDoc(adminWorkspaceRef, protectedChange, { merge: true }));
    }
  });

  it('requires client-created tenants and workspaces to start on the free plan', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();

    await assertSucceeds(setDoc(doc(db, 'tenants', 'tenant-free'), {
      id: 'tenant-free',
      name: 'Free tenant',
      plan: 'free',
      ownerUserId: 'owner-1',
    }));
    await assertFails(setDoc(doc(db, 'tenants', 'tenant-paid'), {
      id: 'tenant-paid',
      name: 'Paid tenant',
      plan: 'pro',
      ownerUserId: 'owner-1',
    }));
    await assertFails(setDoc(doc(db, 'tenants', 'tenant-billing-field'), {
      id: 'tenant-billing-field',
      name: 'Tenant with billing field',
      plan: 'free',
      ownerUserId: 'owner-1',
      billingCustomerId: 'cus_attacker',
    }));
    await assertSucceeds(setDoc(doc(db, 'workspaces', 'ws-free'), {
      id: 'ws-free',
      tenantId: 'tenant-free',
      name: 'Free workspace',
      plan: 'free',
      createdAt: '2026-04-02T00:00:00.000Z',
    }));
    await assertFails(setDoc(doc(db, 'workspaces', 'ws-paid'), {
      id: 'ws-paid',
      tenantId: 'tenant-free',
      name: 'Paid workspace',
      plan: 'pro',
      createdAt: '2026-04-02T00:00:00.000Z',
    }));
    await assertFails(setDoc(doc(db, 'workspaces', 'ws-billing-field'), {
      id: 'ws-billing-field',
      tenantId: 'tenant-free',
      name: 'Workspace with billing field',
      plan: 'free',
      entitlements: { aiQueries: 999 },
      createdAt: '2026-04-02T00:00:00.000Z',
    }));
  });

  it('keeps tenant plan and owner immutable after creation', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();
    const tenantRef = doc(db, 'tenants', 'tenant-1');

    await assertSucceeds(setDoc(tenantRef, { name: 'Tenant Renamed' }, { merge: true }));
    await assertFails(setDoc(tenantRef, { plan: 'free' }, { merge: true }));
    await assertFails(setDoc(tenantRef, { ownerUserId: 'admin-1' }, { merge: true }));
    await assertSucceeds(deleteDoc(tenantRef));
  });

  it('blocks client writes to billing hooks even for workspace owners', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();
    await assertFails(setDoc(doc(db, 'workspaces', 'ws-1', 'billing_hooks', 'hook-1'), {
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      userId: 'owner-1',
      plan: 'pro',
      event: 'plan_changed',
      amount: 1,
      at: '2026-04-02T00:00:00.000Z',
    }));
  });

  it('blocks outsiders from reading audit events', async () => {
    const db = testEnv.authenticatedContext('outsider-1').firestore();
    await assertFails(getDoc(doc(db, 'audit_logs', 'tenant-1', 'events', 'evt-1')));
  });

  it('allows tenant members to read their tenant document and blocks outsiders', async () => {
    const memberDb = testEnv.authenticatedContext('viewer-1').firestore();
    const outsiderDb = testEnv.authenticatedContext('outsider-1').firestore();

    await assertSucceeds(getDoc(doc(memberDb, 'tenants', 'tenant-1')));
    await assertFails(getDoc(doc(outsiderDb, 'tenants', 'tenant-1')));
  });

  it('blocks a non-manager tenant member from reading another tenant member document', async () => {
    const db = testEnv.authenticatedContext('viewer-1').firestore();
    await assertFails(getDoc(doc(db, 'tenant_members', 'tenant-1_owner-1')));
  });

  it('blocks writes with a mismatched tenant id inside a workspace', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();
    await assertFails(setDoc(doc(db, 'workspaces', 'ws-1', 'accounts', 'acc-tenant-mismatch'), {
      id: 'acc-tenant-mismatch',
      name: 'Wrong tenant account',
      type: 'checking',
      balance: 0,
      currency: 'BRL',
      user_id: 'owner-1',
      tenant_id: 'tenant-999',
      workspace_id: 'ws-1',
      created_at: '2026-04-02T00:00:00.000Z',
      updated_at: '2026-04-02T00:00:00.000Z',
    }));
  });

  it('allows an owner to create workspace-scoped subscriptions and blocks tenant mismatches', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();

    await assertSucceeds(setDoc(doc(db, 'workspaces', 'ws-1', 'subscriptions', 'sub-1'), {
      id: 'sub-1',
      name: 'Netflix',
      amount: 39.9,
      cycle: 'monthly',
      status: 'active',
      user_id: 'owner-1',
      tenant_id: 'tenant-1',
      workspace_id: 'ws-1',
      created_at: '2026-04-02T00:00:00.000Z',
      updated_at: '2026-04-02T00:00:00.000Z',
    }));

    await assertFails(setDoc(doc(db, 'workspaces', 'ws-1', 'subscriptions', 'sub-tenant-mismatch'), {
      id: 'sub-tenant-mismatch',
      name: 'Wrong tenant subscription',
      amount: 49.9,
      cycle: 'monthly',
      status: 'active',
      user_id: 'owner-1',
      tenant_id: 'tenant-x',
      workspace_id: 'ws-1',
      created_at: '2026-04-02T00:00:00.000Z',
      updated_at: '2026-04-02T00:00:00.000Z',
    }));
  });
});
