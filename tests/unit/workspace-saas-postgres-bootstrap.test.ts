import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-finance-postgres-bootstrap-'));

const persistenceMocks = vi.hoisted(() => ({
  loadWorkspaceStoreState: vi.fn(),
  loadJsonState: vi.fn(),
  saveJsonState: vi.fn(),
  saveWorkspaceStoreState: vi.fn(),
  loadWorkspaceSaasState: vi.fn(),
  saveWorkspaceSaasState: vi.fn(),
}));

vi.mock('../../backend/src/services/persistence/postgresStateStore', () => persistenceMocks);
vi.mock('../../backend/src/config/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

async function loadWorkspaceStoreModule() {
  vi.resetModules();
  return import('../../backend/src/services/admin/workspaceStore');
}

async function loadSaasStoreModule() {
  vi.resetModules();
  return import('../../backend/src/utils/saasStore');
}

describe('workspace and saas Postgres bootstrap', () => {
  beforeEach(() => {
    persistenceMocks.loadWorkspaceStoreState.mockReset();
    persistenceMocks.loadJsonState.mockReset();
    persistenceMocks.saveJsonState.mockReset();
    persistenceMocks.saveWorkspaceStoreState.mockReset();
    persistenceMocks.loadWorkspaceSaasState.mockReset();
    persistenceMocks.saveWorkspaceSaasState.mockReset();

    process.env.WORKSPACE_STORE_FILE = path.join(tempDir, 'workspace-store.json');
    process.env.SAAS_STORE_FILE = path.join(tempDir, 'saas-store.json');
  });

  it('prefers normalized workspace rows over the JSON blob during bootstrap', async () => {
    persistenceMocks.loadWorkspaceStoreState.mockResolvedValue({
      workspaces: [
        {
          workspaceId: 'ws-normalized',
          name: 'Normalized Workspace',
          createdAt: '2026-03-31T10:00:00.000Z',
          plan: 'pro',
          status: 'active',
          entitlements: {
            features: ['advancedInsights', 'multiBankSync', 'adminConsole', 'prioritySupport', 'billingManagement'],
            limits: { transactionsPerMonth: 10000, aiQueriesPerMonth: 5000, bankConnections: 20 },
          },
        },
      ],
      workspaceUsers: [
        {
          workspaceId: 'ws-normalized',
          userId: 'owner-1',
          role: 'owner',
          joinedAt: '2026-03-31T10:00:00.000Z',
          status: 'active',
        },
      ],
      userPreferences: [
        {
          userId: 'owner-1',
          lastSelectedWorkspaceId: 'ws-normalized',
          updatedAt: '2026-03-31T10:00:00.000Z',
        },
      ],
    });
    persistenceMocks.loadJsonState.mockResolvedValue({
      workspaces: [
        {
          workspaceId: 'ws-blob',
          name: 'Blob Workspace',
          createdAt: '2026-03-31T09:00:00.000Z',
          plan: 'free',
        },
      ],
      workspaceUsers: [],
      userPreferences: [],
    });

    const workspaceStore = await loadWorkspaceStoreModule();
    await workspaceStore.initializeWorkspaceStorePersistence();

    const snapshot = workspaceStore.getWorkspaceStoreSnapshotForTests();
    expect(snapshot.workspaces).toHaveLength(1);
    expect(snapshot.workspaces[0].workspaceId).toBe('ws-normalized');
    expect(snapshot.workspaceUsers[0].userId).toBe('owner-1');
  });

  it('merges normalized workspace SaaS state with legacy user-scoped blob data', async () => {
    persistenceMocks.loadWorkspaceSaasState.mockResolvedValue({
      usageByWorkspace: {
        'ws-1': {
          '2026-03': { transactions: 14, aiQueries: 9, bankConnections: 2 },
        },
      },
      usageEventsByWorkspace: {
        'ws-1': [
          {
            id: 'event-1',
            workspaceId: 'ws-1',
            userId: 'owner-1',
            resource: 'aiQueries',
            amount: 9,
            at: '2026-03-31T12:00:00.000Z',
          },
        ],
      },
      billingHooksByWorkspace: {
        'ws-1': [
          {
            id: 'hook-1',
            workspaceId: 'ws-1',
            userId: 'owner-1',
            plan: 'pro',
            event: 'plan_changed',
            amount: 0,
            at: '2026-03-31T12:00:00.000Z',
          },
        ],
      },
    });
    persistenceMocks.loadJsonState.mockResolvedValue({
      usageByUser: {
        'user-legacy': {
          '2026-03': { transactions: 3, aiQueries: 0, bankConnections: 0 },
        },
      },
      billingHooksByUser: {},
      userPlans: {
        'user-legacy': 'pro',
      },
    });

    const saasStore = await loadSaasStoreModule();
    await saasStore.initializeSaasStorePersistence();

    expect(saasStore.getWorkspaceUsage('ws-1')['2026-03']).toEqual({
      transactions: 14,
      aiQueries: 9,
      bankConnections: 2,
    });
    expect(saasStore.getWorkspaceBillingHookCount('ws-1')).toBe(1);
    expect(saasStore.getUserPlan('user-legacy')).toBe('pro');
    expect(saasStore.getUserUsage('user-legacy')['2026-03']).toEqual({
      transactions: 3,
      aiQueries: 0,
      bankConnections: 0,
    });
  });
});
