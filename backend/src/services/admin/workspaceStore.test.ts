import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../persistence/postgresStateStore', () => ({
  isPostgresStateStoreEnabled: vi.fn(() => false),
  queryWorkspaceById: vi.fn(),
  // Unused but imported by the module under test
  loadJsonState: vi.fn(),
  saveJsonState: vi.fn(),
  saveWorkspaceStoreState: vi.fn(),
  loadWorkspaceStoreState: vi.fn(() => ({ workspaces: [], tenants: [], users: [] })),
  queryLastWorkspaceForUser: vi.fn(),
  queryTenantById: vi.fn(),
  queryTenantsForUser: vi.fn(),
  queryWorkspaceByBillingCustomerId: vi.fn(),
  queryWorkspacesForUser: vi.fn(),
  queryWorkspaceUsers: vi.fn(),
}));

vi.mock('../../config/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./auditLog', () => ({
  recordAuditEvent: vi.fn(),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { updateWorkspaceBillingAsync } from './workspaceStore';
import * as store from '../persistence/postgresStateStore';

const isPostgresEnabled = store.isPostgresStateStoreEnabled as ReturnType<typeof vi.fn>;
const queryWorkspaceById = store.queryWorkspaceById as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWorkspace(id = 'ws-1') {
  return {
    id,
    name: 'Test Workspace',
    ownerId: 'user-1',
    plan: 'free' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    billingEmail: null,
    billingCustomerId: null,
    subscription: null,
    users: [],
    entitlements: null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('updateWorkspaceBillingAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('quando Postgres está desabilitado', () => {
    it('delega para updateWorkspaceBilling via caminho síncrono e retorna undefined para workspace inexistente', async () => {
      isPostgresEnabled.mockReturnValue(false);

      // sem workspace no cache em memória → sync path retorna undefined
      const result = await updateWorkspaceBillingAsync('ws-nao-existe', { plan: 'pro' });

      expect(result).toBeUndefined();
      // não deve ter consultado o Postgres
      expect(queryWorkspaceById).not.toHaveBeenCalled();
    });
  });

  describe('quando Postgres está habilitado', () => {
    it('retorna undefined se workspace não encontrado no banco', async () => {
      isPostgresEnabled.mockReturnValue(true);
      queryWorkspaceById.mockResolvedValue(undefined);

      const result = await updateWorkspaceBillingAsync('ws-missing', { billingEmail: 'a@b.com' });

      expect(result).toBeUndefined();
      expect(queryWorkspaceById).toHaveBeenCalledWith('ws-missing');
    });

    it('consulta o banco antes de atualizar quando workspace é encontrado', async () => {
      isPostgresEnabled.mockReturnValue(true);
      const workspace = makeWorkspace('ws-found');
      queryWorkspaceById.mockResolvedValue(workspace);

      // updateWorkspaceBilling sync path tentará ler do cache (vazio) → retorna undefined
      // mas o caminho Postgres foi exercitado corretamente
      await updateWorkspaceBillingAsync('ws-found', { plan: 'pro' });

      expect(queryWorkspaceById).toHaveBeenCalledWith('ws-found');
    });

    it('não chama queryWorkspaceById quando Postgres está desabilitado', async () => {
      isPostgresEnabled.mockReturnValue(false);

      await updateWorkspaceBillingAsync('ws-1', { billingCustomerId: 'cus_abc' });

      expect(queryWorkspaceById).not.toHaveBeenCalled();
    });
  });
});
