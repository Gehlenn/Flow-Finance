import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { logWarnMock, logErrorMock } = vi.hoisted(() => ({
  logWarnMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

async function importService(options?: {
  mode?: 'test' | 'production';
  connectEndpoint?: string;
  apiError?: unknown;
  enableLocalFallback?: boolean;
  localFallbackEnv?: string;
  providerDisconnectError?: Error;
  providerFetchAccountsError?: Error;
  providerFetchTransactionsError?: unknown;
  providerFetchTransactionsResult?: unknown[];
  classificationError?: unknown;
}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('MODE', options?.mode || 'test');
  vi.stubEnv('VITE_ENABLE_LOCAL_BANKING_FALLBACK', options?.localFallbackEnv ?? (options?.enableLocalFallback ? 'true' : ''));

  const apiRequestMock = vi.fn();
  if (options?.apiError) {
    apiRequestMock.mockRejectedValue(options.apiError);
  }

  const providerMock = {
    connect: vi.fn().mockResolvedValue({ external_id: 'mock_ext_id' }),
    disconnect: options?.providerDisconnectError
      ? vi.fn().mockRejectedValue(options.providerDisconnectError)
      : vi.fn().mockResolvedValue(undefined),
    fetchAccounts: options?.providerFetchAccountsError
      ? vi.fn().mockRejectedValue(options.providerFetchAccountsError)
      : vi.fn().mockResolvedValue([]),
    fetchTransactions: options?.providerFetchTransactionsError
      ? vi.fn().mockRejectedValue(options.providerFetchTransactionsError)
      : vi.fn().mockResolvedValue(options?.providerFetchTransactionsResult ?? []),
  };

  vi.doMock('../../services/integrations/mockBankProvider', () => ({
    getProvider: vi.fn(() => providerMock),
  }));

  vi.doMock('../../src/ai/aiMemory', () => ({
    learnMemory: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock('../../src/finance/importService', () => ({
    classifyImportedTransactions: options?.classificationError
      ? vi.fn().mockRejectedValue(options.classificationError)
      : vi.fn().mockResolvedValue([]),
  }));

  vi.doMock('../../src/events/eventEngine', () => ({
    FinancialEventEmitter: {
      bankTransactionsSynced: vi.fn(),
    },
  }));

  vi.doMock('../../src/utils/logger', () => ({
    logWarn: logWarnMock,
    logError: logErrorMock,
  }));

  vi.doMock('../../src/config/api.config', async () => {
    const actual = await vi.importActual('../../src/config/api.config');
    return {
      ...(actual as object),
      apiRequest: (...args: unknown[]) => apiRequestMock(...args),
      API_ENDPOINTS: {
        BANKING: {
          HEALTH: '/api/banking/health',
          CONNECTIONS: '/api/banking/connections',
          CONNECT_TOKEN: '/api/banking/connect-token',
          CONNECT: options?.connectEndpoint ?? '/api/banking/connect',
          SYNC: '/api/banking/sync',
          DISCONNECT: '/api/banking/disconnect',
          CONNECTORS: '/api/banking/connectors',
        },
      },
    };
  });

  const service = await import('../../services/integrations/openBankingService');
  const apiConfig = await import('../../src/config/api.config');

  return {
    service,
    ApiRequestError: apiConfig.ApiRequestError,
    apiRequestMock,
    providerMock,
  };
}

describe('openBankingService critical branches', () => {
  beforeEach(() => {
    localStorage.clear();
    logWarnMock.mockReset();
    logErrorMock.mockReset();
  });

  afterEach(() => {
    vi.doUnmock('../../services/integrations/mockBankProvider');
    vi.doUnmock('../../src/ai/aiMemory');
    vi.doUnmock('../../src/finance/importService');
    vi.doUnmock('../../src/events/eventEngine');
    vi.doUnmock('../../src/config/api.config');
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('tolera JSON invalido no storage scoped de conexoes', async () => {
    const { service } = await importService();
    const { getWorkspaceScopedStorageKey } = await import('../../src/utils/workspaceStorage');

    localStorage.setItem(getWorkspaceScopedStorageKey('flow_bank_connections'), '{broken');

    expect(service.getConnections('user-broken')).toEqual([]);
  });

  it('nao faz fallback local em producao quando recebe ApiRequestError do backend', async () => {
    const { ApiRequestError } = await import('../../src/config/api.config');
    const { service } = await importService({
      mode: 'production',
      apiError: new ApiRequestError({
        statusCode: 500,
        message: 'API Error 500: backend down',
      }),
    });

    await expect(service.connectBank('nubank', 'user-prod')).rejects.toThrow(/500/);
    expect(service.getConnections('user-prod')).toEqual([]);
  });

  it('registra aviso quando a classificacao por IA falha e segue com mapeamento basico', async () => {
    const { service } = await importService({
      providerFetchTransactionsResult: [
        {
          id: 'tx-1',
          date: new Date().toISOString(),
          amount: -42.5,
          description: 'Lanche',
          merchant: 'Cafe',
        },
      ],
      classificationError: new Error('classification failed'),
    });

    const connection = await service.connectBank('nubank', 'user-sync');
    const result = await service.syncTransactions(
      connection.id,
      [],
      'user-sync',
      vi.fn(),
      30,
    );

    expect(result.transactions_imported).toBeGreaterThanOrEqual(0);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[OpenBanking] AI classification failed during sync; using basic mapping fallback',
      expect.objectContaining({
        connectionId: connection.id,
        userId: 'user-sync',
        error: expect.any(Error),
        fallback: 'open-banking-ai-classification-failed',
      }),
    );
  });

  it('nao faz fallback quando erro e instancia real de ApiRequestError em producao', async () => {
    const { service, ApiRequestError, apiRequestMock } = await importService({ mode: 'production' });

    apiRequestMock.mockRejectedValueOnce(new ApiRequestError({
      statusCode: 503,
      message: 'API Error 503: unavailable',
    }));

    await expect(service.connectBank('nubank', 'user-prod-instance')).rejects.toThrow(/503/);
    expect(service.getConnections('user-prod-instance')).toEqual([]);
  });

  it('nao mascara erro 5xx em producao mesmo com fallback local habilitado', async () => {
    const { service } = await importService({
      mode: 'production',
      enableLocalFallback: true,
      apiError: { statusCode: 500, message: 'API Error 500: backend down' },
    });

    await expect(service.connectBank('nubank', 'user-prod-no-fallback')).rejects.toThrow(/500/);
    expect(service.getConnections('user-prod-no-fallback')).toEqual([]);
  });

  it('falha explicitamente quando backend e fallback local estao indisponiveis', async () => {
    const { service } = await importService({
      mode: 'production',
      connectEndpoint: '',
    });

    await expect(service.connectBank('nubank', 'user-no-backend')).rejects.toThrow(/backend indisponivel/i);
  });

  it('faz fallback local em desenvolvimento quando backend retorna erro 5xx', async () => {
    const { service } = await importService({
      mode: 'development',
      enableLocalFallback: true,
      apiError: { statusCode: 503, message: 'API Error 503: unavailable' },
    });

    const connection = await service.connectBank('nubank', 'user-dev-fallback');

    expect(connection.user_id).toBe('user-dev-fallback');
    expect(connection.provider).toBe('mock');
    expect(service.getConnections('user-dev-fallback')).toHaveLength(1);
  });

  it('nao faz fallback local em desenvolvimento quando backend retorna erro 4xx', async () => {
    const { service } = await importService({
      mode: 'development',
      enableLocalFallback: true,
      apiError: { message: 'API Error 422: invalid payload' },
    });

    await expect(service.connectBank('nubank', 'user-dev-client-error')).rejects.toThrow(/422/);
    expect(service.getConnections('user-dev-client-error')).toEqual([]);
  });

  it('retorna lista vazia quando fallback local e desativado explicitamente', async () => {
    const { service } = await importService({
      mode: 'test',
      localFallbackEnv: 'false',
    });

    expect(await service.reloadConnections('user-no-fallback')).toEqual([]);
  });

  it('registra aviso quando recarregar conexoes falha e retorna cache local', async () => {
    const { service, apiRequestMock } = await importService({
      mode: 'development',
      enableLocalFallback: true,
      apiError: new Error('backend reload failed'),
    });

    await service.connectBank('nubank', 'user-local-cache');
    apiRequestMock.mockRejectedValueOnce(new Error('reload failed'));

    const connections = await service.reloadConnections('user-local-cache');

    expect(connections).toHaveLength(1);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[OpenBanking] Failed to reload connections from backend; returning local cache',
      expect.objectContaining({
        userId: 'user-local-cache',
        error: expect.any(Error),
        fallback: 'open-banking-reload-connections-failed',
      }),
    );
  });

  it('nao faz fallback local em producao quando sync do backend retorna erro 5xx', async () => {
    const { service, apiRequestMock } = await importService({
      mode: 'production',
    });

    apiRequestMock.mockResolvedValueOnce({
      id: 'backend-sync-conn',
      user_id: 'user-prod-sync',
      bank_name: 'Nubank',
      bank_logo: 'N',
      bank_color: '#8A05BE',
      provider: 'mock',
      connection_status: 'connected',
      external_account_id: 'ext-sync',
      created_at: new Date().toISOString(),
    });
    const connection = await service.connectBank('nubank', 'user-prod-sync');
    apiRequestMock.mockRejectedValueOnce({ statusCode: 500, message: 'API Error 500: backend sync down' });

    const result = await service.syncTransactions(connection.id, [], 'user-prod-sync', vi.fn());

    expect(result.error).toMatch(/Conex.{0,6}o local de teste removida/i);
    expect(service.getConnection(connection.id)).toBeNull();
  });

  it('usa a mensagem padrao quando sync do backend falha sem texto explicito', async () => {
    const { service, apiRequestMock } = await importService({
      mode: 'production',
    });

    apiRequestMock.mockResolvedValueOnce({
      id: 'backend-sync-empty',
      user_id: 'user-prod-sync-empty',
      bank_name: 'Nubank',
      bank_logo: 'N',
      bank_color: '#8A05BE',
      provider: 'pluggy',
      connection_status: 'connected',
      external_account_id: 'ext-sync-empty',
      created_at: new Date().toISOString(),
    });
    const connection = await service.connectBank('nubank', 'user-prod-sync-empty');
    apiRequestMock.mockRejectedValueOnce({});

    const result = await service.syncTransactions(connection.id, [], 'user-prod-sync-empty', vi.fn());

    expect(result.error).toBe('Erro ao sincronizar com o backend.');
    expect(service.getConnection(connection.id)).toMatchObject({
      connection_status: 'error',
      error_message: 'Erro ao sincronizar com o backend.',
    });
  });

  it('mapeia erro Pluggy de credencial trial com requestId', async () => {
    const { service } = await importService();

    const message = service.mapPluggyConnectErrorMessage({
      code: 'trial_client_item_create_not_allowed',
      requestId: 'req-123',
    });

    expect(message).toMatch(/modo de teste/i);
    expect(message).toMatch(/requestId: req-123/);
  });

  it('mapeia erro Pluggy de token invalido', async () => {
    const { service } = await importService();

    const message = service.mapPluggyConnectErrorMessage({
      message: 'invalid_connect_token',
    });

    expect(message).toMatch(/token de conexao/i);
  });

  it('registra diagnostico quando provider falha ao desconectar', async () => {
    const { service, providerMock } = await importService({
      providerDisconnectError: new Error('provider disconnect down'),
    });

    const connection = await service.connectBank('nubank', 'user-disconnect-diag');
    await service.disconnectBank(connection.id);

    expect(providerMock.disconnect).toHaveBeenCalledWith('mock_ext_id');
    expect(service.getConnections('user-disconnect-diag')).toEqual([]);
    expect(logWarnMock).toHaveBeenCalledWith('[OpenBanking] Operation failed', expect.objectContaining({
      operation: 'provider_disconnect',
      connectionId: connection.id,
      message: 'provider disconnect down',
    }));

  });

  it('registra diagnostico quando o backend falha ao desconectar', async () => {
    const { service, apiRequestMock, providerMock } = await importService({
      mode: 'development',
    });

    apiRequestMock.mockResolvedValueOnce({
      id: 'backend-conn',
      user_id: 'user-backend-disconnect',
      bank_name: 'Nubank',
      bank_logo: 'N',
      bank_color: '#8A05BE',
      provider: 'mock',
      connection_status: 'connected',
      external_account_id: 'ext-backend',
      created_at: new Date().toISOString(),
    });

    const connection = await service.connectBank('nubank', 'user-backend-disconnect');
    apiRequestMock.mockRejectedValueOnce(new Error('backend disconnect down'));
    await service.disconnectBank(connection.id);

    expect(providerMock.disconnect).toHaveBeenCalledWith('ext-backend');
    expect(logWarnMock).toHaveBeenCalledWith('[OpenBanking] Operation failed', expect.objectContaining({
      operation: 'backend_disconnect',
      connectionId: connection.id,
      message: 'backend disconnect down',
    }));

  });

  it('preserva outras conexoes ao atualizar status de erro local', async () => {
    const { service } = await importService({
      providerFetchTransactionsError: { message: ' provider down ', requestId: 'req-local-sync' },
    });

    const first = await service.connectBank('nubank', 'user-update-status');
    const second = await service.connectBank('inter', 'user-update-status');
    const result = await service.syncTransactions(first.id, [], 'user-update-status', vi.fn());

    expect(result.error).toBe('provider down (requestId: req-local-sync)');
    expect(service.getConnection(first.id)).toMatchObject({
      connection_status: 'error',
      error_message: 'provider down (requestId: req-local-sync)',
    });
    expect(service.getConnection(second.id)).toMatchObject({
      connection_status: 'connected',
    });
    expect(logWarnMock).toHaveBeenCalledWith('[OpenBanking] Operation failed', expect.objectContaining({
      operation: 'local_sync_transactions',
      connectionId: first.id,
      requestId: 'req-local-sync',
      message: 'provider down',
    }));

  });

  it('mapeia erro Pluggy vazio para mensagem generica', async () => {
    const { service } = await importService();

    expect(service.mapPluggyConnectErrorMessage(null)).toMatch(/cancelada ou invalida/i);
  });

  it('registra diagnostico e continua fullSync quando sync de contas falha', async () => {
    const { service } = await importService({
      providerFetchAccountsError: new Error('accounts unavailable'),
    });

    const connection = await service.connectBank('nubank', 'user-full-sync-diag');
    const result = await service.fullSync(
      connection.id,
      [],
      [],
      'user-full-sync-diag',
      vi.fn(),
      vi.fn(),
    );

    expect(result.transactions_imported).toBe(0);
    expect(result.error).toBeUndefined();
    expect(logWarnMock).toHaveBeenCalledWith('[OpenBanking] Operation failed', expect.objectContaining({
      operation: 'full_sync_accounts_step',
      connectionId: connection.id,
      message: 'accounts unavailable',
    }));

  });

  it('interpreta last_sync date-only como data local e rejeita lixo', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T03:00:00.000Z'));

    const { service } = await importService();

    const parsed = service.parseLastSyncDate('2026-04-10');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(3);
    expect(parsed?.getDate()).toBe(10);
    expect(parsed?.getHours()).toBe(0);
    expect(service.formatLastSync('2026-04-10')).toBe('Agora mesmo');
    expect(service.formatLastSync('not-a-date')).toBe('Nunca');

    vi.useRealTimers();
  });
});





