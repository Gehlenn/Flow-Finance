import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const checkDatabaseHealthMock = vi.fn();
const hasDatabaseConfigMock = vi.fn();
const initializePostgresStateStoreMock = vi.fn();
const isPostgresStateStoreEnabledMock = vi.fn();

vi.mock('../../src/config/database', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  testConnection: vi.fn().mockResolvedValue(false),
  checkDatabaseHealth: (...args: unknown[]) => checkDatabaseHealthMock(...args),
  hasDatabaseConfig: (...args: unknown[]) => hasDatabaseConfigMock(...args),
  closePool: vi.fn().mockResolvedValue(undefined),
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  },
  default: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  },
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  isPostgresStateStoreEnabled: (...args: unknown[]) => isPostgresStateStoreEnabledMock(...args),
  initializePostgresStateStore: (...args: unknown[]) => initializePostgresStateStoreMock(...args),
  saveWorkspaceStoreState: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceStoreState: vi.fn().mockResolvedValue(null),
  saveWorkspaceSaasState: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceSaasState: vi.fn().mockResolvedValue(null),
  saveJsonState: vi.fn().mockResolvedValue(undefined),
  loadJsonState: vi.fn().mockResolvedValue(null),
  insertAuditEvent: vi.fn().mockResolvedValue(undefined),
  loadRecentAuditEvents: vi.fn().mockResolvedValue([]),
  queryAuditEvents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  queryWorkspaceMeteringSummary: vi.fn().mockResolvedValue(null),
  queryWorkspaceUsageEvents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  queryWorkspaceById: vi.fn().mockResolvedValue(null),
  queryWorkspacesForUser: vi.fn().mockResolvedValue([]),
  queryWorkspaceUsers: vi.fn().mockResolvedValue([]),
  queryLastWorkspaceForUser: vi.fn().mockResolvedValue(null),
  queryWorkspaceByBillingCustomerId: vi.fn().mockResolvedValue(null),
  queryTenantById: vi.fn().mockResolvedValue(null),
  queryTenantsForUser: vi.fn().mockResolvedValue([]),
  queryDomainEvents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  insertDomainEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/openFinance/providerMode', () => ({
  isSupportedOpenFinanceProvider: () => true,
  isPluggyProviderEnabled: () => false,
}));

vi.mock('../../src/config/openai', () => ({
  initOpenAI: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/config/gemini', () => ({
  initGemini: vi.fn().mockResolvedValue(true),
}));

let app: Express;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalGeminiApiKey = process.env.GEMINI_API_KEY;
const originalVercel = process.env.VERCEL;

describe('Health endpoints', () => {
  beforeAll(async () => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.OPEN_FINANCE_PROVIDER = 'mock';
    process.env.OPEN_FINANCE_STORE_DRIVER = 'memory';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    process.env.FEATURE_OPEN_FINANCE = 'true';
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    isPostgresStateStoreEnabledMock.mockReturnValue(false);
    initializePostgresStateStoreMock.mockResolvedValue(false);
    ({ default: app } = await import('../../src/index'));
  }, 60_000);

  afterAll(() => {
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }

    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }

    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }
  });

  beforeEach(() => {
    hasDatabaseConfigMock.mockReset();
    checkDatabaseHealthMock.mockReset();
    isPostgresStateStoreEnabledMock.mockReset();
    initializePostgresStateStoreMock.mockReset();
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    delete process.env.VERCEL;
    isPostgresStateStoreEnabledMock.mockReturnValue(false);
    initializePostgresStateStoreMock.mockResolvedValue(false);
  });

  it('GET /health returns 200 when database is not configured', async () => {
    hasDatabaseConfigMock.mockReturnValue(false);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.requestId).toBeTruthy();
    expect(res.body.routeScope).toBe('public');
    expect(res.body.checks.database).toEqual({ status: 'healthy', configured: false, required: false });
    expect(res.body.checks.workspacePersistence).toEqual({
      status: 'healthy',
      configured: false,
      required: false,
      durable: false,
      mode: 'memory',
      reason: 'no-durable-store-configured',
    });
    expect(res.body.checks.aiProviders).toEqual({ status: 'healthy', configured: false, required: false });
    expect(res.body.checks.observability).toEqual({ status: 'healthy', configured: false, required: false });
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('GET /health returns 503 when database is configured but unhealthy', async () => {
    hasDatabaseConfigMock.mockReturnValue(true);
    checkDatabaseHealthMock.mockResolvedValue(false);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database.status).toBe('unhealthy');
    expect(res.body.checks.database.configured).toBe(true);
    expect(res.body.checks.database.required).toBe(true);
  });

  it('GET /health returns 503 when durable workspace persistence is required but unavailable', async () => {
    hasDatabaseConfigMock.mockReturnValue(false);
    process.env.VERCEL = '1';
    process.env.POSTGRES_STATE_STORE_ENABLED = 'true';
    isPostgresStateStoreEnabledMock.mockReturnValue(true);
    initializePostgresStateStoreMock.mockResolvedValue(false);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.workspacePersistence).toEqual({
      status: 'unhealthy',
      configured: false,
      required: true,
      durable: false,
      mode: 'memory',
      reason: 'no-durable-store-configured',
    });
  });

  it('GET /api/health exposes workspace persistence details for probes', async () => {
    hasDatabaseConfigMock.mockReturnValue(false);
    process.env.VERCEL = '1';
    process.env.POSTGRES_STATE_STORE_ENABLED = 'true';
    isPostgresStateStoreEnabledMock.mockReturnValue(true);
    initializePostgresStateStoreMock.mockResolvedValue(false);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.workspacePersistence).toEqual({
      status: 'unhealthy',
      configured: false,
      required: true,
      durable: false,
      mode: 'memory',
      reason: 'no-durable-store-configured',
    });
  });

  it('GET /api/version exposes workspace persistence details for release probes', async () => {
    hasDatabaseConfigMock.mockReturnValue(false);
    process.env.VERCEL = '1';
    process.env.POSTGRES_STATE_STORE_ENABLED = 'true';
    isPostgresStateStoreEnabledMock.mockReturnValue(true);
    initializePostgresStateStoreMock.mockResolvedValue(false);

    const res = await request(app).get('/api/version');

    expect(res.status).toBe(200);
    expect(res.body.workspacePersistence).toEqual({
      status: 'unhealthy',
      configured: false,
      required: true,
      durable: false,
      mode: 'memory',
      reason: 'no-durable-store-configured',
    });
  });
});
