import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import {
  applyFirestoreAiUsageBackfill,
  firestoreAiUsageBackfillEventId,
  inspectFirestoreAiUsageBackfill,
  prepareLegacyAiUsageBackfillSource,
  resolveLegacyUsageForMonth,
} from '../../src/services/usage/firestoreAiUsageBackfill';

type StoredDocument = Record<string, unknown>;

class FakeSnapshot {
  constructor(private readonly stored: StoredDocument | undefined) {}

  get exists(): boolean {
    return this.stored !== undefined;
  }

  data(): StoredDocument | undefined {
    return this.stored ? { ...this.stored } : undefined;
  }
}

class FakeDocumentReference {
  constructor(
    readonly path: string,
    private readonly store: Map<string, StoredDocument>,
  ) {}

  collection(name: string): FakeCollectionReference {
    return new FakeCollectionReference(`${this.path}/${name}`, this.store);
  }

  async get(): Promise<FakeSnapshot> {
    return new FakeSnapshot(this.store.get(this.path));
  }
}

class FakeCollectionReference {
  constructor(
    private readonly path: string,
    private readonly store: Map<string, StoredDocument>,
  ) {}

  doc(id: string): FakeDocumentReference {
    return new FakeDocumentReference(`${this.path}/${id}`, this.store);
  }
}

class FakeTransaction {
  private readonly writes: Array<{ ref: FakeDocumentReference; value: StoredDocument }> = [];

  async get(reference: FakeDocumentReference): Promise<FakeSnapshot> {
    return reference.get();
  }

  set(reference: FakeDocumentReference, value: StoredDocument): void {
    this.writes.push({ ref: reference, value: { ...value } });
  }

  commit(store: Map<string, StoredDocument>): void {
    for (const write of this.writes) {
      store.set(write.ref.path, write.value);
    }
  }
}

class FakeFirestore {
  readonly store = new Map<string, StoredDocument>();

  collection(name: string): FakeCollectionReference {
    return new FakeCollectionReference(name, this.store);
  }

  async runTransaction<T>(callback: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
    const transaction = new FakeTransaction();
    const result = await callback(transaction);
    transaction.commit(this.store);
    return result;
  }

  seed(path: string, value: StoredDocument): void {
    this.store.set(path, { ...value });
  }

  read(path: string): StoredDocument | undefined {
    const value = this.store.get(path);
    return value ? { ...value } : undefined;
  }
}

const workspaceId = 'workspace-backfill';
const monthKey = '2026-07';
const workspacePath = `workspaces/${workspaceId}`;
const usagePath = `${workspacePath}/saas_usage/${monthKey}`;
const eventPath = `${usagePath}/events/${firestoreAiUsageBackfillEventId(monthKey)}`;
const legacyUsage = { transactions: 8, aiQueries: 7, bankConnections: 1 };

function configuredFirestore(): FakeFirestore {
  const db = new FakeFirestore();
  db.seed(workspacePath, {
    plan: 'pro',
    entitlements: { limits: { aiQueriesPerMonth: 10 } },
  });
  return db;
}

