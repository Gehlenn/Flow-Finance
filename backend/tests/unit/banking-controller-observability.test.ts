import { describe, expect, it, vi } from 'vitest';

const controllerMocks = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  getConnectionsForUserAsync: vi.fn(),
  setConnectionsForUser: vi.fn(),
  recordAuditEvent: vi.fn(),
  isPluggyProviderEnabled: vi.fn(),
  isSupportedOpenFinanceProvider: vi.fn(),
  pluggyGetAccounts: vi.fn(),
  pluggyGetItem: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: controllerMocks.loggerWarn,
    error: controllerMocks.loggerError,
    info: controllerMocks.loggerInfo,
    debug: vi.fn(),
  },
}));

vi.mock('../../src/config/env', () => ({
  default: {
    OPEN_FINANCE_PROVIDER: 'pluggy',
    PLUGGY_BANK_CONNECTORS: '{invalid-json',
    PLUGGY_DEFAULT_CREDENTIALS_JSON: '{invalid-json',
  },
}));

vi.mock('../../src/services/openFinance/bankingConnectionStore', () => ({
  createBankingConnectionStore: () => ({
    getConnectionsForUser: controllerMocks.getConnectionsForUserAsync,
    setConnectionsForUser: controllerMocks.setConnectionsForUser,
    findConnectionsByExternalItemId: vi.fn(),
    countUsersWithConnections: vi.fn(),
  }),
  migrateConnectionsBetweenStores: vi.fn(),
  StoredBankConnection: {},
}));

vi.mock('../../src/services/openFinance/pluggyClient', () => ({
  PluggyClient: class {
    getAccounts = controllerMocks.pluggyGetAccounts;
    getItem = controllerMocks.pluggyGetItem;
    createItem = vi.fn();
    deleteItem = vi.fn();
  },
}));

vi.mock('../../src/services/openFinance/providerMode', () => ({
  isPluggyProviderEnabled: controllerMocks.isPluggyProviderEnabled,
  isSupportedOpenFinanceProvider: controllerMocks.isSupportedOpenFinanceProvider,
}));

vi.mock('../../src/services/admin/auditLog', () => ({
  recordAuditEvent: controllerMocks.recordAuditEvent,
}));

import { connectBankController, listConnectionsController, syncBankController } from '../../src/controllers/bankingController';

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('bankingController observability', () => {
  it('registra contexto ao falhar ao parsear configuracoes Pluggy durante connect', async () => {
    controllerMocks.isSupportedOpenFinanceProvider.mockReturnValue(true);
    controllerMocks.isPluggyProviderEnabled.mockReturnValue(true);
    controllerMocks.getConnectionsForUserAsync.mockResolvedValue([]);

    const req: any = {
      body: {
        bankId: 'nubank',
        userId: 'user-1',
      },
      userId: 'user-1',
      workspaceId: 'workspace-1',
    };
    const res = makeRes();

    connectBankController(req, res, vi.fn());

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(400);
    });

    expect(controllerMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        envVar: 'PLUGGY_BANK_CONNECTORS',
        rawLength: expect.any(Number),
        fallback: 'pluggy-bank-connectors-parse-failed',
      }),
      'Failed to parse PLUGGY_BANK_CONNECTORS environment variable',
    );
    expect(controllerMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        envVar: 'PLUGGY_DEFAULT_CREDENTIALS_JSON',
        rawLength: expect.any(Number),
        fallback: 'pluggy-default-credentials-parse-failed',
      }),
      'Failed to parse PLUGGY_DEFAULT_CREDENTIALS_JSON environment variable',
    );
  });

  it('registra contexto ao falhar a sincronizacao Pluggy', async () => {
    controllerMocks.isSupportedOpenFinanceProvider.mockReturnValue(true);
    controllerMocks.isPluggyProviderEnabled.mockReturnValue(true);
    controllerMocks.getConnectionsForUserAsync.mockResolvedValue([
      {
        id: 'conn-1',
        user_id: 'workspace-1::user-1',
        bank_name: 'Nubank',
        bank_logo: 'logo',
        bank_color: '#000',
        provider: 'pluggy',
        connection_status: 'connected',
        external_account_id: 'item-1',
        created_at: '2026-05-10T00:00:00.000Z',
      },
    ]);
    controllerMocks.pluggyGetAccounts.mockRejectedValueOnce(new Error('pluggy sync exploded'));

    const req: any = {
      body: {
        connectionId: 'conn-1',
        userId: 'user-1',
        days: 14,
      },
      userId: 'user-1',
      workspaceId: 'workspace-1',
    };
    const res = makeRes();

    syncBankController(req, res, vi.fn());

    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(502);
    });

    expect(controllerMocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'pluggy sync exploded',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        connectionId: 'conn-1',
        days: 14,
        fallback: 'pluggy-sync-failed',
      }),
      'Pluggy sync failed',
    );
  });

  it('registra contexto quando a chave scoped de armazenamento vem malformada', async () => {
    controllerMocks.isSupportedOpenFinanceProvider.mockReturnValue(false);
    controllerMocks.isPluggyProviderEnabled.mockReturnValue(false);
    controllerMocks.getConnectionsForUserAsync.mockResolvedValue([
      {
        id: 'conn-2',
        user_id: 'user-2',
        bank_name: 'Nubank',
        bank_logo: 'logo',
        bank_color: '#000',
        provider: 'mock',
        connection_status: 'connected',
        external_account_id: 'ext-1',
        created_at: '2026-05-10T00:00:00.000Z',
      },
    ]);

    const req: any = {
      query: {
        userId: 'user-1',
      },
      userId: 'user-1',
      workspaceId: 'workspace-1',
    };
    const res = makeRes();

    await listConnectionsController(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 'user-2',
        }),
      ]),
    );
    expect(controllerMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeKey: 'user-2',
        fallback: 'banking-scoped-storage-key-parse-failed',
      }),
      'Malformed workspace scoped storage key encountered',
    );
  });
});
