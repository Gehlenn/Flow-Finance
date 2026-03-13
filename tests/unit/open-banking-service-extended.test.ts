import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import type { Transaction } from '../../types';

vi.mock('../../services/integrations/mockBankProvider', () => ({
  getProvider: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({ external_id: 'mock_ext_id' }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    fetchAccounts: vi.fn().mockResolvedValue([
      { id: 'acc_001', balance: 5000.0, currency: 'BRL', type: 'checking' },
    ]),
    fetchTransactions: vi.fn().mockResolvedValue([
      { id: 'tx_001', date: new Date(Date.now() - 86400000).toISOString(), amount: -150.0, description: 'Amazon.com', merchant: 'AMAZON' },
      { id: 'tx_002', date: new Date(Date.now() - 172800000).toISOString(), amount: 5000.0, description: 'Salario', merchant: 'EMPRESA_XYZ' },
    ]),
  })),
}));

vi.mock('../../src/ai/aiMemory', () => ({
  learnMemory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/finance/importService', () => ({
  classifyImportedTransactions: vi.fn().mockImplementation((txs: any[]) =>
    Promise.resolve(
      txs.map((t: any, i: number) => ({
        ...t,
        category: i % 2 === 0 ? 'PESSOAL' : 'SALARIO',
        confidence: 0.88,
      }))
    )
  ),
}));

vi.mock('../../src/events/eventEngine', () => ({
  FinancialEventEmitter: {
    bankTransactionsSynced: vi.fn(),
    insightGenerated: vi.fn(),
    transactionAdded: vi.fn(),
  },
}));

let apiRequestMock = vi.fn();
vi.mock('../../src/config/api.config', async () => {
  const actual = await vi.importActual('../../src/config/api.config');
  return {
    ...(actual as object),
    apiRequest: (...args: any[]) => apiRequestMock(...args),
    API_ENDPOINTS: {
      BANKING: {
        HEALTH: '/api/banking/health',
        CONNECTIONS: '/api/banking/connections',
        CONNECT_TOKEN: '/api/banking/connect-token',
        CONNECT: '/api/banking/connect',
        SYNC: '/api/banking/sync',
        DISCONNECT: '/api/banking/disconnect',
        CONNECTORS: '/api/banking/connectors',
      },
    },
  };
});

import {
  connectBank,
  createPluggyConnectToken,
  connectPluggyItem,
  disconnectBank,
  getBankingHealth,
  syncTransactions,
  syncAccounts,
  fullSync,
  getConnection,
  getConnections,
  reloadConnections,
  listPluggyConnectors,
  formatLastSync,
} from '../../services/integrations/openBankingService';

import { getProvider } from '../../services/integrations/mockBankProvider';

