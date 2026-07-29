import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  _resetFirestoreInstanceForTests,
  getFirestoreOrNull,
} from '../../backend/src/utils/firestoreAdmin';
import { reserveWorkspaceUsage } from '../../backend/src/services/usage/workspaceUsageAuthority';

const workspaceId = 'workspace-usage-authority-emulator';
const workspacePath = `workspaces/${workspaceId}`;

const originalProjectId = process.env.FIREBASE_PROJECT_ID;
const originalGcloudProject = process.env.GCLOUD_PROJECT;

describe('workspace usage authority with Firestore Emulator', () => {
  beforeAll(() => {
    process.env.FIREBASE_PROJECT_ID = 'demo-flow-finance';
    process.env.GCLOUD_PROJECT = 'demo-flow-finance';
    _resetFirestoreInstanceForTests();
  });

  beforeEach(async () => {
    const db = await getFirestoreOrNull('WorkspaceUsageAuthorityEmulatorTest');
    if (!db) {
      throw new Error('Firestore Emulator was not initialized');
    }

    const workspaceRef = db.doc(workspacePath);
    await db.recursiveDelete(workspaceRef);
    await workspaceRef.set({
      plan: 'free',
      entitlements: {
        limits: {
          transactionsPerMonth: 2,
          aiQueriesPerMonth: 1,
          bankConnections: 1,
        },
      },
    });
  });

  afterAll(async () => {
    const db = await getFirestoreOrNull('WorkspaceUsageAuthorityEmulatorTest');
    if (db) {
      await db.recursiveDelete(db.doc(workspacePath));
    }
    _resetFirestoreInstanceForTests();

    if (originalProjectId === undefined) {
      delete process.env.FIREBASE_PROJECT_ID;
    } else {
      process.env.FIREBASE_PROJECT_ID = originalProjectId;
    }
    if (originalGcloudProject === undefined) {
      delete process.env.GCLOUD_PROJECT;
    } else {
      process.env.GCLOUD_PROJECT = originalGcloudProject;
    }
  });

  it('accepts exactly one concurrent reservation for the final available slot', async () => {
    const results = await Promise.all([
      reserveWorkspaceUsage({
        workspaceId,
        userId: 'user-a',
        resource: 'aiQueries',
        amount: 1,
        idempotencyKey: 'ai-query-a',
      }),
      reserveWorkspaceUsage({
        workspaceId,
        userId: 'user-b',
        resource: 'aiQueries',
        amount: 1,
        idempotencyKey: 'ai-query-b',
      }),
    ]);

    expect(results.filter((result) => result.outcome === 'accepted')).toHaveLength(1);
    expect(results.filter((result) => result.outcome === 'limit_exceeded')).toHaveLength(1);

    const db = await getFirestoreOrNull('WorkspaceUsageAuthorityEmulatorTest');
    const monthKey = results[0].monthKey;
    const usage = await db!.doc(`${workspacePath}/saas_usage/${monthKey}`).get();
    expect(usage.data()?.aiQueries).toBe(1);
  });

  it('deduplicates concurrent retries with the same idempotency key', async () => {
    const request = {
      workspaceId,
      userId: 'user-a',
      resource: 'aiQueries' as const,
      amount: 1,
      idempotencyKey: 'ai-query-retry',
    };
    const results = await Promise.all([
      reserveWorkspaceUsage(request),
      reserveWorkspaceUsage(request),
    ]);

    expect(results.every((result) => result.outcome === 'accepted')).toBe(true);
    expect(results.filter((result) => result.idempotent)).toHaveLength(1);

    const db = await getFirestoreOrNull('WorkspaceUsageAuthorityEmulatorTest');
    const monthKey = results[0].monthKey;
    const usage = await db!.doc(`${workspacePath}/saas_usage/${monthKey}`).get();
    const receipts = await db!
      .collection(`${workspacePath}/saas_usage/${monthKey}/receipts`)
      .get();
    const events = await db!
      .collection(`${workspacePath}/saas_usage/${monthKey}/events`)
      .get();

    expect(usage.data()?.aiQueries).toBe(1);
    expect(receipts.size).toBe(1);
    expect(events.size).toBe(1);
  });
});
