import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function importService(options?: {
  mode?: 'test' | 'production';
  connectEndpoint?: string;
  apiError?: unknown;
  enableLocalFallback?: boolean;
}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('MODE', options?.mode || 'test');
  vi.stubEnv('VITE_ENABLE_LOCAL_BANKING_FALLBACK', options?.enableLocalFallback ? 'true' : '');

  const apiRequestMock = vi.fn();
  if (options?.apiError) {
    apiRequestMock.mockRejectedValue(options.apiError);
  }

  vi.doMock('../../services/integrations/mockBankProvider', () => ({
    getProvider: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue({ external_id: 'mock_ext_id' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      fetchAccounts: vi.fn().mockResolvedValue([]),
      fetchTransactions: vi.fn().mockResolvedValue([]),
    })),
  }));

  vi.doMock('../../src/ai/aiMemory', () => ({
    learnMemory: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock('../../src/finance/importService', () => ({
    classifyImportedTransactions: vi.fn().mockResolvedValue([]),
  }));

  vi.doMock('../../src/events/eventEngine', () => ({
    FinancialEventEmitter: {
      bankTransactionsSynced: vi.fn(),
    },
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
  };
}

describe('openBankingService critical branches', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
