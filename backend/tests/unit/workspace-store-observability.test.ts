import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveWorkspaceStoreState: vi.fn(),
  loadWorkspaceStoreState: vi.fn(),
  saveJsonState: vi.fn(),
  loadJsonState: vi.fn(),
  initializePostgresStateStore: vi.fn(),
  getWorkspaceFirestoreStatus: vi.fn(),
  createTenantInFirestore: vi.fn(),
  createWorkspaceInFirestore: vi.fn(),
  getWorkspaceFromFirestore: vi.fn(),
  listWorkspacesForUserFromFirestore: vi.fn(),
  listTenantsForUserFromFirestore: vi.fn(),
  getTenantFromFirestore: vi.fn(),
  getWorkspaceUsersFromFirestore: vi.fn(),
  addWorkspaceUserToFirestore: vi.fn(),
  removeWorkspaceUserFromFirestore: vi.fn(),
  setLastWorkspaceForUserInFirestore: vi.fn(),
  getLastWorkspaceForUserFromFirestore: vi.fn(),
  findWorkspaceByBillingCustomerIdFromFirestore: vi.fn(),
  updateWorkspaceBillingInFirestore: vi.fn(),
  queryWorkspaceById: vi.fn(),
  queryLastWorkspaceForUser: vi.fn(),
  queryTenantById: vi.fn(),
  queryTenantsForUser: vi.fn(),
  queryWorkspaceByBillingCustomerId: vi.fn(),
  queryWorkspacesForUser: vi.fn(),
  queryWorkspaceUsers: vi.fn(),
  isPostgresStateStoreEnabled: vi.fn(() => false),
  loggerWarn: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  isPostgresStateStoreEnabled: mocks.isPostgresStateStoreEnabled,
  initializePostgresStateStore: mocks.initializePostgresStateStore,
  queryWorkspaceById: mocks.queryWorkspaceById,
  loadJsonState: mocks.loadJsonState,
  saveJsonState: mocks.saveJsonState,
  saveWorkspaceStoreState: mocks.saveWorkspaceStoreState,
  loadWorkspaceStoreState: mocks.loadWorkspaceStoreState,
  queryLastWorkspaceForUser: mocks.queryLastWorkspaceForUser,
  queryTenantById: mocks.queryTenantById,
  queryTenantsForUser: mocks.queryTenantsForUser,
  queryWorkspaceByBillingCustomerId: mocks.queryWorkspaceByBillingCustomerId,
  queryWorkspacesForUser: mocks.queryWorkspacesForUser,
  queryWorkspaceUsers: mocks.queryWorkspaceUsers,
}));

