/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, type Firestore } from 'firebase/firestore';

const projectId = 'demo-flow-finance-usage-authority-subcollections';
const rules = readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const workspaceId = 'workspace-usage-authority-rules';
const monthKey = '2026-07';
const usagePath = ['workspaces', workspaceId, 'saas_usage', monthKey] as const;

let testEnv: RulesTestEnvironment;

function getFirestoreHostConfig() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [hostname, portValue] = host.split(':');
  return {
    host: hostname,
    port: Number(portValue || 8080),
  };
}

function authorityDocument(db: Firestore, collectionName: string, documentId: string) {
  return doc(db, ...usagePath, collectionName, documentId);
}

async function seedUsageAuthorityDocuments() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'workspaces', workspaceId), {
      id: workspaceId,
      tenantId: 'tenant-usage-authority',
      name: 'Usage authority workspace',
    });

    for (const [userId, role] of [
      ['viewer-1', 'viewer'],
      ['member-1', 'member'],
      ['admin-1', 'admin'],
      ['owner-1', 'owner'],
    ]) {
      await setDoc(doc(db, 'workspace_members', `${workspaceId}_${userId}`), {
        id: `${workspaceId}_${userId}`,
        tenantId: 'tenant-usage-authority',
        workspaceId,
        userId,
        role,
        status: 'active',
      });
    }

    await setDoc(doc(db, ...usagePath), {
      monthKey,
      aiQueries: 1,
      updatedAt: '2026-07-29T00:00:00.000Z',
    });
    await setDoc(doc(db, ...usagePath, 'receipts', 'existing-receipt'), {
      idempotencyKey: 'existing-receipt',
      outcome: 'accepted',
    });
    await setDoc(doc(db, ...usagePath, 'events', 'existing-event'), {
      idempotencyKey: 'existing-event',
      outcome: 'accepted',
    });
  });
}

describe('Firestore Rules: internal workspace usage authority subcollections', () => {
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
    await seedUsageAuthorityDocuments();
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  const clientContexts = [
    ['unauthenticated', () => testEnv.unauthenticatedContext().firestore()],
    ['viewer', () => testEnv.authenticatedContext('viewer-1').firestore()],
    ['member', () => testEnv.authenticatedContext('member-1').firestore()],
    ['admin', () => testEnv.authenticatedContext('admin-1').firestore()],
    ['owner', () => testEnv.authenticatedContext('owner-1').firestore()],
  ] as const;

  const internalCollections = [
    ['receipts', 'existing-receipt'],
    ['events', 'existing-event'],
  ] as const;

  it.each(clientContexts)('%s cannot read internal usage authority receipts or events', async (_role, getDb) => {
    const db = getDb();

    for (const [collectionName, existingDocumentId] of internalCollections) {
      await assertFails(getDoc(authorityDocument(db, collectionName, existingDocumentId)));
      await assertFails(getDocs(collection(db, ...usagePath, collectionName)));
    }
  });

  it.each(clientContexts)('%s cannot create, update, or delete internal usage authority receipts or events', async (_role, getDb) => {
    const db = getDb();

    for (const [collectionName, existingDocumentId] of internalCollections) {
      const existingDocument = authorityDocument(db, collectionName, existingDocumentId);
      const newDocument = authorityDocument(db, collectionName, `forbidden-${collectionName}`);

      await assertFails(setDoc(newDocument, {
        idempotencyKey: `forbidden-${collectionName}`,
        outcome: 'accepted',
      }));
      await assertFails(updateDoc(existingDocument, { outcome: 'limit_exceeded' }));
      await assertFails(deleteDoc(existingDocument));
    }
  });
});
