import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestAuthorizationHeader } from '../helpers/auth';

vi.mock('../../src/middleware/rateLimit', () => ({
  aiLimiterByUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  loadWorkspaceSaasState: vi.fn().mockResolvedValue(null),
  saveWorkspaceSaasState: vi.fn().mockResolvedValue(undefined),
  loadJsonState: vi.fn().mockResolvedValue(null),
  saveJsonState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/admin/auditLog', () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/services/admin/workspaceStore', () => ({
  getWorkspaceAsync: vi.fn(async (workspaceId: string) => ({
    workspaceId,
    tenantId: 'tenant-1',
    name: 'Workspace Test',
    isDefault: true,
    plan: 'free',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    entitlements: {
      features: ['advancedInsights'],
      limits: {
        transactionsPerMonth: 500,
        aiQueriesPerMonth: 100,
        bankConnections: 1,
      },
    },
  })),
  isUserInWorkspaceAsync: vi.fn(async () => true),
  getTenantAsync: vi.fn(async () => ({
    tenantId: 'tenant-1',
    name: 'Tenant Test',
    plan: 'free',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  getUserRoleInWorkspaceAsync: vi.fn(async () => 'viewer'),
  getWorkspace: vi.fn(() => ({ plan: 'free' })),
  getWorkspaceEntitlements: vi.fn(() => ({
    limits: { transactionsPerMonth: 500, aiQueriesPerMonth: 100, bankConnections: 1 },
    features: ['advancedInsights'],
  })),
}));

const generateContentMock = vi.fn(async () => ({
  content: 'Resposta CFO de teste',
  provider: 'gemini' as const,
  model: 'gemini-test',
  inputTokens: 10,
  outputTokens: 5,
  tokensUsed: 15,
  workspaceId: 'ws-1',
  estimatedCostUsd: 0,
  costEvidence: 'test-fixture',
}));

vi.mock('../../src/config/ai', async () => {
  const actual = await vi.importActual<typeof import('../../src/config/ai')>('../../src/config/ai');
  return {
    ...actual,
    generateContent: generateContentMock,
    estimateTokens: vi.fn(async (text: string) => Math.ceil(text.length / 4)),
  };
});

describe('AI routes authz gates (viewer)', () => {
  let app: express.Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';

    const aiRoutesModule = await import('../../src/routes/ai');
    const errorHandlerModule = await import('../../src/middleware/errorHandler');

    app = express();
    app.use(express.json());
    app.use('/api/ai', aiRoutesModule.default);
    app.use(errorHandlerModule.errorHandler);
  }, 30_000);

  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetSaasStoreForTests } = await import('../../src/utils/saasStore');
    resetSaasStoreForTests();
  });

  it('allows viewer to call POST /api/ai/cfo when workspace is authorized', async () => {
    const response = await request(app)
      .post('/api/ai/cfo')
      .set('Authorization', createTestAuthorizationHeader('user-1'))
      .set('x-workspace-id', 'ws-1')
      .send({
        question: 'Posso gastar este mes?',
        context: 'Saldo atual: 2500',
        intent: 'spending_advice',
      });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBe('Resposta CFO de teste');
    expect(generateContentMock).toHaveBeenCalledOnce();
  });

  it('blocks when workspace quota is exhausted (aiQueriesPerMonth=0)', async () => {
    const workspaceStore = await import('../../src/services/admin/workspaceStore');
    const getWorkspaceEntitlementsMock = workspaceStore.getWorkspaceEntitlements as unknown as ReturnType<typeof vi.fn>;
    getWorkspaceEntitlementsMock.mockReturnValue({
      limits: { transactionsPerMonth: 500, aiQueriesPerMonth: 0, bankConnections: 1 },
      features: ['advancedInsights'],
    });

    const response = await request(app)
      .post('/api/ai/cfo')
      .set('Authorization', createTestAuthorizationHeader('user-1'))
      .set('x-workspace-id', 'ws-1')
      .send({ question: 'Posso gastar este mes?' });

    expect(response.status).toBe(429);
    expect(String(response.body.message || '')).toContain('Monthly aiQueries limit reached');
    expect(generateContentMock).not.toHaveBeenCalled();
  });
});