describe('Firestore AI usage backfill', () => {
  it('dry-runs a missing snapshot as one atomic snapshot-and-event write', async () => {
    const db = configuredFirestore();

    const result = await inspectFirestoreAiUsageBackfill(db as unknown as Firestore, {
      workspaceId,
      monthKey,
      legacyUsage,
    });

    expect(result).toEqual({ action: 'create_snapshot_and_event', wrote: false });
    expect(db.read(usagePath)).toBeUndefined();
    expect(db.read(eventPath)).toBeUndefined();
  });

  it('writes the canonical counter and an accepted synthetic event, then is idempotent', async () => {
    const db = configuredFirestore();
    const input = {
      workspaceId,
      monthKey,
      legacyUsage,
      now: new Date('2026-07-29T12:34:56.000Z'),
    };

    await expect(applyFirestoreAiUsageBackfill(db as unknown as Firestore, input)).resolves.toEqual({
      action: 'create_snapshot_and_event',
      wrote: true,
    });
    expect(db.read(usagePath)).toEqual({
      transactions: 0,
      aiQueries: 7,
      bankConnections: 0,
      monthKey,
      updatedAt: '2026-07-29T12:34:56.000Z',
    });
    expect(db.read(eventPath)).toEqual({
      workspaceId,
      userId: 'system:legacy-backfill',
      monthKey,
      resource: 'aiQueries',
      amount: 7,
      idempotencyKey: 'legacy-backfill-aiQueries-2026-07',
      outcome: 'accepted',
      idempotent: true,
      current: 7,
      limit: 10,
      remaining: 3,
      plan: 'pro',
      createdAt: '2026-07-01T00:00:00.000Z',
      metadata: { source: 'legacy_backfill' },
    });

    await expect(applyFirestoreAiUsageBackfill(db as unknown as Firestore, input)).resolves.toEqual({
      action: 'already_backfilled',
      wrote: false,
    });
  });

  it('fails closed on a mismatched existing counter without replacing it', async () => {
    const db = configuredFirestore();
    db.seed(usagePath, {
      transactions: 0,
      aiQueries: 5,
      bankConnections: 0,
      monthKey,
      updatedAt: '2026-07-10T00:00:00.000Z',
    });

    await expect(applyFirestoreAiUsageBackfill(db as unknown as Firestore, {
      workspaceId,
      monthKey,
      legacyUsage,
    })).resolves.toEqual({ action: 'conflict', wrote: false });
    expect(db.read(usagePath)?.aiQueries).toBe(5);
    expect(db.read(eventPath)).toBeUndefined();
  });

  it('treats a matching positive counter without its deterministic event as a conflict', async () => {
    const db = configuredFirestore();
    db.seed(usagePath, {
      transactions: 0,
      aiQueries: legacyUsage.aiQueries,
      bankConnections: 0,
      monthKey,
      updatedAt: '2026-07-10T00:00:00.000Z',
    });

    await expect(applyFirestoreAiUsageBackfill(db as unknown as Firestore, {
      workspaceId,
      monthKey,
      legacyUsage,
    })).resolves.toEqual({ action: 'conflict', wrote: false });
    expect(db.read(eventPath)).toBeUndefined();
  });

  it('creates no synthetic event for zero legacy usage', async () => {
    const db = configuredFirestore();

    await expect(applyFirestoreAiUsageBackfill(db as unknown as Firestore, {
      workspaceId,
      monthKey,
      legacyUsage: { transactions: 0, aiQueries: 0, bankConnections: 0 },
    })).resolves.toEqual({ action: 'create_snapshot', wrote: true });
    expect(db.read(usagePath)?.aiQueries).toBe(0);
    expect(db.read(eventPath)).toBeUndefined();
  });

  it('treats an absent legacy month as a valid zero snapshot', () => {
    expect(resolveLegacyUsageForMonth({}, monthKey)).toEqual({
      transactions: 0,
      aiQueries: 0,
      bankConnections: 0,
    });
  });

  it('reports usage workspace IDs absent from the durable workspace store', () => {
    const prepared = prepareLegacyAiUsageBackfillSource(
      ['workspace-present'],
      {
        'workspace-present': { [monthKey]: legacyUsage },
        'workspace-orphan': { [monthKey]: legacyUsage },
      },
      monthKey,
    );

    expect(prepared.workspaceCount).toBe(1);
    expect(prepared.inputs).toEqual([{ workspaceId: 'workspace-present', legacyUsage }]);
    expect(prepared.orphanUsageWorkspaceCount).toBe(1);
  });

  it('rejects malformed legacy counters before inspecting Firestore', async () => {
    const db = configuredFirestore();

    await expect(inspectFirestoreAiUsageBackfill(db as unknown as Firestore, {
      workspaceId,
      monthKey,
      legacyUsage: { transactions: 0, aiQueries: -1, bankConnections: 0 },
    })).rejects.toThrow('Legacy usage counters must be non-negative safe integers');
  });
});
