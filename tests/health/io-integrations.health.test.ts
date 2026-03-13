import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BACKEND_BASE_URL, API_ENDPOINTS, apiRequest } from '../../src/config/api.config';
import { GeminiService } from '../../services/geminiService';
import { getProvider } from '../../services/integrations/mockBankProvider';
import { connectBank, disconnectBank, getConnections } from '../../services/integrations/openBankingService';
import { LocalStorageProvider, ApiStorageProvider } from '../../src/storage/StorageProvider';

describe('IO Health Check - API contracts', () => {
  it('all configured endpoints should be fully qualified and use backend base url', () => {
    const groups = Object.values(API_ENDPOINTS) as Array<Record<string, string>>;
    const endpoints = groups.flatMap((group) => Object.values(group));

    expect(BACKEND_BASE_URL).toMatch(/^https?:\/\//);
    expect(endpoints.length).toBeGreaterThan(0);

    endpoints.forEach((endpoint) => {
      expect(endpoint).toMatch(/^https?:\/\//);
      expect(endpoint.startsWith(BACKEND_BASE_URL)).toBe(true);
    });
  });

  it('apiRequest should retry transient errors and eventually succeed', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest<{ ok: boolean }>('http://localhost:3999/health', {
      retries: 2,
      timeout: 100,
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('apiRequest should avoid retry logs when silent mode is enabled', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Failed to generate insights' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest('http://localhost:3999/ai', {
        method: 'POST',
        retries: 0,
        silent: true,
      })
    ).rejects.toThrow(/API Error 500/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('IO Health Check - AI proxy integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GeminiService should fail-safe when backend is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'Missing or invalid authorization header' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const service = new GeminiService();

    const interpret = await service.processSmartInput('gastei 100 reais no mercado');
    const tokens = await service.countTokens('texto de teste');
    const cfo = await service.generateCFO('Como reduzir gastos?', 'ctx', 'advice');

    expect(interpret.intent).toBe('transaction');
    expect(Array.isArray(interpret.data)).toBe(true);
    expect(tokens).toBe(0);
    expect(cfo.answer).toBe('');
  });

  it('GeminiService should unwrap backend insights payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ insights: [{ title: 'Alerta', description: 'Teste', type: 'alerta' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const service = new GeminiService();
    const result = await service.generateDailyInsights([
      { amount: 10, description: 'mercado', category: 'Pessoal', type: 'Despesa' } as any,
    ]);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Alerta');
  });
});

describe('IO Health Check - Banking provider + orchestrator', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mock bank provider should support full provider contract', async () => {
    const provider = getProvider('mock');
    const conn = await provider.connect('nubank', 'health-user');
    const accounts = await provider.fetchAccounts(conn.external_id);
    const txs = await provider.fetchTransactions(conn.external_id, 30);

    expect(conn.external_id).toContain('mock_');
    expect(accounts.length).toBeGreaterThan(0);
    expect(txs.length).toBeGreaterThan(0);

    await provider.disconnect(conn.external_id);
  });

  it('open banking service should persist and remove connections from local storage', async () => {
    const userId = 'health-user';

    const connection = await connectBank('nubank', userId);
    const afterConnect = getConnections(userId);

    expect(connection.id).toBeTruthy();
    expect(afterConnect.some((c) => c.id === connection.id)).toBe(true);

    await disconnectBank(connection.id);
    const afterDisconnect = getConnections(userId);

    expect(afterDisconnect.some((c) => c.id === connection.id)).toBe(false);
  });
});

describe('IO Health Check - Storage providers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('LocalStorageProvider should persist and retrieve domain data', async () => {
    const provider = new LocalStorageProvider();

    await provider.saveTransaction({
      id: 'tx-health-1',
      userId: 'u-health',
      accountId: 'acc-1',
      amount: 120,
      type: 'expense',
      category: 'food',
      description: 'teste health',
      date: new Date(),
      source: 'manual',
      isGenerated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const list = await provider.getTransactions('u-health');
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('tx-health-1');
  });

  it('ApiStorageProvider should call expected REST endpoint contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      statusText: 'OK',
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const provider = new ApiStorageProvider('https://api.flow-finance.test', 'token-123');

    await provider.saveTransaction({
      id: 'tx-api-1',
      userId: 'u-health',
      accountId: 'acc-1',
      amount: 50,
      type: 'income',
      category: 'salary',
      description: 'salario',
      date: new Date(),
      source: 'import',
      isGenerated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.flow-finance.test/users/u-health/transactions/tx-api-1');
    expect((options as RequestInit).method).toBe('PUT');
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer token-123',
      'Content-Type': 'application/json',
    });
  });
});
