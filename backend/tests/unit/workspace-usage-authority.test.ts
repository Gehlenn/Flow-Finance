import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoredDocument = Record<string, unknown>;

class FakeSnapshot {
  constructor(private readonly stored: StoredDocument | undefined, readonly id = '') {}

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
    private readonly query: { outcome?: string; createdAtFrom?: string; createdAtTo?: string; orderByCreatedAtDescending?: boolean; limit?: number } = {},
  ) {}

  doc(id?: string): FakeDocumentReference {
    const generatedId = id ?? `event-${this.store.size + 1}`;
    return new FakeDocumentReference(`${this.path}/${generatedId}`, this.store);
  }

  where(field: string, operator: string, value: unknown): FakeCollectionReference {
    if (field === 'outcome' && operator === '==' && typeof value === 'string') {
      return new FakeCollectionReference(this.path, this.store, { ...this.query, outcome: value });
    }
    if (field === 'createdAt' && operator === '>=' && typeof value === 'string') {
      return new FakeCollectionReference(this.path, this.store, { ...this.query, createdAtFrom: value });
    }
    if (field === 'createdAt' && operator === '<=' && typeof value === 'string') {
      return new FakeCollectionReference(this.path, this.store, { ...this.query, createdAtTo: value });
    }
    {
      throw new Error('Unexpected fake Firestore where query');
    }
  }

  orderBy(field: string, direction: string): FakeCollectionReference {
    if (field !== 'createdAt' || direction !== 'desc') {
      throw new Error('Unexpected fake Firestore orderBy query');
    }
    return new FakeCollectionReference(this.path, this.store, { ...this.query, orderByCreatedAtDescending: true });
  }

  limit(value: number): FakeCollectionReference {
    return new FakeCollectionReference(this.path, this.store, { ...this.query, limit: value });
  }

  async get(): Promise<{ docs: FakeSnapshot[] }> {
    const prefix = `${this.path}/`;
    let docs = [...this.store.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, value]) => new FakeSnapshot(value, path.slice(prefix.length)));
    if (this.query.outcome) {
      docs = docs.filter((document) => document.data()?.outcome === this.query.outcome);
    }
    if (this.query.createdAtFrom) {
      docs = docs.filter((document) => String(document.data()?.createdAt) >= this.query.createdAtFrom!);
    }
    if (this.query.createdAtTo) {
      docs = docs.filter((document) => String(document.data()?.createdAt) <= this.query.createdAtTo!);
    }
    if (this.query.orderByCreatedAtDescending) {
      docs = docs.sort((left, right) => String(right.data()?.createdAt).localeCompare(String(left.data()?.createdAt)));
    }
    if (this.query.limit !== undefined) {
      docs = docs.slice(0, this.query.limit);
    }
    return { docs };
  }
}

class FakeTransaction {
  readonly writes: Array<{ ref: FakeDocumentReference; value: StoredDocument; merge: boolean }> = [];

  async get(ref: FakeDocumentReference): Promise<FakeSnapshot> {
    return ref.get();
  }

  set(ref: FakeDocumentReference, value: StoredDocument, options?: { merge?: boolean }): void {
    this.writes.push({ ref, value: { ...value }, merge: options?.merge === true });
  }
}

class FakeFirestore {
  readonly store = new Map<string, StoredDocument>();
  transactionCount = 0;

  collection(name: string): FakeCollectionReference {
    return new FakeCollectionReference(name, this.store);
  }

  async runTransaction<T>(callback: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const transaction = new FakeTransaction();
    const result = await callback(transaction);
    for (const write of transaction.writes) {
      const existing = this.store.get(write.ref.path);
      this.store.set(write.ref.path, write.merge && existing ? { ...existing, ...write.value } : write.value);
    }
    return result;
  }

  seed(path: string, value: StoredDocument): void {
    this.store.set(path, { ...value });
  }

  read(path: string): StoredDocument | undefined {
    const document = this.store.get(path);
    return document ? { ...document } : undefined;
  }
}

const mocks = vi.hoisted(() => ({
  getFirestoreOrNull: vi.fn(),
}));