describe('openBankingService - Extended Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    apiRequestMock = vi.fn();
    vi.mocked(getProvider).mockReturnValue({
      connect: vi.fn().mockResolvedValue({ external_id: 'mock_ext_id' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      fetchAccounts: vi.fn().mockResolvedValue([
        { id: 'acc_001', balance: 5000.0, currency: 'BRL', type: 'checking' },
      ]),
      fetchTransactions: vi.fn().mockResolvedValue([
        { id: 'tx_001', date: new Date(Date.now() - 86400000).toISOString(), amount: -150.0, description: 'Amazon.com', merchant: 'AMAZON' },
        { id: 'tx_002', date: new Date(Date.now() - 172800000).toISOString(), amount: 5000.0, description: 'Salario', merchant: 'EMPRESA_XYZ' },
      ]),
    } as any);
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('connecta banco e persiste localmente', async () => {
    const conn = await connectBank('nubank', 'u1');
    expect(conn.provider).toBeTruthy();
    expect(getConnection(conn.id)).not.toBeNull();
  });

  it('registra erro quando learnMemory falha no fluxo local', async () => {
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { learnMemory } = await import('../../src/ai/aiMemory');
    vi.mocked(learnMemory).mockRejectedValueOnce(new Error('memory failed'));

    await connectBank('nubank', 'u-memory-error');

    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('isola conexoes por usuario', async () => {
    await connectBank('nubank', 'alice');
    await connectBank('itau', 'bob');

    expect(getConnections('alice')).toHaveLength(1);
    expect(getConnections('bob')).toHaveLength(1);
  });

  it('tolera storage invalido ao ler conexoes', () => {
    localStorage.setItem('flow_bank_connections', '{invalido');

    expect(getConnections('u-storage-broken')).toEqual([]);
    expect(getConnection('missing')).toBeNull();
  });

  it('disconnect remove conexao', async () => {
    const conn = await connectBank('nubank', 'u1');
    await disconnectBank(conn.id);
    expect(getConnection(conn.id)).toBeNull();
  });

  it('sync importa transacoes', async () => {
    const conn = await connectBank('nubank', 'u1');
    const imported: any[] = [];

    const result = await syncTransactions(conn.id, [], 'u1', (txs) => imported.push(...txs));

    expect(result.transactions_imported).toBe(2);
    expect(imported).toHaveLength(2);
  });

  it('sync deduplica contra existingTransactions', async () => {
    const conn = await connectBank('nubank', 'u1');
    const first: any[] = [];

    await syncTransactions(conn.id, [], 'u1', (txs) => first.push(...txs));

    const second: any[] = [];
    const result2 = await syncTransactions(conn.id, first as Transaction[], 'u1', (txs) => second.push(...txs));

    expect(result2.transactions_imported).toBeLessThanOrEqual(1);
    expect(second.length).toBeLessThanOrEqual(1);
  });

  it('sync retorna zero quando todas as transacoes sao duplicadas', async () => {
    const conn = await connectBank('nubank', 'u-dup');
    const existing = [
      {
        id: 'existing-1',
        amount: 150,
        description: 'Amazon.com',
        merchant: 'AMAZON',
        type: 'DESPESA',
        category: 'PESSOAL',
        date: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'existing-2',
        amount: 5000,
        description: 'EMPRESA_XYZ',
        merchant: 'EMPRESA_XYZ',
        type: 'RECEITA',
        category: 'SALARIO',
        date: new Date(Date.now() - 172800000).toISOString(),
      },
    ] as any;

    const imported: any[] = [];
    const result = await syncTransactions(conn.id, existing, 'u-dup', (txs) => imported.push(...txs));

    expect(result.transactions_imported).toBe(0);
    expect(imported).toEqual([]);
  });

  it('retorna erro quando conexao nao existe', async () => {
    const result = await syncTransactions('fake', [], 'u1', vi.fn());
    expect(result.error).toBeDefined();
  });

  it('retorna erro quando provider falha no fetchTransactions', async () => {
    vi.mocked(getProvider).mockReturnValue({
      connect: vi.fn().mockResolvedValue({ external_id: 'id' }),
      disconnect: vi.fn(),
      fetchAccounts: vi.fn().mockResolvedValue([]),
      fetchTransactions: vi.fn().mockRejectedValue(new Error('Provider failure')),
    } as any);

    const conn = await connectBank('nubank', 'u1');
    const result = await syncTransactions(conn.id, [], 'u1', vi.fn());
    expect(result.error).toBeDefined();
  });

  it('usa mapeamento basico quando classificacao por IA falha', async () => {
    const { classifyImportedTransactions } = await import('../../src/finance/importService');
    vi.mocked(classifyImportedTransactions).mockRejectedValueOnce(new Error('classification failed'));

    const conn = await connectBank('nubank', 'u-ai-fallback');
    const imported: any[] = [];

    const result = await syncTransactions(conn.id, [], 'u-ai-fallback', (txs) => imported.push(...txs));

    expect(result.transactions_imported).toBe(2);
    expect(imported[0]).toMatchObject({
      category: 'Pessoal',
      description: 'Amazon.com',
      amount: 150,
      source: 'import',
    });
  });

  it('fullSync executa mesmo com erro em syncAccounts', async () => {
    vi.mocked(getProvider).mockReturnValue({
      connect: vi.fn().mockResolvedValue({ external_id: 'id' }),
      disconnect: vi.fn(),
      fetchAccounts: vi.fn().mockRejectedValue(new Error('accounts error')),
      fetchTransactions: vi.fn().mockResolvedValue([
        { id: 'tx_ok', date: new Date().toISOString(), amount: -10, description: 'x', merchant: 'y' },
      ]),
    } as any);

    const conn = await connectBank('nubank', 'u1');
    const result = await fullSync(conn.id, [], [], 'u1', vi.fn(), vi.fn());
    expect(result.connection_id).toBe(conn.id);
  });

  it('connectPluggyItem chama API backend', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_pluggy_1', user_id: 'u1', provider: 'nubank',
      bank_name: 'Nubank', bank_logo: '', bank_color: '#820AD1',
      connection_status: 'connected', created_at: new Date().toISOString(),
    });

    const result = await connectPluggyItem('nubank', 'u1', 'item_xyz');
    expect(result.id).toBe('conn_pluggy_1');
    expect(apiRequestMock).toHaveBeenCalled();
  });

  it('connectPluggyItem atualiza conexao existente com mesmo id', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock
      .mockResolvedValueOnce({
        id: 'conn_same_id', user_id: 'u1', provider: 'nubank',
        bank_name: 'Banco Inicial', bank_logo: '', bank_color: '#111111',
        connection_status: 'connected', created_at: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        id: 'conn_same_id', user_id: 'u1', provider: 'nubank',
        bank_name: 'Banco Atualizado', bank_logo: '', bank_color: '#222222',
        connection_status: 'error', created_at: new Date().toISOString(),
      });

    await connectPluggyItem('nubank', 'u1', 'item_a');
    await connectPluggyItem('nubank', 'u1', 'item_b');

    expect(getConnections('u1')).toHaveLength(1);
    expect(getConnection('conn_same_id')).toMatchObject({
      bank_name: 'Banco Atualizado',
      connection_status: 'error',
    });
  });

  it('usa backend quando habilitado para health, connectors e token', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock
      .mockResolvedValueOnce({
        status: 'ok',
        providerMode: 'backend',
        pluggyConfigured: true,
        totalUsersWithConnections: 2,
        timestamp: '2026-03-12T00:00:00.000Z',
      })
      .mockResolvedValueOnce([
        { id: 101, name: 'Nubank', primaryColor: '#820AD1' },
      ])
      .mockResolvedValueOnce({ accessToken: 'pluggy-token-123' });

    await expect(getBankingHealth()).resolves.toMatchObject({ status: 'ok', providerMode: 'backend' });
    await expect(listPluggyConnectors()).resolves.toEqual([
      { id: 101, name: 'Nubank', primaryColor: '#820AD1' },
    ]);
    await expect(createPluggyConnectToken('user-backend')).resolves.toBe('pluggy-token-123');

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/api/banking/health', { method: 'GET', retries: 1 });
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/api/banking/connectors', { method: 'GET', retries: 1 });
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/api/banking/connect-token', {
      method: 'POST',
      body: JSON.stringify({}),
      retries: 1,
    });
  });

  it('retorna fallbacks vazios quando health e connectors falham no backend', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock
      .mockRejectedValueOnce(new Error('health down'))
      .mockRejectedValueOnce(new Error('connectors down'))
      .mockResolvedValueOnce({ accessToken: 'pluggy-token-anon' });

    await expect(getBankingHealth()).resolves.toBeNull();
    await expect(listPluggyConnectors()).resolves.toEqual([]);
    await expect(createPluggyConnectToken()).resolves.toBe('pluggy-token-anon');

    expect(apiRequestMock).toHaveBeenLastCalledWith('/api/banking/connect-token', {
      method: 'POST',
      body: JSON.stringify({}),
      retries: 1,
    });
  });

  it('connectBank prefere backend quando habilitado', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_backend_1',
      user_id: 'u-back',
      provider: 'pluggy',
      bank_name: 'Banco Backend',
      bank_logo: '',
      bank_color: '#123456',
      connection_status: 'connected',
      external_account_id: 'ext-backend',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    const conn = await connectBank('nubank', 'u-back');

    expect(conn.id).toBe('conn_backend_1');
    expect(getConnection('conn_backend_1')?.bank_name).toBe('Banco Backend');
    expect(getProvider).not.toHaveBeenCalled();
  });

  it('connectBank faz fallback local quando backend falha', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');
    apiRequestMock.mockRejectedValueOnce(new Error('backend unavailable'));

    const conn = await connectBank('nubank', 'u-fallback');

    expect(conn.provider).toBeTruthy();
    expect(conn.external_account_id).toBe('mock_ext_id');
    expect(getProvider).toHaveBeenCalled();
  });

  it('connectBank nao faz fallback local quando backend retorna 401', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');
    apiRequestMock.mockRejectedValueOnce(new Error('API Error 401: unauthorized'));

    await expect(connectBank('nubank', 'u-no-fallback-401')).rejects.toThrow(/401/);
    expect(getConnections('u-no-fallback-401')).toHaveLength(0);
  });

  it('connectBank nao faz fallback local em producao quando backend retorna 500', async () => {
    vi.stubEnv('MODE', 'production');
    apiRequestMock.mockRejectedValueOnce(new Error('API Error 500: backend down'));

    await expect(connectBank('nubank', 'u-no-fallback-prod-500')).rejects.toThrow(/500/);
    expect(getConnections('u-no-fallback-prod-500')).toHaveLength(0);
  });

  it('syncTransactions usa resultado do backend e atualiza status conectado', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_backend_sync',
      user_id: 'u1',
      provider: 'pluggy',
      bank_name: 'Banco Sync',
      bank_logo: '',
      bank_color: '#111111',
      connection_status: 'connected',
      external_account_id: 'ext-sync',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    const conn = await connectBank('nubank', 'u1');
    const imported: any[] = [];

    apiRequestMock.mockResolvedValueOnce({
      connection_id: conn.id,
      transactions_imported: 1,
      balance_updated: true,
      new_balance: 777,
      synced_at: '2026-03-12T01:00:00.000Z',
      transactions: [{ description: 'PIX recebido', amount: 120, source: 'import' }],
    });

    const result = await syncTransactions(conn.id, [], 'u1', (txs) => imported.push(...txs), 7);

    expect(result.transactions_imported).toBe(1);
    expect(imported).toEqual([{ description: 'PIX recebido', amount: 120, source: 'import' }]);
    expect(getConnection(conn.id)).toMatchObject({
      connection_status: 'connected',
      last_sync: '2026-03-12T01:00:00.000Z',
      balance: 777,
    });
  });

  it('syncTransactions marca erro quando backend retorna erro sem transacoes', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_backend_error',
      user_id: 'u2',
      provider: 'pluggy',
      bank_name: 'Banco Erro',
      bank_logo: '',
      bank_color: '#222222',
      connection_status: 'connected',
      external_account_id: 'ext-error',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    const conn = await connectBank('nubank', 'u2');
    const imported: any[] = [];

    apiRequestMock.mockResolvedValueOnce({
      connection_id: conn.id,
      transactions_imported: 0,
      balance_updated: false,
      synced_at: '2026-03-12T02:00:00.000Z',
      error: 'sync failed',
    });

    const result = await syncTransactions(conn.id, [], 'u2', (txs) => imported.push(...txs));

    expect(result.error).toBe('sync failed');
    expect(imported).toEqual([]);
    expect(getConnection(conn.id)).toMatchObject({
      connection_status: 'error',
      error_message: 'sync failed',
    });
  });

  it('syncAccounts registra erro quando provider falha', async () => {
    vi.mocked(getProvider).mockReturnValue({
      connect: vi.fn().mockResolvedValue({ external_id: 'id_accounts_error' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      fetchAccounts: vi.fn().mockRejectedValue(new Error('accounts exploded')),
      fetchTransactions: vi.fn().mockResolvedValue([]),
    } as any);

    const conn = await connectBank('nubank', 'u-accounts-error');

    await expect(syncAccounts(conn.id, [], vi.fn())).rejects.toThrow('accounts exploded');
    expect(getConnection(conn.id)).toMatchObject({
      connection_status: 'error',
      error_message: 'accounts exploded',
    });
  });

  it('syncAccounts nao atualiza contas quando nao encontra vinculacao', async () => {
    const conn = await connectBank('nubank', 'u-without-linked-account');
    const updates: any[] = [];

    await syncAccounts(conn.id, [
      {
        id: 'acc-unlinked',
        userId: 'u-without-linked-account',
        name: 'Carteira em especie',
        type: 'cash',
        balance: 10,
        currency: 'BRL',
        isActive: true,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ] as any, (acc) => updates.push(acc));

    expect(updates).toEqual([]);
    expect(getConnection(conn.id)?.connection_status).toBe('connected');
  });

  it('syncAccounts vincula saldo em conta generica de open banking', async () => {
    const conn = await connectBank('nubank', 'u-open-banking-link');
    const updates: any[] = [];

    await syncAccounts(conn.id, [
      {
        id: 'acc-open-banking',
        userId: 'u-open-banking-link',
        name: 'Conta Open Banking',
        type: 'checking',
        balance: 0,
        currency: 'BRL',
        isActive: true,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ] as any, (acc) => updates.push(acc));

    expect(updates).toHaveLength(1);
    expect(updates[0].balance).toBe(5000);
  });

  it('disconnectBank remove conexao mesmo com falha no backend e no provider', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockRejectedValueOnce(new Error('disconnect backend failure'));
    vi.mocked(getProvider).mockReturnValue({
      connect: vi.fn().mockResolvedValue({ external_id: 'disconnect_ext' }),
      disconnect: vi.fn().mockRejectedValue(new Error('disconnect provider failure')),
      fetchAccounts: vi.fn().mockResolvedValue([]),
      fetchTransactions: vi.fn().mockResolvedValue([]),
    } as any);

    const conn = await connectBank('nubank', 'u-disconnect');
    await disconnectBank(conn.id);

    expect(getConnection(conn.id)).toBeNull();
  });

  it('disconnectBank usa backend com sucesso antes de remover conexao local', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock
      .mockResolvedValueOnce({
        id: 'conn_disconnect_success',
        user_id: 'u-disconnect-success',
        provider: 'pluggy',
        bank_name: 'Banco Disconnect',
        bank_logo: '',
        bank_color: '#666666',
        connection_status: 'connected',
        external_account_id: 'ext-disconnect-success',
        created_at: '2026-03-12T00:00:00.000Z',
      })
      .mockResolvedValueOnce({ success: true });

    const conn = await connectBank('nubank', 'u-disconnect-success');
    await disconnectBank(conn.id);

    expect(apiRequestMock).toHaveBeenLastCalledWith('/api/banking/disconnect', {
      method: 'POST',
      body: JSON.stringify({ connectionId: conn.id }),
      retries: 1,
    });
    expect(getConnection(conn.id)).toBeNull();
  });

  it('disconnectBank nao chama provider.disconnect quando nao ha external_account_id', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_without_external',
      user_id: 'u-no-external',
      provider: 'pluggy',
      bank_name: 'Banco Sem Externo',
      bank_logo: '',
      bank_color: '#444444',
      connection_status: 'connected',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    const providerDisconnect = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getProvider).mockReturnValue({
      connect: vi.fn().mockResolvedValue({ external_id: 'ignored' }),
      disconnect: providerDisconnect,
      fetchAccounts: vi.fn().mockResolvedValue([]),
      fetchTransactions: vi.fn().mockResolvedValue([]),
    } as any);

    const conn = await connectBank('nubank', 'u-no-external');
    await disconnectBank(conn.id);

    expect(providerDisconnect).not.toHaveBeenCalled();
    expect(getConnection(conn.id)).toBeNull();
  });

  it('syncTransactions faz fallback local quando sync do backend falha', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_backend_to_local',
      user_id: 'u-local',
      provider: 'pluggy',
      bank_name: 'Banco Fallback',
      bank_logo: '',
      bank_color: '#555555',
      connection_status: 'connected',
      external_account_id: 'ext-local',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    const conn = await connectBank('nubank', 'u-local');
    apiRequestMock.mockRejectedValueOnce(new Error('backend sync failure'));

    const imported: any[] = [];
    const result = await syncTransactions(conn.id, [], 'u-local', (txs) => imported.push(...txs));

    expect(result.transactions_imported).toBe(2);
    expect(imported).toHaveLength(2);
  });

  it('syncTransactions nao faz fallback local quando backend retorna 401', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_backend_401',
      user_id: 'u-401',
      provider: 'pluggy',
      bank_name: 'Banco 401',
      bank_logo: '',
      bank_color: '#717171',
      connection_status: 'connected',
      external_account_id: 'ext-401',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    const conn = await connectBank('nubank', 'u-401');
    apiRequestMock.mockRejectedValueOnce(new Error('API Error 401: unauthorized'));

    const imported: any[] = [];
    const result = await syncTransactions(conn.id, [], 'u-401', (txs) => imported.push(...txs));

    expect(result.transactions_imported).toBe(0);
    expect(result.error).toMatch(/401/);
    expect(imported).toEqual([]);
    expect(getConnection(conn.id)).toMatchObject({
      connection_status: 'error',
    });
  });

  it('syncTransactions nao faz fallback local em producao quando backend retorna 500', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');
    vi.stubEnv('MODE', 'production');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_backend_prod_500',
      user_id: 'u-prod-500',
      provider: 'pluggy',
      bank_name: 'Banco 500',
      bank_logo: '',
      bank_color: '#7a7a7a',
      connection_status: 'connected',
      external_account_id: 'ext-prod-500',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    const conn = await connectBank('nubank', 'u-prod-500');
    apiRequestMock.mockRejectedValueOnce(new Error('API Error 500: backend down'));

    const imported: any[] = [];
    const result = await syncTransactions(conn.id, [], 'u-prod-500', (txs) => imported.push(...txs));

    expect(result.transactions_imported).toBe(0);
    expect(result.error).toMatch(/500/);
    expect(imported).toEqual([]);
    expect(getConnection(conn.id)).toMatchObject({
      connection_status: 'error',
    });
  });

  it('syncTransactions remove conexao mock em producao e nao importa dados', async () => {
    vi.stubEnv('MODE', 'production');

    localStorage.setItem('flow_bank_connections', JSON.stringify([
      {
        id: 'conn_mock_sync_prod',
        user_id: 'u-prod-mock-sync',
        provider: 'mock',
        bank_name: 'Mock Bank',
        bank_logo: '🏦',
        bank_color: '#000000',
        connection_status: 'connected',
        external_account_id: 'mock_ext_sync_prod',
        created_at: '2026-03-12T00:00:00.000Z',
      },
    ]));

    const imported: any[] = [];
    const result = await syncTransactions('conn_mock_sync_prod', [], 'u-prod-mock-sync', (txs) => imported.push(...txs));

    expect(result.transactions_imported).toBe(0);
    expect(result.error).toMatch(/Conexão local de teste removida/i);
    expect(imported).toEqual([]);
    expect(getConnection('conn_mock_sync_prod')).toBeNull();
  });

  it('remove conexao local obsoleta quando backend retorna 404 no sync', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_404',
      user_id: 'u404',
      provider: 'pluggy',
      bank_name: 'Banco 404',
      bank_logo: '',
      bank_color: '#333333',
      connection_status: 'connected',
      external_account_id: 'ext-404',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    const conn = await connectBank('nubank', 'u404');
    apiRequestMock.mockRejectedValueOnce(new Error('API Error 404: Connection not found'));

    const result = await syncTransactions(conn.id, [], 'u404', vi.fn());

    expect(result.error).toMatch(/Conexão não encontrada no backend/i);
    expect(getConnection(conn.id)).toBeNull();
  });

  it('reloadConnections reconcilia cache local com lista do backend', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_local_old',
      user_id: 'u-reload',
      provider: 'pluggy',
      bank_name: 'Banco Antigo',
      bank_logo: '',
      bank_color: '#111111',
      connection_status: 'connected',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    await connectBank('nubank', 'u-reload');

    apiRequestMock.mockResolvedValueOnce([
      {
        id: 'conn_backend_new',
        user_id: 'u-reload',
        provider: 'pluggy',
        bank_name: 'Banco Novo',
        bank_logo: '',
        bank_color: '#222222',
        connection_status: 'connected',
        created_at: '2026-03-12T01:00:00.000Z',
      },
    ]);

    const fresh = await reloadConnections('u-reload');

    expect(fresh).toHaveLength(1);
    expect(fresh[0].id).toBe('conn_backend_new');
    expect(getConnections('u-reload').map((c) => c.id)).toEqual(['conn_backend_new']);
  });

  it('reloadConnections retorna cache local quando backend de conexoes falha', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_local_keep',
      user_id: 'u-reload-fallback',
      provider: 'pluggy',
      bank_name: 'Banco Local',
      bank_logo: '',
      bank_color: '#999999',
      connection_status: 'connected',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    await connectBank('nubank', 'u-reload-fallback');

    apiRequestMock.mockRejectedValueOnce(new Error('connections endpoint down'));

    const fallback = await reloadConnections('u-reload-fallback');

    expect(fallback).toHaveLength(1);
    expect(fallback[0].id).toBe('conn_local_keep');
    expect(getConnections('u-reload-fallback')[0].id).toBe('conn_local_keep');
  });

  it('reloadConnections retorna local quando backend está desabilitado', async () => {
    const conn = await connectBank('nubank', 'u-local-only');
    const local = await reloadConnections('u-local-only');

    expect(local).toHaveLength(1);
    expect(local[0].id).toBe(conn.id);
  });

  it('reloadConnections remove conexoes mock em producao', async () => {
    vi.stubEnv('MODE', 'production');

    localStorage.setItem('flow_bank_connections', JSON.stringify([
      {
        id: 'conn_mock_prod',
        user_id: 'u-prod-clean',
        provider: 'mock',
        bank_name: 'Mock Bank',
        bank_logo: '🏦',
        bank_color: '#000000',
        connection_status: 'connected',
        external_account_id: 'mock_ext_prod',
        created_at: '2026-03-12T00:00:00.000Z',
      },
    ]));

    const cleaned = await reloadConnections('u-prod-clean');

    expect(cleaned).toEqual([]);
    expect(getConnections('u-prod-clean')).toEqual([]);
  });

  it('syncTransactions continua mesmo se o registro for removido antes do updateStatus final', async () => {
    const conn = await connectBank('nubank', 'u-status-missing');
    const imported: any[] = [];

    const result = await syncTransactions(conn.id, [], 'u-status-missing', (txs) => {
      imported.push(...txs);
      localStorage.setItem('flow_bank_connections', '[]');
    });

    expect(result.transactions_imported).toBe(2);
    expect(imported).toHaveLength(2);
    expect(getConnection(conn.id)).toBeNull();
  });

  it('syncTransactions continua em fallback local mesmo com erro backend sem message', async () => {
    vi.stubEnv('VITE_ENABLE_TEST_BACKEND_BANKING', '1');

    apiRequestMock.mockResolvedValueOnce({
      id: 'conn_no_message_backend',
      user_id: 'u-no-message-backend',
      provider: 'pluggy',
      bank_name: 'Banco Sem Mensagem',
      bank_logo: '',
      bank_color: '#ababab',
      connection_status: 'connected',
      external_account_id: 'ext-no-message-backend',
      created_at: '2026-03-12T00:00:00.000Z',
    });

    const conn = await connectBank('nubank', 'u-no-message-backend');
    apiRequestMock.mockRejectedValueOnce({});

    const result = await syncTransactions(conn.id, [], 'u-no-message-backend', vi.fn());
    expect(result.transactions_imported).toBe(2);
  });

  it('syncAccounts usa mensagem padrão quando erro não possui campo message', async () => {
    vi.mocked(getProvider).mockReturnValue({
      connect: vi.fn().mockResolvedValue({ external_id: 'id_accounts_default_error' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      fetchAccounts: vi.fn().mockRejectedValue({}),
      fetchTransactions: vi.fn().mockResolvedValue([]),
    } as any);

    const conn = await connectBank('nubank', 'u-accounts-default-error');

    await expect(syncAccounts(conn.id, [], vi.fn())).rejects.toEqual({});
    expect(getConnection(conn.id)).toMatchObject({
      connection_status: 'error',
      error_message: 'Erro ao sincronizar contas.',
    });
  });

  it('syncTransactions usa fallbacks dos campos classificados quando a IA retorna payload parcial', async () => {
    const { classifyImportedTransactions } = await import('../../src/finance/importService');
    vi.mocked(classifyImportedTransactions).mockResolvedValueOnce([
      {
        amount: 150,
        raw_type: 'Despesa',
        description: 'Amazon ajustado',
        date: '2026-03-10T00:00:00.000Z',
        merchant: 'AMAZON',
      },
      {
        raw_amount: 5000,
        type: 'Receita',
        category: 'Salario',
        raw_description: 'Salario IA',
        raw_date: '2026-03-09T00:00:00.000Z',
        merchant: 'EMPRESA_XYZ',
        confidence: 0.91,
      },
    ] as any);

    const conn = await connectBank('nubank', 'u-partial-ai');
    const imported: any[] = [];

    await syncTransactions(conn.id, [], 'u-partial-ai', (txs) => imported.push(...txs));

    expect(imported[0]).toMatchObject({
      amount: 150,
      type: 'Despesa',
      category: 'Pessoal',
      description: 'Amazon ajustado',
      date: '2026-03-10T00:00:00.000Z',
    });
    expect(imported[1]).toMatchObject({
      amount: 5000,
      type: 'Receita',
      category: 'Salario',
      description: 'Salario IA',
      confidence_score: 0.91,
    });
  });

  it('deduplica usando raw.description quando merchant nao existe', async () => {
    vi.mocked(getProvider).mockReturnValue({
      connect: vi.fn().mockResolvedValue({ external_id: 'id_no_merchant' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      fetchAccounts: vi.fn().mockResolvedValue([]),
      fetchTransactions: vi.fn().mockResolvedValue([
        { id: 'tx_no_merchant', date: new Date(Date.now() - 86400000).toISOString(), amount: -80, description: 'Mercado Bairro' },
      ]),
    } as any);

    const conn = await connectBank('nubank', 'u-no-merchant');
    const result = await syncTransactions(conn.id, [
      {
        id: 'existing-merchantless',
        amount: 80,
        description: 'Mercado Bairro',
        type: 'DESPESA',
        category: 'PESSOAL',
        date: new Date(Date.now() - 86400000).toISOString(),
      },
    ] as any, 'u-no-merchant', vi.fn());

    expect(result.transactions_imported).toBe(0);
  });

  it('syncTransactions usa mensagem padrao quando erro nao possui campo message', async () => {
    vi.mocked(getProvider).mockReturnValue({
      connect: vi.fn().mockResolvedValue({ external_id: 'id_no_message' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      fetchAccounts: vi.fn().mockResolvedValue([]),
      fetchTransactions: vi.fn().mockRejectedValue({}),
    } as any);

    const conn = await connectBank('nubank', 'u-error-default');
    const result = await syncTransactions(conn.id, [], 'u-error-default', vi.fn());

    expect(result.error).toBeUndefined();
    expect(getConnection(conn.id)).toMatchObject({
      connection_status: 'error',
      error_message: 'Erro ao sincronizar.',
    });
  });

  it('formatLastSync funciona para casos principais', () => {
    expect(formatLastSync(undefined)).toBe('Nunca');
    expect(formatLastSync(new Date(Date.now() - 30000).toISOString())).toBe('Agora mesmo');
    expect(formatLastSync(new Date(Date.now() - 5 * 60000).toISOString())).toMatch(/5 min atr/);
  });
});
