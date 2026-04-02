/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
    await testEnv.cleanup();
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

  it('allows an owner to update billing state for the workspace', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();
    await assertSucceeds(setDoc(doc(db, 'workspaces', 'ws-1', 'billing_state', 'current'), {
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      plan: 'pro',
      status: 'active',
      updatedAt: '2026-04-02T00:00:00.000Z',
      updatedByUserId: 'owner-1',
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
});