vi.mock('../../src/utils/firestoreAdmin', () => ({
  getFirestoreOrNull: mocks.getFirestoreOrNull,
}));

import {
  WorkspaceUsageAuthorityUnavailableError,
  WorkspaceUsageIdempotencyConflictError,
  getAuthoritativeWorkspaceUsage,
  getAuthoritativeWorkspaceUsageEvents,
  reserveWorkspaceUsage,
} from '../../src/services/usage/workspaceUsageAuthority';

function seedWorkspace(db: FakeFirestore, id = 'workspace-1', transactionLimit = 5): void {
  db.seed(`workspaces/${id}`, {
    plan: 'free',
    entitlements: {
      limits: {
        transactionsPerMonth: transactionLimit,
        aiQueriesPerMonth: 10,
        bankConnections: 1,
      },
    },
  });
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

describe('workspaceUsageAuthority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reserves usage once and returns the authoritative UTC-month snapshot', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db);
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    const result = await reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'transactions',
      amount: 2,
      idempotencyKey: 'transaction-create-1',
    });

    expect(result).toEqual({
      outcome: 'accepted',
      idempotent: false,
      current: 2,
      limit: 5,
      remaining: 3,
      monthKey: currentMonthKey(),
      plan: 'free',
    });
    expect(db.read(`workspaces/workspace-1/saas_usage/${currentMonthKey()}`)).toMatchObject({ transactions: 2 });
    expect(db.read(`workspaces/workspace-1/saas_usage/${currentMonthKey()}/receipts/transaction-create-1`)).toMatchObject({
      outcome: 'accepted',
      amount: 2,
    });
    const eventPath = [...db.store.keys()].find((path) => path.includes('/events/'));
    expect(eventPath).toBeDefined();
    expect(db.read(eventPath!)).toMatchObject({
      outcome: 'accepted',
      idempotencyKey: 'transaction-create-1',
    });

    await expect(getAuthoritativeWorkspaceUsage('workspace-1')).resolves.toEqual({
      workspaceId: 'workspace-1',
      monthKey: currentMonthKey(),
      plan: 'free',
      usage: { transactions: 2, aiQueries: 0, bankConnections: 0 },
    });
  });

  it('replays an identical idempotency key without incrementing usage again', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db);
    mocks.getFirestoreOrNull.mockResolvedValue(db);
    const request = {
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'transactions' as const,
      amount: 2,
      idempotencyKey: 'transaction-create-1',
    };

    const first = await reserveWorkspaceUsage(request);
    const replay = await reserveWorkspaceUsage(request);

    expect(replay).toEqual({ ...first, idempotent: true });
    expect(db.read(`workspaces/workspace-1/saas_usage/${currentMonthKey()}`)).toMatchObject({ transactions: 2 });
    expect([...db.store.keys()].filter((path) => path.includes('/events/'))).toHaveLength(1);
  });

  it('reads and normalizes only accepted current-month AI authority events', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db);
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    await reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-accepted',
      resource: 'aiQueries',
      amount: 10,
      idempotencyKey: 'accepted-ai-query',
    });
    await reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-rejected',
      resource: 'aiQueries',
      amount: 1,
      idempotencyKey: 'rejected-ai-query',
    });

    await expect(getAuthoritativeWorkspaceUsageEvents('workspace-1')).resolves.toEqual({
      monthKey: currentMonthKey(),
      events: [expect.objectContaining({
        workspaceId: 'workspace-1',
        userId: 'user-accepted',
        resource: 'aiQueries',
        amount: 10,
      })],
    });
  });

  it('bounds the accepted-event query before normalizing results', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db);
    const monthKey = currentMonthKey();
    for (const [id, createdAt] of [['older', `${monthKey}-01T00:00:00.000Z`], ['newer', `${monthKey}-02T00:00:00.000Z`]] as const) {
      db.seed(`workspaces/workspace-1/saas_usage/${monthKey}/events/${id}`, {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        resource: 'aiQueries',
        amount: 1,
        idempotencyKey: id,
        outcome: 'accepted',
        idempotent: false,
        current: 1,
        limit: 10,
        remaining: 9,
        monthKey,
        plan: 'free',
        createdAt,
      });
    }
    db.seed(`workspaces/workspace-1/saas_usage/${monthKey}/events/rejected`, {
      workspaceId: 'workspace-1', userId: 'user-1', resource: 'aiQueries', amount: 1,
      idempotencyKey: 'rejected', outcome: 'limit_exceeded', idempotent: false,
      current: 10, limit: 10, remaining: 0, monthKey, plan: 'free', createdAt: `${monthKey}-03T00:00:00.000Z`,
    });
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    await expect(getAuthoritativeWorkspaceUsageEvents('workspace-1', { limit: 1 })).resolves.toMatchObject({
      events: [expect.objectContaining({ id: 'newer' })],
    });
  });

  it('applies the timestamp range before the event query limit', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db);
    const monthKey = currentMonthKey();
    for (const [id, createdAt] of [['in-range', `${monthKey}-10T00:00:00.000Z`], ['after-range', `${monthKey}-20T00:00:00.000Z`]] as const) {
      db.seed(`workspaces/workspace-1/saas_usage/${monthKey}/events/${id}`, {
        workspaceId: 'workspace-1', userId: 'user-1', resource: 'aiQueries', amount: 1,
        idempotencyKey: id, outcome: 'accepted', idempotent: false, current: 1, limit: 10,
        remaining: 9, monthKey, plan: 'free', createdAt,
      });
    }
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    await expect(getAuthoritativeWorkspaceUsageEvents('workspace-1', {
      limit: 1,
      to: `${monthKey}-15T00:00:00.000Z`,
    })).resolves.toMatchObject({
      events: [expect.objectContaining({ id: 'in-range' })],
    });
  });

  it('accepts the normalized synthetic legacy-backfill event shape', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db);
    const monthKey = currentMonthKey();
    db.seed(`workspaces/workspace-1/saas_usage/${monthKey}/events/legacy_backfill_ai_queries_${monthKey}`, {
      workspaceId: 'workspace-1',
      userId: 'system:legacy-backfill',
      resource: 'aiQueries',
      amount: 4,
      idempotencyKey: `legacy-backfill-aiQueries-${monthKey}`,
      outcome: 'accepted',
      idempotent: true,
      current: 4,
      limit: 10,
      remaining: 6,
      monthKey,
      plan: 'free',
      createdAt: `${monthKey}-01T00:00:00.000Z`,
      metadata: { source: 'legacy_backfill' },
    });
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    await expect(getAuthoritativeWorkspaceUsageEvents('workspace-1')).resolves.toEqual({
      monthKey,
      events: [{
        id: `legacy_backfill_ai_queries_${monthKey}`,
        workspaceId: 'workspace-1',
        userId: 'system:legacy-backfill',
        resource: 'aiQueries',
        amount: 4,
        at: `${monthKey}-01T00:00:00.000Z`,
        metadata: { source: 'legacy_backfill' },
      }],
    });
  });

  it('fails closed when an authority event is malformed', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db);
    db.seed(`workspaces/workspace-1/saas_usage/${currentMonthKey()}/events/malformed`, {
      workspaceId: 'workspace-1',
      resource: 'aiQueries',
      amount: 1,
      outcome: 'accepted',
    });
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    await expect(getAuthoritativeWorkspaceUsageEvents('workspace-1'))
      .rejects.toBeInstanceOf(WorkspaceUsageAuthorityUnavailableError);
  });

  it('rejects a reused idempotency key with a different payload', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db);
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    await reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'transactions',
      amount: 1,
      idempotencyKey: 'transaction-create-1',
    });

    await expect(reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'transactions',
      amount: 2,
      idempotencyKey: 'transaction-create-1',
    })).rejects.toBeInstanceOf(WorkspaceUsageIdempotencyConflictError);
    expect(db.read(`workspaces/workspace-1/saas_usage/${currentMonthKey()}`)).toMatchObject({ transactions: 1 });
  });

  it('records a stable limit-exceeded receipt without writing past the limit', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db, 'workspace-1', 2);
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    await reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'transactions',
      amount: 2,
      idempotencyKey: 'transaction-create-1',
    });
    const denied = await reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'transactions',
      amount: 1,
      idempotencyKey: 'transaction-create-2',
    });

    expect(denied).toMatchObject({ outcome: 'limit_exceeded', current: 2, limit: 2, remaining: 0 });
    expect(db.read(`workspaces/workspace-1/saas_usage/${currentMonthKey()}`)).toMatchObject({ transactions: 2 });
    expect(db.read(`workspaces/workspace-1/saas_usage/${currentMonthKey()}/receipts/transaction-create-2`)).toMatchObject({
      outcome: 'limit_exceeded',
    });
  });

  it('replays a limit-exceeded receipt without adding usage or another event', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db, 'workspace-1', 1);
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    await reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'transactions',
      amount: 1,
      idempotencyKey: 'transaction-create-1',
    });
    const deniedRequest = {
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'transactions' as const,
      amount: 1,
      idempotencyKey: 'transaction-create-2',
    };

    const denied = await reserveWorkspaceUsage(deniedRequest);
    const replay = await reserveWorkspaceUsage(deniedRequest);

    expect(replay).toEqual({ ...denied, idempotent: true });
    expect(db.read(`workspaces/workspace-1/saas_usage/${currentMonthKey()}`)).toMatchObject({ transactions: 1 });
    expect([...db.store.keys()].filter((path) => path.includes('/events/'))).toHaveLength(2);
  });

  it('uses UTC for the usage document and receipt month at a timezone boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));

    try {
      const db = new FakeFirestore();
      seedWorkspace(db);
      mocks.getFirestoreOrNull.mockResolvedValue(db);

      const result = await reserveWorkspaceUsage({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        resource: 'aiQueries',
        amount: 1,
        idempotencyKey: 'utc-boundary-query',
      });

      expect(result.monthKey).toBe('2026-05');
      expect(db.read('workspaces/workspace-1/saas_usage/2026-05')).toMatchObject({ aiQueries: 1 });
      expect(db.read('workspaces/workspace-1/saas_usage/2026-05/receipts/utc-boundary-query')).toMatchObject({
        monthKey: '2026-05',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed for reservations and returns null for reads when Firestore is unavailable', async () => {
    mocks.getFirestoreOrNull.mockResolvedValue(null);

    await expect(reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'transactions',
      amount: 1,
      idempotencyKey: 'transaction-create-1',
    })).rejects.toBeInstanceOf(WorkspaceUsageAuthorityUnavailableError);
    await expect(getAuthoritativeWorkspaceUsage('workspace-1')).resolves.toBeNull();
  });

  it('maps unexpected Firestore transaction failures to an unavailable authority error', async () => {
    const transactionFailure = new Error('deadline exceeded');
    const db = new FakeFirestore();
    vi.spyOn(db, 'runTransaction').mockRejectedValue(transactionFailure);
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    const rejection = reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'aiQueries',
      amount: 1,
      idempotencyKey: 'transaction-failure',
    });

    await expect(rejection).rejects.toBeInstanceOf(WorkspaceUsageAuthorityUnavailableError);
    await expect(rejection).rejects.toMatchObject({ cause: transactionFailure });
  });

  it('fails closed instead of resetting malformed persisted counters to zero', async () => {
    const db = new FakeFirestore();
    seedWorkspace(db);
    db.seed(`workspaces/workspace-1/saas_usage/${currentMonthKey()}`, {
      transactions: 0,
      aiQueries: 'invalid',
      bankConnections: 0,
    });
    mocks.getFirestoreOrNull.mockResolvedValue(db);

    await expect(reserveWorkspaceUsage({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      resource: 'aiQueries',
      amount: 1,
      idempotencyKey: 'malformed-counter',
    })).rejects.toBeInstanceOf(WorkspaceUsageAuthorityUnavailableError);
    expect(db.read(`workspaces/workspace-1/saas_usage/${currentMonthKey()}/receipts/malformed-counter`)).toBeUndefined();
  });
});
