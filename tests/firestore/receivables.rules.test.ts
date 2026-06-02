/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'demo-flow-finance-receivables';
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

    await setDoc(doc(db, 'workspaces', 'ws-2'), {
      id: 'ws-2',
      tenantId: 'tenant-1',
      tenantName: 'Tenant 1',
      name: 'Workspace 2',
      plan: 'pro',
      isDefault: false,
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

    await setDoc(doc(db, 'workspace_members', 'ws-2_outsider-1'), {
      id: 'ws-2_outsider-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-2',
      userId: 'outsider-1',
      role: 'viewer',
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

    await setDoc(doc(db, 'tenant_members', 'tenant-1_outsider-1'), {
      id: 'tenant-1_outsider-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-2',
      userId: 'outsider-1',
      status: 'active',
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
    });

    await setDoc(doc(db, 'workspaces', 'ws-1', 'receivables', 'recv-1'), {
      id: 'recv-1',
      user_id: 'owner-1',
      tenant_id: 'tenant-1',
      workspace_id: 'ws-1',
      description: 'Recebivel seed',
      expected_amount: 150,
      realized_amount: 0,
      due_date: '2026-05-20',
      realized_at: null,
      status: 'open',
      source: 'manual',
      created_at: '2026-05-15T00:00:00.000Z',
      updated_at: '2026-05-15T00:00:00.000Z',
    });
  });
}

function buildReceivable(userId: string) {
  return {
    id: 'recv-create',
    user_id: userId,
    tenant_id: 'tenant-1',
    workspace_id: 'ws-1',
    description: 'Recebivel teste',
    expected_amount: 200,
    realized_amount: 0,
    due_date: '2026-05-22',
    realized_at: null,
    status: 'open',
    source: 'manual',
    created_at: '2026-05-15T12:00:00.000Z',
    updated_at: '2026-05-15T12:00:00.000Z',
  };
}

describe('receivables firestore rules', () => {
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

  it('permite create para membro ativo com contexto correto do workspace', async () => {
    const db = testEnv.authenticatedContext('member-1').firestore();

    await assertSucceeds(setDoc(
      doc(db, 'workspaces', 'ws-1', 'receivables', 'recv-create'),
      buildReceivable('member-1'),
    ));
  });

  it('nega leitura cross-workspace para usuario de outro workspace', async () => {
    const db = testEnv.authenticatedContext('outsider-1').firestore();

    await assertFails(getDoc(doc(db, 'workspaces', 'ws-1', 'receivables', 'recv-1')));
  });

  it('nega update que tenta trocar workspace_id do documento', async () => {
    const db = testEnv.authenticatedContext('owner-1').firestore();

    await assertFails(updateDoc(
      doc(db, 'workspaces', 'ws-1', 'receivables', 'recv-1'),
      { workspace_id: 'ws-2' },
    ));
  });
});
