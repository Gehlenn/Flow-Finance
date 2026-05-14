import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveWorkspaceStoreState: vi.fn(),
  loadWorkspaceStoreState: vi.fn(),
  saveJsonState: vi.fn(),
  loadJsonState: vi.fn(),
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

  beforeEach(() => {
    vi.resetModules();
    mocks.saveWorkspaceStoreState.mockReset();
    mocks.loadWorkspaceStoreState.mockReset();
    mocks.saveJsonState.mockReset();
    mocks.loadJsonState.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.recordAuditEvent.mockReset();

    process.env.WORKSPACE_STORE_FILE = storeFilePath;
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'false';

    fs.rmSync(storeFilePath, { force: true });
    fs.mkdirSync(path.dirname(storeFilePath), { recursive: true });

    mocks.saveJsonState.mockResolvedValue(undefined);
    mocks.loadWorkspaceStoreState.mockResolvedValue(null);
    mocks.loadJsonState.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalStoreFile === undefined) {
      delete process.env.WORKSPACE_STORE_FILE;
    } else {
      process.env.WORKSPACE_STORE_FILE = originalStoreFile;
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

  it('registra contexto quando o backfill do workspace store falha', async () => {
    mocks.loadWorkspaceStoreState.mockResolvedValueOnce({
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
});
