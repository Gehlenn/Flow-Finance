/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'demo-flow-finance-audit-logs';
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
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
      ownerUserId: 'owner-1',
    });

    await setDoc(doc(db, 'workspaces', 'ws-1'), {
      id: 'ws-1',
      tenantId: 'tenant-1',
      tenantName: 'Tenant 1',
      name: 'Workspace 1',
      plan: 'pro',
      isDefault: true,
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
    });

    await setDoc(doc(db, 'workspace_members', 'ws-1_owner-1'), {
      id: 'ws-1_owner-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'owner-1',
      role: 'owner',
      status: 'active',
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
    });

    await setDoc(doc(db, 'workspace_members', 'ws-1_member-1'), {
      id: 'ws-1_member-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'member-1',
      role: 'member',
      status: 'active',
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
    });

    await setDoc(doc(db, 'tenant_members', 'tenant-1_owner-1'), {
      id: 'tenant-1_owner-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'owner-1',
      status: 'active',
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
    });

    await setDoc(doc(db, 'tenant_members', 'tenant-1_member-1'), {
      id: 'tenant-1_member-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'member-1',
      status: 'active',
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
    });

    await setDoc(doc(db, 'audit_logs', 'tenant-1', 'events', 'evt-seeded'), {
      id: 'evt-seeded',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'owner-1',
      action: 'workspace.seeded',
      resourceType: 'workspace',
      resourceId: 'ws-1',
      createdAt: '2026-05-15T00:00:00.000Z',
    });
  });
}

function buildAuditLogPayload(userId: string) {
  return {
    id: 'evt-1',
    tenantId: 'tenant-1',
    workspaceId: 'ws-1',
    userId,
    event_type: 'transaction_created',
    entity: 'financial_event',
    entity_id: 'tx-1',
    action: 'transaction_created',
    resourceType: 'financial_event',
    resourceId: 'tx-1',
    metadata: { source: 'rules-test' },
    timestamp: '2026-05-15T12:00:00.000Z',
    createdAt: '2026-05-15T12:00:00.000Z',
  };
}

describe('audit_logs firestore rules', () => {
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

  it('permite create para membro autenticado com userId igual ao auth.uid', async () => {
    const db = testEnv.authenticatedContext('member-1').firestore();

    await assertSucceeds(setDoc(
      doc(db, 'audit_logs', 'tenant-1', 'events', 'evt-create'),
      buildAuditLogPayload('member-1'),
    ));
  });

  it('nega create quando userId do documento nao bate com request.auth.uid', async () => {
    const db = testEnv.authenticatedContext('member-1').firestore();

    await assertFails(setDoc(
      doc(db, 'audit_logs', 'tenant-1', 'events', 'evt-mismatch'),
      buildAuditLogPayload('owner-1'),
    ));
  });

  it('nega update mesmo para owner do workspace', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();

    await assertFails(updateDoc(
      doc(db, 'audit_logs', 'tenant-1', 'events', 'evt-seeded'),
      { action: 'workspace.changed' },
    ));
  });

  it('nega delete mesmo para owner do workspace', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();

    await assertFails(deleteDoc(doc(db, 'audit_logs', 'tenant-1', 'events', 'evt-seeded')));
  });
});