vi.mock('../../src/services/admin/workspaceStoreFirestore', () => ({
  getWorkspaceFirestoreStatus: mocks.getWorkspaceFirestoreStatus,
  createTenantInFirestore: mocks.createTenantInFirestore,
  createWorkspaceInFirestore: mocks.createWorkspaceInFirestore,
  getWorkspaceFromFirestore: mocks.getWorkspaceFromFirestore,
  listWorkspacesForUserFromFirestore: mocks.listWorkspacesForUserFromFirestore,
  listTenantsForUserFromFirestore: mocks.listTenantsForUserFromFirestore,
  getTenantFromFirestore: mocks.getTenantFromFirestore,
  getWorkspaceUsersFromFirestore: mocks.getWorkspaceUsersFromFirestore,
  addWorkspaceUserToFirestore: mocks.addWorkspaceUserToFirestore,
  removeWorkspaceUserFromFirestore: mocks.removeWorkspaceUserFromFirestore,
  setLastWorkspaceForUserInFirestore: mocks.setLastWorkspaceForUserInFirestore,
  getLastWorkspaceForUserFromFirestore: mocks.getLastWorkspaceForUserFromFirestore,
  findWorkspaceByBillingCustomerIdFromFirestore: mocks.findWorkspaceByBillingCustomerIdFromFirestore,
  updateWorkspaceBillingInFirestore: mocks.updateWorkspaceBillingInFirestore,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    info: vi.fn(),
    warn: mocks.loggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/admin/auditLog', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

describe('workspaceStore observability', () => {
  const storeFilePath = path.resolve(process.cwd(), '.tmp', 'workspace-store-observability.json');
  const originalStoreFile = process.env.WORKSPACE_STORE_FILE;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    vi.resetModules();
    mocks.saveWorkspaceStoreState.mockReset();
    mocks.loadWorkspaceStoreState.mockReset();
    mocks.saveJsonState.mockReset();
    mocks.loadJsonState.mockReset();
    mocks.initializePostgresStateStore.mockReset();
    mocks.getWorkspaceFirestoreStatus.mockReset();
    mocks.createTenantInFirestore.mockReset();
    mocks.createWorkspaceInFirestore.mockReset();
    mocks.getWorkspaceFromFirestore.mockReset();
    mocks.listWorkspacesForUserFromFirestore.mockReset();
    mocks.listTenantsForUserFromFirestore.mockReset();
    mocks.getTenantFromFirestore.mockReset();
    mocks.getWorkspaceUsersFromFirestore.mockReset();
    mocks.addWorkspaceUserToFirestore.mockReset();
    mocks.removeWorkspaceUserFromFirestore.mockReset();
    mocks.setLastWorkspaceForUserInFirestore.mockReset();
    mocks.getLastWorkspaceForUserFromFirestore.mockReset();
    mocks.findWorkspaceByBillingCustomerIdFromFirestore.mockReset();
    mocks.updateWorkspaceBillingInFirestore.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.recordAuditEvent.mockReset();

    process.env.WORKSPACE_STORE_FILE = storeFilePath;
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'false';
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL;

    fs.rmSync(storeFilePath, { force: true });
    fs.mkdirSync(path.dirname(storeFilePath), { recursive: true });

    mocks.saveJsonState.mockResolvedValue(undefined);
    mocks.loadWorkspaceStoreState.mockResolvedValue(null);
    mocks.loadJsonState.mockResolvedValue(null);
    mocks.initializePostgresStateStore.mockResolvedValue(false);
    mocks.getWorkspaceFirestoreStatus.mockResolvedValue({ configured: false, ready: false });
    mocks.listWorkspacesForUserFromFirestore.mockResolvedValue([]);
    mocks.listTenantsForUserFromFirestore.mockResolvedValue([]);
    mocks.getWorkspaceUsersFromFirestore.mockResolvedValue([]);
    mocks.setLastWorkspaceForUserInFirestore.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalStoreFile === undefined) {
      delete process.env.WORKSPACE_STORE_FILE;
    } else {
      process.env.WORKSPACE_STORE_FILE = originalStoreFile;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }
    fs.rmSync(storeFilePath, { force: true });
  });

  it('registra contexto quando a persistencia do workspace store falha', async () => {
    mocks.saveWorkspaceStoreState.mockRejectedValueOnce(new Error('workspace store persist failed'));

    const { createTenant, resetWorkspaceStoreForTests } = await import('../../src/services/admin/workspaceStore');
    resetWorkspaceStoreForTests();

    createTenant('Tenant Flow', 'user-1');

    await vi.waitFor(() => {
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantCount: 1,
          workspaceCount: 1,
          workspaceUserCount: 1,
          preferenceCount: 1,
          fallback: 'workspace-store-postgres-save-failed',
        }),
        'Failed to persist normalized workspace store to Postgres',
      );
    });
  });

  it('não derruba a criação do workspace quando a escrita local do blob legado falha', async () => {
    mocks.saveWorkspaceStoreState.mockResolvedValue(undefined);
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('read-only filesystem');
    });

    const { createWorkspace, resetWorkspaceStoreForTests } = await import('../../src/services/admin/workspaceStore');
    resetWorkspaceStoreForTests();

    expect(() => createWorkspace('Tenant Flow', 'user-1')).not.toThrow();

    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(mocks.saveWorkspaceStoreState).toHaveBeenCalledTimes(1);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        fallback: 'workspace-store-legacy-write-failed',
        filePath: storeFilePath,
        tenantCount: 1,
        workspaceCount: 1,
        workspaceUserCount: 1,
        preferenceCount: 1,
      }),
      'Failed to persist legacy workspace store blob',
    );
  });

  it('registra contexto quando o backfill do workspace store falha', async () => {
    mocks.loadWorkspaceStoreState.mockResolvedValueOnce(null);
    mocks.loadJsonState.mockResolvedValueOnce({
      tenants: [],
      workspaces: [
        {
          workspaceId: 'ws-1',
          tenantId: 'tenant-1',
          name: 'Workspace 1',
          isDefault: true,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
          plan: 'free',
          status: 'active',
        },
      ],
      workspaceUsers: [],
      userPreferences: [],
    });
    mocks.saveWorkspaceStoreState.mockRejectedValueOnce(new Error('workspace backfill failed'));

    const { initializeWorkspaceStorePersistence, resetWorkspaceStoreForTests } = await import('../../src/services/admin/workspaceStore');
    resetWorkspaceStoreForTests();

    await initializeWorkspaceStorePersistence();

    await vi.waitFor(() => {
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantCount: 1,
          workspaceCount: 1,
          workspaceUserCount: 0,
          preferenceCount: 0,
          fallback: 'workspace-store-backfill-failed',
        }),
        'Failed to backfill normalized workspace store to Postgres',
      );
    });
  });

  it('faz backfill normalizado do workspace store vindo do JSON legado', async () => {
    mocks.loadWorkspaceStoreState.mockResolvedValueOnce(null);
    mocks.loadJsonState.mockResolvedValueOnce({
      tenants: [],
      workspaces: [
        {
          workspaceId: 'ws-2',
          name: 'Workspace 2',
          isDefault: false,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
          plan: 'pro',
          status: 'active',
        },
      ],
      workspaceUsers: [
        {
          workspaceId: 'ws-2',
          userId: 'user-2',
          role: 'user',
          joinedAt: '2026-05-10T00:00:00.000Z',
          status: 'active',
        },
      ],
      userPreferences: [],
    });
    mocks.saveWorkspaceStoreState.mockResolvedValueOnce(undefined);

    const { initializeWorkspaceStorePersistence, resetWorkspaceStoreForTests } = await import('../../src/services/admin/workspaceStore');
    resetWorkspaceStoreForTests();

    await initializeWorkspaceStorePersistence();

    await vi.waitFor(() => {
      expect(mocks.saveWorkspaceStoreState).toHaveBeenCalledTimes(1);
    });

    expect(mocks.saveWorkspaceStoreState).toHaveBeenCalledWith(
      expect.objectContaining({
        tenants: [
          expect.objectContaining({
            tenantId: 'ws-2',
            name: 'Workspace 2',
            plan: 'pro',
          }),
        ],
        workspaces: [
          expect.objectContaining({
            workspaceId: 'ws-2',
            tenantId: 'ws-2',
            isDefault: false,
            plan: 'pro',
          }),
        ],
        workspaceUsers: [
          expect.objectContaining({
            workspaceId: 'ws-2',
            tenantId: 'ws-2',
            role: 'member',
          }),
        ],
        userPreferences: [],
      }),
    );
  });

  it('usa lista vazia do Postgres sem cair para o fallback local', async () => {
    mocks.isPostgresStateStoreEnabled.mockReturnValue(true);
    mocks.queryWorkspacesForUser.mockResolvedValueOnce([]);
    mocks.queryTenantsForUser.mockResolvedValueOnce([]);
    mocks.queryWorkspaceUsers.mockResolvedValueOnce([]);
    mocks.saveWorkspaceStoreState.mockResolvedValue(undefined);

    const {
      createTenant,
      listWorkspacesForUserAsync,
      listTenantsForUserAsync,
      getWorkspaceUsersAsync,
      resetWorkspaceStoreForTests,
    } = await import('../../src/services/admin/workspaceStore');

    resetWorkspaceStoreForTests();
    const { workspace } = createTenant('Tenant Flow', 'user-1');

    await expect(listWorkspacesForUserAsync('user-1')).resolves.toEqual([]);
    await expect(listTenantsForUserAsync('user-1')).resolves.toEqual([]);
    await expect(getWorkspaceUsersAsync(workspace.workspaceId)).resolves.toEqual([]);

    expect(mocks.queryWorkspacesForUser).toHaveBeenCalledWith('user-1');
    expect(mocks.queryTenantsForUser).toHaveBeenCalledWith('user-1');
    expect(mocks.queryWorkspaceUsers).toHaveBeenCalledWith(workspace.workspaceId);
  });

  it('bloqueia criacao assincrona em runtime de producao sem persistencia duravel', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    mocks.isPostgresStateStoreEnabled.mockReturnValue(true);
    mocks.initializePostgresStateStore.mockResolvedValue(false);

    const { createTenantAsync, resetWorkspaceStoreForTests } = await import('../../src/services/admin/workspaceStore');
    resetWorkspaceStoreForTests();

    await expect(createTenantAsync('Tenant Flow', 'user-1')).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 503,
      message: 'Persistencia duravel de workspace indisponivel',
    });
  });

  it('aguarda persistencia Postgres no caminho assincrono quando ela esta pronta', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    mocks.isPostgresStateStoreEnabled.mockReturnValue(true);
    mocks.initializePostgresStateStore.mockResolvedValue(true);
    mocks.saveWorkspaceStoreState.mockResolvedValue(undefined);

    const { createTenantAsync, resetWorkspaceStoreForTests } = await import('../../src/services/admin/workspaceStore');
    resetWorkspaceStoreForTests();

    await expect(createTenantAsync('Tenant Flow', 'user-1')).resolves.toMatchObject({
      workspace: expect.objectContaining({ name: 'Tenant Flow' }),
      tenant: expect.objectContaining({ name: 'Tenant Flow' }),
    });
    expect(mocks.saveWorkspaceStoreState).toHaveBeenCalledTimes(1);
  });

  it('usa Firestore como store duravel quando ele esta pronto', async () => {
    process.env.NODE_ENV = 'production';
    mocks.getWorkspaceFirestoreStatus.mockResolvedValue({ configured: true, ready: true });
    mocks.createTenantInFirestore.mockResolvedValue({
      tenant: { tenantId: 'tenant-fs', name: 'Tenant Flow', plan: 'free', createdAt: '2026-06-05T00:00:00.000Z', updatedAt: '2026-06-05T00:00:00.000Z' },
      workspace: { workspaceId: 'ws-fs', tenantId: 'tenant-fs', name: 'Tenant Flow', isDefault: true, plan: 'free', createdAt: '2026-06-05T00:00:00.000Z', updatedAt: '2026-06-05T00:00:00.000Z', status: 'active' },
    });

    const { createTenantAsync, getWorkspacePersistenceHealthCheck, resetWorkspaceStoreForTests } = await import('../../src/services/admin/workspaceStore');
    resetWorkspaceStoreForTests();

    await expect(createTenantAsync('Tenant Flow', 'user-1')).resolves.toMatchObject({
      workspace: expect.objectContaining({ workspaceId: 'ws-fs' }),
      tenant: expect.objectContaining({ tenantId: 'tenant-fs' }),
    });
    await expect(getWorkspacePersistenceHealthCheck()).resolves.toMatchObject({
      status: 'healthy',
      mode: 'firebase',
      durable: true,
      reason: 'postgres-unavailable-fallback-firebase',
    });
    expect(mocks.createTenantInFirestore).toHaveBeenCalledWith('Tenant Flow', 'user-1');
    expect(mocks.saveWorkspaceStoreState).not.toHaveBeenCalled();
  });
});
