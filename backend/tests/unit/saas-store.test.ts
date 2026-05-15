import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockWarn = vi.fn();
const mockLoadWorkspaceSaasState = vi.fn();
const mockLoadJsonState = vi.fn();
const mockSaveJsonState = vi.fn();
const mockSaveWorkspaceSaasState = vi.fn();

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: mockWarn,
  },
}));

vi.mock('../../src/services/admin/workspaceStore', () => ({
  getWorkspace: vi.fn().mockReturnValue(undefined),
  getWorkspaceEntitlements: vi.fn().mockReturnValue(undefined),
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  loadWorkspaceSaasState: mockLoadWorkspaceSaasState,
  loadJsonState: mockLoadJsonState,
  saveJsonState: mockSaveJsonState,
  saveWorkspaceSaasState: mockSaveWorkspaceSaasState,
}));

const fsMock = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
};

vi.mock('fs', () => ({
  default: fsMock,
  existsSync: fsMock.existsSync,
  readFileSync: fsMock.readFileSync,
  mkdirSync: fsMock.mkdirSync,
  writeFileSync: fsMock.writeFileSync,
  rmSync: fsMock.rmSync,
}));

describe('saasStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mockWarn.mockClear();
    fsMock.existsSync.mockReset();
    fsMock.readFileSync.mockReset();
    fsMock.mkdirSync.mockReset();
    fsMock.writeFileSync.mockReset();
    fsMock.rmSync.mockReset();
    mockLoadWorkspaceSaasState.mockReset();
    mockLoadJsonState.mockReset();
    mockSaveJsonState.mockReset();
    mockSaveWorkspaceSaasState.mockReset();
  });

  it('registra aviso quando o store legado vem corrompido e cai para estado vazio', async () => {
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue('{invalid-json');

    const { getBillingHookCount } = await import('../../src/utils/saasStore');

    expect(getBillingHookCount('workspace-1')).toBe(0);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        filePath: expect.stringContaining('saas-store.json'),
      }),
      'Failed to load legacy SaaS store; falling back to empty state',
    );
  });

  it('registra aviso contextual quando falha o backup legado em Postgres', async () => {
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue('{}');
    mockSaveWorkspaceSaasState.mockResolvedValue(undefined);
    mockSaveJsonState.mockRejectedValueOnce(new Error('legacy backup failed'));

    const { setUserPlan } = await import('../../src/utils/saasStore');

    await expect(setUserPlan('user-1', 'pro')).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        key: 'saas_store_state',
        workspaceCount: 0,
        userCount: 0,
        billingHookWorkspaceCount: 0,
        usageEventWorkspaceCount: 0,
        fallback: 'saas-legacy-json-backup-failed',
      }),
      'Failed to persist legacy SaaS blob to Postgres',
    );
  });

  it('registra aviso contextual quando falha o backfill normalizado para Postgres', async () => {
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue('{}');
    mockLoadWorkspaceSaasState.mockResolvedValue(null);
    mockLoadJsonState.mockResolvedValue({
      usageByWorkspace: {
        workspace_a: {
          '2026-05': { transactions: 1, aiQueries: 0, bankConnections: 0 },
        },
      },
      usageByUser: {},
      billingHooksByWorkspace: {
        workspace_a: [],
      },
      billingHooksByUser: {},
      usageEventsByWorkspace: {
        workspace_a: [],
      },
      userPlans: {},
    });
    mockSaveWorkspaceSaasState.mockRejectedValueOnce(new Error('backfill failed'));

    const { initializeSaasStorePersistence } = await import('../../src/utils/saasStore');

    await expect(initializeSaasStorePersistence()).resolves.toBeUndefined();
    await vi.waitFor(() => {
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          key: 'saas_store_state',
          workspaceCount: 1,
          billingHookWorkspaceCount: 1,
          usageEventWorkspaceCount: 1,
          fallback: 'saas-backfill-to-postgres-failed',
        }),
        'Failed to backfill normalized SaaS store to Postgres',
      );
    });
  });

  it('faz backfill normalizado do SaaS store vindo do JSON legado', async () => {
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue('{}');
    mockLoadWorkspaceSaasState.mockResolvedValue(null);
    mockLoadJsonState.mockResolvedValue({
      usageByWorkspace: {
        workspace_a: {
          '2026-05': { transactions: 7, aiQueries: 2, bankConnections: 1 },
        },
      },
      usageByUser: {
        user_a: {
          '2026-05': { transactions: 3, aiQueries: 1, bankConnections: 0 },
        },
      },
      billingHooksByWorkspace: {
        workspace_a: [
          {
            userId: 'user_a',
            workspaceId: 'workspace_a',
            plan: 'pro',
            event: 'plan_changed',
            amount: 0,
            at: '2026-05-10T00:00:00.000Z',
          },
        ],
      },
      billingHooksByUser: {
        user_a: [
          {
            userId: 'user_a',
            plan: 'pro',
            event: 'plan_changed',
            amount: 0,
            at: '2026-05-10T00:00:00.000Z',
          },
        ],
      },
      usageEventsByWorkspace: {
        workspace_a: [
          {
            id: 'usage-1',
            workspaceId: 'workspace_a',
            userId: 'user_a',
            resource: 'transactions',
            amount: 7,
            at: '2026-05-10T00:00:00.000Z',
          },
        ],
      },
      userPlans: {
        user_a: 'pro',
      },
    });
    mockSaveWorkspaceSaasState.mockResolvedValue(undefined);

    const { initializeSaasStorePersistence } = await import('../../src/utils/saasStore');

    await expect(initializeSaasStorePersistence()).resolves.toBeUndefined();
    expect(mockSaveWorkspaceSaasState).toHaveBeenCalledWith(
      expect.objectContaining({
        usageByWorkspace: {
          workspace_a: {
            '2026-05': { transactions: 7, aiQueries: 2, bankConnections: 1 },
          },
        },
        usageEventsByWorkspace: {
          workspace_a: [
            expect.objectContaining({
              id: 'usage-1',
              workspaceId: 'workspace_a',
              resource: 'transactions',
              amount: 7,
            }),
          ],
        },
        billingHooksByWorkspace: {
          workspace_a: [
            expect.objectContaining({
              workspaceId: 'workspace_a',
              plan: 'pro',
              event: 'plan_changed',
              amount: 0,
            }),
          ],
        },
      }),
    );
  });
});
