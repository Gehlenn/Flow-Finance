import fs from 'fs';
import path from 'path';
import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, vi } from 'vitest';
import { createTestAuthorizationHeader } from '../helpers/auth';
import {
  getBillingHooksForWorkspace,
  recordWorkspaceUsage,
  resetSaasStoreForTests,
  setWorkspaceUsage,
} from '../../src/utils/saasStore';
import { resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';

const usageAuthorityMocks = vi.hoisted(() => ({
  getAuthoritativeWorkspaceUsage: vi.fn().mockResolvedValue(null),
  isFirestoreAiUsageAuthorityEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/services/usage/workspaceUsageAuthority', () => ({
  getAuthoritativeWorkspaceUsage: usageAuthorityMocks.getAuthoritativeWorkspaceUsage,
  isFirestoreAiUsageAuthorityEnabled: usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled,
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

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  isPostgresStateStoreEnabled: vi.fn().mockReturnValue(false),
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

vi.mock('../../src/services/openFinance/providerMode', () => ({
  isSupportedOpenFinanceProvider: () => true,
  isPluggyProviderEnabled: () => false,
}));

let app: Express;
const workspaceStoreFile = path.resolve(process.cwd(), '.tmp', 'saas-integration-workspace-store.json');
const saasStoreFile = path.resolve(process.cwd(), '.tmp', 'saas-integration-saas-store.json');

describe('SaaS API workspace scope', () => {
  beforeAll(async () => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.OPEN_FINANCE_PROVIDER = 'mock';
    process.env.OPEN_FINANCE_STORE_DRIVER = 'memory';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    process.env.FEATURE_OPEN_FINANCE = 'true';
    process.env.VERCEL = '';
    process.env.WORKSPACE_STORE_FILE = workspaceStoreFile;
    process.env.SAAS_STORE_FILE = saasStoreFile;
    fs.mkdirSync(path.dirname(workspaceStoreFile), { recursive: true });
    fs.rmSync(workspaceStoreFile, { force: true });
    fs.rmSync(saasStoreFile, { force: true });
    ({ default: app } = await import('../../src/index'));
  });

  beforeEach(() => {
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.OPEN_FINANCE_PROVIDER = 'mock';
    process.env.OPEN_FINANCE_STORE_DRIVER = 'memory';
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    process.env.FEATURE_OPEN_FINANCE = 'true';
    process.env.VERCEL = '';
    process.env.WORKSPACE_STORE_FILE = workspaceStoreFile;
    process.env.SAAS_STORE_FILE = saasStoreFile;
    usageAuthorityMocks.getAuthoritativeWorkspaceUsage.mockReset();
    usageAuthorityMocks.getAuthoritativeWorkspaceUsage.mockResolvedValue(null);
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReset();
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(false);
    resetSaasStoreForTests();
    resetWorkspaceStoreForTests();
  });

  it('GET /api/saas/plans returns workspace-scoped catalog when workspace context is provided', async () => {
    const ownerUserId = 'owner-saas-plans';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Workspace Plans' });

    const res = await request(app)
      .get('/api/saas/plans')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('workspace');
    expect(res.body.workspaceId).toBe(created.body.workspaceId);
    expect(res.body.currentPlan).toBe('free');
    expect(res.body.mockBillingEnabled).toBe(true);
    expect(res.body.manualPlanChangeAllowed).toBe(true);
    expect(res.body.billingProvider).toBe('mock');
    expect(res.body.stripeConfigured).toBe(false);
    expect(res.body.stripePortalEnabled).toBe(false);
    expect(res.body.hasBillingCustomer).toBe(false);
  });

  it('POST /api/saas/plan upgrades the workspace plan while usage remains read-only to browsers', async () => {
    const ownerUserId = 'owner-saas-upgrade';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Workspace Upgrade' });

    const upgrade = await request(app)
      .post('/api/saas/plan')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId)
      .send({ plan: 'pro' });

    expect(upgrade.status).toBe(200);
    expect(upgrade.body.scope).toBe('workspace');
    expect(upgrade.body.currentPlan).toBe('pro');

    await setWorkspaceUsage(created.body.workspaceId, {
      '2026-03': {
        transactions: 12,
        aiQueries: 8,
        bankConnections: 2,
      },
    });

    const usageWrite = await request(app)
      .put('/api/saas/usage')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId)
      .send({ usage: {} });

    expect(usageWrite.status).toBe(404);

    const usageIncrement = await request(app)
      .post('/api/saas/usage/increment')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId)
      .send({ resource: 'aiQueries' });
    const usageReset = await request(app)
      .post('/api/saas/usage/reset')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId)
      .send({});

    expect(usageIncrement.status).toBe(404);
    expect(usageReset.status).toBe(404);

    const usageRead = await request(app)
      .get('/api/saas/usage')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId);

    expect(usageRead.status).toBe(200);
    expect(usageRead.body.scope).toBe('workspace');
    expect(usageRead.body.usage['2026-03']).toEqual({
      transactions: 12,
      aiQueries: 8,
      bankConnections: 2,
    });
  });

  it('GET /api/saas/usage returns the authoritative Firestore month snapshot when available', async () => {
    const ownerUserId = 'owner-saas-authoritative-usage';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Workspace Authoritative Usage' });

    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    await setWorkspaceUsage(created.body.workspaceId, {
      '2026-07': {
        transactions: 9,
        aiQueries: 99,
        bankConnections: 2,
      },
    });
    usageAuthorityMocks.getAuthoritativeWorkspaceUsage.mockResolvedValueOnce({
      workspaceId: created.body.workspaceId,
      monthKey: '2026-07',
      plan: 'pro',
      usage: {
        transactions: 7,
        aiQueries: 3,
        bankConnections: 1,
      },
    });

    const response = await request(app)
      .get('/api/saas/usage')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      scope: 'workspace',
      workspaceId: created.body.workspaceId,
      currentMonthKey: '2026-07',
      plan: 'pro',
      usage: {
        '2026-07': {
          transactions: 9,
          aiQueries: 3,
          bankConnections: 2,
        },
      },
    });
  });

  it('GET /api/saas/usage fails closed in production when Firestore is unavailable', async () => {
    const previousNodeEnv = process.env.NODE_ENV;

    try {
      const ownerUserId = 'owner-saas-usage-unavailable';
      const created = await request(app)
        .post('/api/tenant')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .send({ name: 'Workspace Usage Unavailable' });

      process.env.NODE_ENV = 'production';
      usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);

      const response = await request(app)
        .get('/api/saas/usage')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .set('x-workspace-id', created.body.workspaceId);

      expect(response.status).toBe(503);
      expect(response.body.message).toBe('Workspace usage authority is unavailable');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('GET /api/saas/usage fails closed on Vercel when Firestore is unavailable', async () => {
    const previousVercel = process.env.VERCEL;

    try {
      const ownerUserId = 'owner-saas-usage-vercel';
      const created = await request(app)
        .post('/api/tenant')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .send({ name: 'Workspace Usage Vercel' });

      process.env.VERCEL = '1';
      usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);

      const response = await request(app)
        .get('/api/saas/usage')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .set('x-workspace-id', created.body.workspaceId);

      expect(response.status).toBe(503);
      expect(response.body.message).toBe('Workspace usage authority is unavailable');
    } finally {
      if (previousVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = previousVercel;
      }
    }
  });

  it('POST /api/saas/billing-hooks rejects production mock events before persistence', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAllowMockBillingUpdates = process.env.ALLOW_MOCK_BILLING_UPDATES;

    try {
      const ownerUserId = 'owner-saas-production-hook';
      const created = await request(app)
        .post('/api/tenant')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .send({ name: 'Workspace Production Hook' });

      process.env.NODE_ENV = 'production';
      process.env.ALLOW_MOCK_BILLING_UPDATES = 'true';

      const response = await request(app)
        .post('/api/saas/billing-hooks')
        .set('Authorization', createTestAuthorizationHeader(ownerUserId))
        .set('x-workspace-id', created.body.workspaceId)
        .send({
          plan: 'pro',
          event: 'plan_changed',
          amount: 0,
          at: '2026-07-29T12:00:00.000Z',
        });

      expect(response.status).toBe(403);
      expect(getBillingHooksForWorkspace(created.body.workspaceId)).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousAllowMockBillingUpdates === undefined) {
        delete process.env.ALLOW_MOCK_BILLING_UPDATES;
      } else {
        process.env.ALLOW_MOCK_BILLING_UPDATES = previousAllowMockBillingUpdates;
      }
    }
  });

  it('GET /api/saas/billing-hooks returns the server-side workspace history', async () => {
    const ownerUserId = 'owner-saas-hook-history';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Workspace Hook History' });

    const recorded = await request(app)
      .post('/api/saas/billing-hooks')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId)
      .send({
        plan: 'pro',
        event: 'plan_changed',
        amount: 0,
        at: '2026-07-29T12:00:00.000Z',
      });
    expect(recorded.status).toBe(200);

    const response = await request(app)
      .get('/api/saas/billing-hooks')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      scope: 'workspace',
      workspaceId: created.body.workspaceId,
      hooks: [{
        tenantId: created.body.tenantId,
        workspaceId: created.body.workspaceId,
        plan: 'pro',
        event: 'plan_changed',
        createdAt: '2026-07-29T12:00:00.000Z',
      }],
    });
  });

  it('GET /api/saas/metering returns workspace-scoped usage summary and events', async () => {
    const ownerUserId = 'owner-saas-metering';
    const created = await request(app)
      .post('/api/tenant')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .send({ name: 'Workspace Metering' });

    await recordWorkspaceUsage(created.body.workspaceId, {
      resource: 'aiQueries',
      amount: 1,
      metadata: {
        aiUsage: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          tokensUsed: 2_000_000,
        },
      },
    });

    const res = await request(app)
      .get('/api/saas/metering?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z')
      .set('Authorization', createTestAuthorizationHeader(ownerUserId))
      .set('x-workspace-id', created.body.workspaceId);

    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('workspace');
    expect(res.body.workspaceId).toBe(created.body.workspaceId);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totals).toBeDefined();
    expect(res.body.summary.totals.bankConnections).toBeGreaterThanOrEqual(0);
    expect(res.body.summary.aiCost).toBeDefined();
    expect(res.body.summary.aiCost.evidence).toBe('estimated_from_tokens');
    expect(res.body.summary.aiCost.sampleCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.events)).toBe(true);
    const aiEvent = res.body.events.find((event: { resource?: string }) => event.resource === 'aiQueries');
    expect(aiEvent?.aiCost).toBeDefined();
    expect(aiEvent?.aiCost.basis).toBe('estimated_from_tokens');
  }, 15000);
});
