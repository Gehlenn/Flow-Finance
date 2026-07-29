import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreWorkspaceStoreMocks = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  getDocMock: vi.fn(),
  setDocMock: vi.fn(),
  batchSetMock: vi.fn(),
  batchDeleteMock: vi.fn(),
  batchCommitMock: vi.fn().mockResolvedValue(undefined),
  generatedId: { value: 0 },
  startAfterMock: vi.fn(),
  isFirebaseConfigured: { value: true },
}));

vi.mock('../../services/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
  get isFirebaseConfigured() {
    return firestoreWorkspaceStoreMocks.isFirebaseConfigured.value;
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: (...segments: unknown[]) => ({ type: 'collection', path: segments.slice(1).join('/') }),
  doc: (...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && 'path' in (args[0] as Record<string, unknown>)) {
      firestoreWorkspaceStoreMocks.generatedId.value += 1;
      return { id: `generated-${firestoreWorkspaceStoreMocks.generatedId.value}`, path: `${(args[0] as { path: string }).path}/generated-${firestoreWorkspaceStoreMocks.generatedId.value}` };
    }

    if (args.length === 2 && typeof args[0] === 'object' && args[0] !== null && 'path' in (args[0] as Record<string, unknown>)) {
      return { id: String(args[1]), path: `${(args[0] as { path: string }).path}/${String(args[1])}` };
    }

    const segments = args.slice(1).map(String);
    const id = String(args[args.length - 1]);
    return { id, path: segments.join('/') };
  },
  getDocs: firestoreWorkspaceStoreMocks.getDocsMock,
  getDoc: firestoreWorkspaceStoreMocks.getDocMock,
  setDoc: firestoreWorkspaceStoreMocks.setDocMock,
  onSnapshot: vi.fn(),
  query: (...args: unknown[]) => ({ type: 'query', args }),
  where: (...args: unknown[]) => ({ type: 'where', args }),
  orderBy: (...args: unknown[]) => ({ type: 'orderBy', args }),
  limit: (...args: unknown[]) => ({ type: 'limit', args }),
  startAfter: (...args: unknown[]) => ({ type: 'startAfter', args }),
  writeBatch: () => ({
    set: firestoreWorkspaceStoreMocks.batchSetMock,
    delete: firestoreWorkspaceStoreMocks.batchDeleteMock,
    commit: firestoreWorkspaceStoreMocks.batchCommitMock,
  }),
}));

import {
  listWorkspaceAuditEvents,
  loadWorkspaceEntities,
  listWorkspaceCollectionDocuments,
  replaceWorkspaceEntityCollection,
  upsertWorkspaceCollectionDocument,
} from '../../src/services/firestoreWorkspaceStore';

