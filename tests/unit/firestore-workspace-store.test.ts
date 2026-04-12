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
  addWorkspaceMember,
  createPersonalWorkspace,
  listWorkspaceAuditEvents,
  listWorkspaceMembers,
  listWorkspaceCollectionDocuments,
  listUserWorkspaceSummaries,
  removeWorkspaceMember,
  replaceWorkspaceEntityCollection,
  upsertWorkspaceCollectionDocument,
} from '../../src/services/firestoreWorkspaceStore';

describe('firestoreWorkspaceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreWorkspaceStoreMocks.generatedId.value = 0;
    firestoreWorkspaceStoreMocks.isFirebaseConfigured.value = true;
  });

  it('merges workspace memberships with workspace documents', async () => {
    firestoreWorkspaceStoreMocks.getDocsMock.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          data: () => ({
            id: 'ws_1_user_1',
            tenantId: 'tenant_1',
            workspaceId: 'ws_1',
            userId: 'user-1',
            role: 'owner',
            status: 'active',
          }),
        },
      ],
    });

    firestoreWorkspaceStoreMocks.getDocMock.mockImplementation(async (ref: { path: string; id: string }) => {
      if (ref.path === 'workspaces/ws_1') {
        return {
          exists: () => true,
          id: 'ws_1',
          data: () => ({
            id: 'ws_1',
            tenantId: 'tenant_1',
            tenantName: 'Tenant Principal',
            name: 'Workspace Principal',
            plan: 'pro',
            isDefault: true,
          }),
        };
      }

      throw new Error(`Unexpected path ${ref.path}`);
    });

    const workspaces = await listUserWorkspaceSummaries('user-1');

    expect(workspaces).toEqual([
      {
        workspaceId: 'ws_1',
        tenantId: 'tenant_1',
        name: 'Workspace Principal',
        tenantName: 'Tenant Principal',
        plan: 'pro',
        role: 'owner',
        isDefault: true,
      },
    ]);
  });

  it('lists workspace members from Firestore', async () => {
    firestoreWorkspaceStoreMocks.getDocsMock.mockResolvedValueOnce({
      docs: [
        { data: () => ({ id: 'ws_1_user_1', tenantId: 'tenant_1', workspaceId: 'ws_1', userId: 'user-1', role: 'owner', status: 'active', createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' }) },
        { data: () => ({ id: 'ws_1_user_2', tenantId: 'tenant_1', workspaceId: 'ws_1', userId: 'user-2', role: 'member', status: 'active', createdAt: '2026-04-02T00:00:00.000Z', updatedAt: '2026-04-02T00:00:00.000Z' }) },
      ],
    });

    const members = await listWorkspaceMembers('ws_1');

    expect(members).toHaveLength(2);
    expect(members[0].userId).toBe('user-1');
    expect(members[1].userId).toBe('user-2');
  });

  it('adds and removes workspace members with audit logging', async () => {
    await addWorkspaceMember({
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'user-2',
      role: 'viewer',
      invitedByUserId: 'user-1',
    });

    expect(firestoreWorkspaceStoreMocks.setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workspace_members/ws-1_user-2' }),
      expect.objectContaining({
        userId: 'user-2',
        workspaceId: 'ws-1',
        tenantId: 'tenant-1',
        role: 'viewer',
      }),
      { merge: true },
    );

    firestoreWorkspaceStoreMocks.getDocsMock.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    await removeWorkspaceMember({
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      userId: 'user-2',
      removedByUserId: 'user-1',
    });

    expect(firestoreWorkspaceStoreMocks.setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workspace_members/ws-1_user-2' }),
      expect.objectContaining({ status: 'disabled' }),
      { merge: true },
    );
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

  it('falls back safely when Firebase workspace sync is not configured', async () => {
    firestoreWorkspaceStoreMocks.isFirebaseConfigured.value = false;

    await expect(listUserWorkspaceSummaries('user-1')).resolves.toEqual([]);
    await expect(listWorkspaceMembers('ws-1')).resolves.toEqual([]);
    await expect(listWorkspaceAuditEvents({ tenantId: 'tenant-1', workspaceId: 'ws-1' })).resolves.toEqual([]);
    await expect(createPersonalWorkspace({ userId: 'user-1', name: 'Flow User', email: 'user@test.dev' })).resolves.toEqual(
      expect.objectContaining({
        workspaceId: 'local-user-1',
        tenantId: 'local-tenant-user-1',
        role: 'owner',
        plan: 'free',
      }),
    );
  });
});
