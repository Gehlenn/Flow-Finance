import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  testConnection: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
  loggerDebug: vi.fn(),
}));

vi.mock('../../src/config/database', () => ({
  query: mocks.query,
  testConnection: mocks.testConnection,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
    debug: mocks.loggerDebug,
  },
}));

describe('postgresStateStore observability', () => {
  const originalEnabled = process.env.POSTGRES_STATE_STORE_ENABLED;

  type WorkspaceStoreState = {
    tenants: Array<{
      tenantId: string;
      name: string;
      plan: string;
      createdAt: string;
      updatedAt: string;
    }>;
    workspaces: unknown[];
    workspaceUsers: unknown[];
    userPreferences: unknown[];
  };

  beforeEach(() => {
    vi.resetModules();
    mocks.query.mockReset();
    mocks.testConnection.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.loggerInfo.mockReset();
    mocks.loggerDebug.mockReset();
    process.env.POSTGRES_STATE_STORE_ENABLED = 'true';
    mocks.testConnection.mockResolvedValue(true);
    mocks.query.mockImplementation(async (text: string) => {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (typeof text === 'string' && text.includes('INSERT INTO tenants')) {
        throw new Error('tenant persist failed');
      }
      return { rows: [], rowCount: 0 };
    });
  });

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.POSTGRES_STATE_STORE_ENABLED;
    } else {
      process.env.POSTGRES_STATE_STORE_ENABLED = originalEnabled;
    }
  });

  it('registra contexto quando saveWorkspaceStoreState falha', async () => {
    const { saveWorkspaceStoreState } = await import('../../src/services/persistence/postgresStateStore');

    const state: WorkspaceStoreState = {
      tenants: [{
        tenantId: 'tenant-1',
        name: 'Tenant 1',
        plan: 'free',
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z',
      }],
      workspaces: [],
      workspaceUsers: [],
      userPreferences: [],
    };

    await expect(saveWorkspaceStoreState(state)).rejects.toThrow('tenant persist failed');

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantCount: 1,
        workspaceCount: 0,
        workspaceUserCount: 0,
        preferenceCount: 0,
        fallback: 'workspace-store-save-failed',
      }),
      'Failed to persist workspace store state',
    );
    expect(mocks.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('registra contexto quando saveWorkspaceSaasState falha', async () => {
    mocks.query.mockImplementation(async (text: string) => {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (typeof text === 'string' && text.includes('INSERT INTO workspace_monthly_usage')) {
        throw new Error('saas persist failed');
      }
      return { rows: [], rowCount: 0 };
    });

    const { saveWorkspaceSaasState } = await import('../../src/services/persistence/postgresStateStore');

    await expect(saveWorkspaceSaasState({
      usageByWorkspace: {
        'workspace-1': {
          '2026-05': { transactions: 1, aiQueries: 2, bankConnections: 3 },
        },
      },
      usageEventsByWorkspace: {},
      billingHooksByWorkspace: {},
    })).rejects.toThrow('saas persist failed');

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceCount: 1,
        usageEventWorkspaceCount: 0,
        billingHookWorkspaceCount: 0,
        fallback: 'saas-state-save-failed',
      }),
      'Failed to persist workspace SaaS state',
    );
    expect(mocks.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