describe('firestoreWorkspaceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreWorkspaceStoreMocks.generatedId.value = 0;
    firestoreWorkspaceStoreMocks.isFirebaseConfigured.value = true;
  });

  it('lists audit events for a workspace', async () => {
    firestoreWorkspaceStoreMocks.getDocsMock.mockResolvedValueOnce({
      docs: [
        { data: () => ({ id: 'evt-1', tenantId: 'tenant-1', workspaceId: 'ws-1', userId: 'user-1', action: 'workspace.member_added', resourceType: 'workspace_member', resourceId: 'ws-1_user-2', createdAt: '2026-04-03T00:00:00.000Z' }) },
      ],
    });

    const audit = await listWorkspaceAuditEvents({ tenantId: 'tenant-1', workspaceId: 'ws-1', maxItems: 5 });
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('workspace.member_added');
  });

  it('returns audit pagination metadata for a workspace', async () => {
    firestoreWorkspaceStoreMocks.getDocsMock.mockResolvedValueOnce({
      docs: [
        { data: () => ({ id: 'evt-1', tenantId: 'tenant-1', workspaceId: 'ws-1', userId: 'user-1', action: 'workspace.member_added', resourceType: 'workspace_member', resourceId: 'ws-1_user-2', createdAt: '2026-04-03T00:00:00.000Z' }) },
      ],
    });

    const { listWorkspaceAuditEventsPage } = await import('../../src/services/firestoreWorkspaceStore');
    const result = await listWorkspaceAuditEventsPage({ tenantId: 'tenant-1', workspaceId: 'ws-1', maxItems: 1 });

    expect(result.events).toHaveLength(1);
    expect(result.nextCursor).toEqual({
      createdAt: '2026-04-03T00:00:00.000Z',
      id: 'evt-1',
    });
  });

  it('returns empty entities and blocks writes when workspace context is missing', async () => {
    await expect(loadWorkspaceEntities('')).resolves.toEqual({
      accounts: [],
      transactions: [],
      goals: [],
      reminders: [],
      receivables: [],
    });
    await expect(listWorkspaceCollectionDocuments('', 'subscriptions')).resolves.toEqual([]);
    await expect(listWorkspaceAuditEvents({ tenantId: '', workspaceId: 'ws-1' })).resolves.toEqual([]);

    await expect(upsertWorkspaceCollectionDocument('subscriptions', {
      id: 'sub-1',
      name: 'Spotify',
      amount: 21.9,
      cycle: 'monthly',
      status: 'active',
    }, {
      userId: 'user-1',
      tenantId: '',
      workspaceId: 'ws-1',
    })).rejects.toThrow(/workspaceId and tenantId/i);

    await expect(replaceWorkspaceEntityCollection(
      'accounts',
      [],
      [],
      {
        userId: 'user-1',
        tenantId: 'tenant-1',
        workspaceId: '',
      },
    )).rejects.toThrow(/workspaceId and tenantId/i);

  });

  it('reconciles temporary ids and writes audit entries when replacing a workspace collection', async () => {
    const result = await replaceWorkspaceEntityCollection(
      'accounts',
      [
        {
          id: 'tmp_acc_1',
          name: 'Banco Principal',
          type: 'bank',
          balance: 500,
          currency: 'BRL',
        },
      ],
      [
        {
          id: 'acc_old',
          name: 'Carteira Antiga',
          type: 'cash',
          balance: 10,
          currency: 'BRL',
        },
      ],
      {
        userId: 'user-1',
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
      },
    );

    expect(result.reconciledIds).toEqual([{ clientId: 'tmp_acc_1', serverId: 'generated-1' }]);
    expect(firestoreWorkspaceStoreMocks.batchSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workspaces/ws-1/accounts/generated-1' }),
      expect.objectContaining({
        id: 'generated-1',
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        workspace_id: 'ws-1',
      }),
      { merge: true },
    );
    expect(firestoreWorkspaceStoreMocks.batchDeleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workspaces/ws-1/accounts/acc_old' }),
    );
    expect(firestoreWorkspaceStoreMocks.batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('strips undefined optional fields before writing workspace transactions', async () => {
    await replaceWorkspaceEntityCollection(
      'transactions',
      [
        {
          id: 'tmp_tx_1',
          amount: 700,
          type: 'Despesa',
          category: 'Negócio',
          description: 'Entrada inicial teste',
          date: '2026-06-12T20:04:40.000Z',
          payment_method: undefined,
          account_id: undefined,
        },
      ],
      [],
      {
        userId: 'user-1',
        tenantId: 'tenant-1',
        workspaceId: 'ws-1',
      },
    );

    const transactionWrite = firestoreWorkspaceStoreMocks.batchSetMock.mock.calls.find(
      ([ref]) => ref.path === 'workspaces/ws-1/transactions/generated-1',
    );

    expect(transactionWrite).toBeTruthy();
    expect(transactionWrite?.[1]).toEqual(expect.objectContaining({
      id: 'generated-1',
      amount: 700,
      description: 'Entrada inicial teste',
    }));
    expect(transactionWrite?.[1]).not.toHaveProperty('payment_method');
    expect(transactionWrite?.[1]).not.toHaveProperty('account_id');
  });

  it('reads and writes future workspace-scoped collections with tenant context', async () => {
    firestoreWorkspaceStoreMocks.getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            id: 'sub-1',
            name: 'Netflix',
            amount: 39.9,
            cycle: 'monthly',
            status: 'active',
            tenant_id: 'tenant-1',
            workspace_id: 'ws-1',
            user_id: 'user-1',
            created_at: '2026-04-02T00:00:00.000Z',
            updated_at: '2026-04-02T00:00:00.000Z',
          }),
        },
      ],
    });

    const existing = await listWorkspaceCollectionDocuments('ws-1', 'subscriptions');
    expect(existing).toHaveLength(1);

    const stored = await upsertWorkspaceCollectionDocument('subscriptions', {
      id: 'sub-2',
      name: 'Spotify',
      amount: 21.9,
      cycle: 'monthly',
      status: 'active',
    }, {
      userId: 'user-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
    });

    expect(stored).toEqual(expect.objectContaining({
      id: 'sub-2',
      tenant_id: 'tenant-1',
      workspace_id: 'ws-1',
      user_id: 'user-1',
    }));
    expect(firestoreWorkspaceStoreMocks.setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workspaces/ws-1/subscriptions/sub-2' }),
      expect.objectContaining({
        tenant_id: 'tenant-1',
        workspace_id: 'ws-1',
        user_id: 'user-1',
      }),
      { merge: true },
    );
  });

  it('strips undefined fields before upserting workspace scoped documents', async () => {
    await upsertWorkspaceCollectionDocument('subscriptions', {
      id: 'sub-3',
      name: 'Spotify',
      amount: 21.9,
      cycle: 'monthly',
      status: 'active',
      notes: undefined,
    }, {
      userId: 'user-1',
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
    });

    expect(firestoreWorkspaceStoreMocks.setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workspaces/ws-1/subscriptions/sub-3' }),
      expect.not.objectContaining({
        notes: undefined,
      }),
      { merge: true },
    );
  });

  it('falls back safely when Firebase workspace sync is not configured', async () => {
    firestoreWorkspaceStoreMocks.isFirebaseConfigured.value = false;

    await expect(listWorkspaceAuditEvents({ tenantId: 'tenant-1', workspaceId: 'ws-1' })).resolves.toEqual([]);
  });
});
