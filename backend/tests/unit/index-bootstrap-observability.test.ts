import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializeWorkspaceStorePersistence: vi.fn(),
  initializeAuditLogPersistence: vi.fn(),
  initializeSaasStorePersistence: vi.fn(),
  initOpenAI: vi.fn(),
  initGemini: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
  loggerDebug: vi.fn(),
}));

vi.mock('../../src/services/admin/workspaceStore', () => ({
  initializeWorkspaceStorePersistence: mocks.initializeWorkspaceStorePersistence,
}));

vi.mock('../../src/services/admin/auditLog', () => ({
  initializeAuditLogPersistence: mocks.initializeAuditLogPersistence,
}));

vi.mock('../../src/utils/saasStore', () => ({
  initializeSaasStorePersistence: mocks.initializeSaasStorePersistence,
}));

vi.mock('../../src/config/openai', () => ({
  initOpenAI: mocks.initOpenAI,
}));

vi.mock('../../src/config/gemini', () => ({
  initGemini: mocks.initGemini,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
    debug: mocks.loggerDebug,
  },
}));

vi.mock('../../src/config/database', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  testConnection: vi.fn().mockResolvedValue(false),
  checkDatabaseHealth: vi.fn().mockResolvedValue(false),
  hasDatabaseConfig: vi.fn().mockReturnValue(false),
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

vi.mock('../../src/config/redis', () => ({
  initRedis: vi.fn().mockResolvedValue(undefined),
  checkRedisHealth: vi.fn().mockResolvedValue(false),
  default: {
    ping: vi.fn().mockResolvedValue('PONG'),
  },
}));

vi.mock('../../src/config/sentry', () => ({
  initSentry: vi.fn(),
  isSentryConfigured: vi.fn().mockReturnValue(false),
  sentryRequestHandler: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  sentryErrorHandler: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('../../src/config/cors', () => ({
  createCorsOptions: vi.fn().mockReturnValue({ origin: true }),
  resolveAllowedOrigins: vi.fn().mockReturnValue(['http://localhost:5173']),
}));

vi.mock('../../src/config/server', () => ({
  resolveTrustProxySetting: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/docs/openapi', () => ({
  buildOpenApiSpec: vi.fn(),
  isApiDocsEnabled: vi.fn().mockReturnValue(false),
  renderSwaggerHtml: vi.fn(),
}));

vi.mock('../../src/routes/authRoutes', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/ai', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/saas', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/banking', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/finance', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/adminRoutes', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/tenantRoutes', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/billingRoutes', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/sync', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/externalIntegration', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/integrationKeys', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/clinicIntegration', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/businessIntegration', () => ({ default: vi.fn() }));
vi.mock('../../src/routes/workspace', () => ({ default: vi.fn() }));
vi.mock('../../src/middleware/featureGate', () => ({ featureGateOpenFinance: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()) }));
vi.mock('../../src/middleware/requestContext', () => ({ requestContextMiddleware: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()) }));
vi.mock('../../src/middleware/jsonValidation', () => ({ validateJsonMiddleware: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()) }));
vi.mock('../../src/middleware/rateLimit', () => ({ apiLimiter: vi.fn() }));
vi.mock('../../src/middleware/errorHandler', () => ({ errorHandler: vi.fn() }));
vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  initializePostgresStateStore: vi.fn().mockResolvedValue(false),
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

describe('backend bootstrap observability', () => {
  const originalEnv = {
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
    VITEST: process.env.VITEST,
  };

  beforeEach(() => {
    vi.resetModules();
    mocks.initializeWorkspaceStorePersistence.mockReset();
    mocks.initializeAuditLogPersistence.mockReset();
    mocks.initializeSaasStorePersistence.mockReset();
    mocks.initOpenAI.mockReset();
    mocks.initGemini.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.loggerInfo.mockReset();
    mocks.loggerDebug.mockReset();

    process.env.VERCEL = '1';
    process.env.NODE_ENV = 'test';
    process.env.VITEST = 'true';
    mocks.initializeWorkspaceStorePersistence.mockRejectedValueOnce(new Error('workspace init failed'));
    mocks.initializeAuditLogPersistence.mockResolvedValue(undefined);
    mocks.initializeSaasStorePersistence.mockResolvedValue(undefined);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('registra contexto quando o cold start serverless falha ao inicializar persistencia', async () => {
    await import('../../src/index');
    await vi.waitFor(() => {
      expect(mocks.loggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          initializationTasks: ['workspaceStore', 'auditLog', 'saasStore'],
          vercel: '1',
          nodeEnv: 'test',
          fallback: 'serverless-cold-start-persistence-init-failed',
        }),
        'Failed to initialize persistence on serverless cold start',
      );
    });
  });

  it('registra contexto quando initOpenAI e initGemini falham', async () => {
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    mocks.initializeWorkspaceStorePersistence.mockResolvedValue(undefined);
    mocks.initializeAuditLogPersistence.mockResolvedValue(undefined);
    mocks.initializeSaasStorePersistence.mockResolvedValue(undefined);
    mocks.initOpenAI.mockImplementation(() => {
      throw new Error('openai init failed');
    });
    mocks.initGemini.mockImplementation(() => {
      throw new Error('gemini init failed');
    });

    await import('../../src/index');

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        provider: 'OpenAI',
        hasApiKey: true,
        fallback: 'openai-init-failed',
      }),
      'Failed to initialize OpenAI',
    );

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        provider: 'Gemini',
        hasApiKey: true,
        fallback: 'gemini-init-failed',
      }),
      'Failed to initialize Gemini',
    );
  });
});
