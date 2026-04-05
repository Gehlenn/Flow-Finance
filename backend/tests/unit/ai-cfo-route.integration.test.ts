import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/admin/workspaceStore', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/admin/workspaceStore')>('../../src/services/admin/workspaceStore');

  return {
    ...actual,
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
    getUserRoleInWorkspaceAsync: vi.fn(async () => 'member'),
  };
});

const generateContentMock = vi.fn(async () => 'Resposta CFO de teste');

vi.mock('../../src/config/ai', async () => {
  const actual = await vi.importActual<typeof import('../../src/config/ai')>('../../src/config/ai');
  return {
    ...actual,
    generateContent: generateContentMock,
    estimateTokens: vi.fn(async (text: string) => Math.ceil(text.length / 4)),
  };
});

describe('AI CFO route integration', () => {
  let app: express.Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const aiRoutesModule = await import('../../src/routes/ai');
    const errorHandlerModule = await import('../../src/middleware/errorHandler');

    app = express();
    app.use(express.json());
    app.use('/api/ai', aiRoutesModule.default);
    app.use(errorHandlerModule.errorHandler);
  });

  it('returns 401 when auth header is missing', async () => {
    const response = await request(app)
      .post('/api/ai/cfo')
      .set('x-workspace-id', 'ws-1')
      .send({ question: 'Posso gastar este mes?' });

    expect(response.status).toBe(401);
  });

  it('returns 400 when workspace header is missing', async () => {
    const response = await request(app)
      .post('/api/ai/cfo')
      .set('Authorization', 'Bearer mock-token-for-user-1')
      .send({ question: 'Posso gastar este mes?' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('WorkspaceId obrigatorio');
  });

  it('returns 400 when CFO intent is invalid', async () => {
    const response = await request(app)
      .post('/api/ai/cfo')
      .set('Authorization', 'Bearer mock-token-for-user-1')
      .set('x-workspace-id', 'ws-1')
      .send({
        question: 'Qual meu saldo?',
        intent: 'intent_invalida',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request');
  });

  it('returns CFO answer when auth/workspace/payload are valid', async () => {
    const response = await request(app)
      .post('/api/ai/cfo')
      .set('Authorization', 'Bearer mock-token-for-user-1')
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
});
