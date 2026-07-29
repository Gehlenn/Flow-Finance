/**
 * TESTES — Quota Enforcement Middleware (C4)
 * Verifica que:
 *  - Requests dentro do limite passam e incrementam contador
 *  - Requests que excedem o limite recebem 429 com headers corretos
 *  - Usuário free tem limite menor que usuário pro
 *  - Headers X-RateLimit-* estão presentes em toda resposta
 *  - Reset epoch aponta para início do próximo mês
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { quotaMiddleware } from '../../backend/src/middleware/quota';
import * as saasStore from '../../backend/src/utils/saasStore';
import {
  PLAN_LIMITS,
  getMonthlyCount,
  getWorkspaceMonthlyCount,
  incrementMonthlyUsage,
  incrementWorkspaceMonthlyUsage,
  resetSaasStoreForTests,
  setUserPlan,
} from '../../backend/src/utils/saasStore';
import { createWorkspace, updateWorkspaceBilling, resetWorkspaceStoreForTests } from '../../backend/src/services/admin/workspaceStore';

vi.mock('../../backend/src/config/logger', () => ({
  default: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const usageAuthorityMocks = vi.hoisted(() => ({
  isFirestoreAiUsageAuthorityEnabled: vi.fn().mockReturnValue(false),
  reserveWorkspaceUsage: vi.fn().mockResolvedValue(null),
  WorkspaceUsageAuthorityUnavailableError: class WorkspaceUsageAuthorityUnavailableError extends Error {},
  WorkspaceUsageIdempotencyConflictError: class WorkspaceUsageIdempotencyConflictError extends Error {},
}));

vi.mock('../../backend/src/services/usage/workspaceUsageAuthority', () => usageAuthorityMocks);

beforeEach(() => {
  usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReset().mockReturnValue(false);
  usageAuthorityMocks.reserveWorkspaceUsage.mockReset().mockResolvedValue(null);
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('VERCEL', '');
});

const postgresMocks = vi.hoisted(() => ({
  saveWorkspaceSaasState: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceSaasState: vi.fn().mockResolvedValue(null),
  saveJsonState: vi.fn().mockResolvedValue(undefined),
  loadJsonState: vi.fn().mockResolvedValue(null),
  insertAuditEvent: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceStoreState: vi.fn().mockResolvedValue(null),
  saveWorkspaceStoreState: vi.fn().mockResolvedValue(undefined),
  isPostgresStateStoreEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('../../backend/src/services/persistence/postgresStateStore', () => postgresMocks);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(
  userId = 'user-test',
  workspaceId?: string,
  options: { idempotencyKey?: string; requestId?: string } = {},
) {
  return {
    userId,
    workspaceId,
    requestId: options.requestId ?? 'request-quota-test',
    header: vi.fn().mockImplementation((name: string) => {
      if (name === 'x-workspace-id') return workspaceId;
      if (name === 'Idempotency-Key') return options.idempotencyKey;
      return undefined;
    }),
    params: {},
    query: {},
    body: {},
  } as {
    userId?: string;
    workspaceId?: string;
    requestId?: string;
    header: ReturnType<typeof vi.fn>;
    params: Record<string, never>;
    query: Record<string, never>;
    body: Record<string, never>;
  };
}

function makeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  const r = {
    status: vi.fn().mockImplementation((code: number) => { statusCode = code; return r; }),
    json: vi.fn(),
    setHeader: vi.fn().mockImplementation((k: string, v: string) => { headers[k] = v; }),
    getHeaders: () => headers,
    getStatusCode: () => statusCode,
  };
  return r;
}

async function runMiddleware(
  resource: 'aiQueries' | 'bankConnections' | 'transactions',
  userId: string,
  workspaceId?: string,
  requestOptions?: { idempotencyKey?: string; requestId?: string },
) {
  const req = makeReq(userId, workspaceId, requestOptions);
  const res = makeRes();
  const next = vi.fn();
  const mw = quotaMiddleware(resource, 1);
  mw(req, res, next);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { req, res, next };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('quotaMiddleware — plano free', () => {
  beforeEach(() => {
    resetSaasStoreForTests();
    resetWorkspaceStoreForTests();
  });

  it('permite request quando uso está abaixo do limite', async () => {
    const { next } = await runMiddleware('aiQueries', 'user-free');
    expect(next).toHaveBeenCalled();
  });

  it('incrementa contador após request permitida', async () => {
    await runMiddleware('aiQueries', 'user-free');
    expect(getMonthlyCount('user-free', 'aiQueries')).toBe(1);
  });

  it('bloqueia com 429 quando limite free de aiQueries é excedido', async () => {
    const userId = 'user-free-limit';
    const limit = PLAN_LIMITS.free.aiQueries;

    // Preenche até o limite
    await incrementMonthlyUsage(userId, 'aiQueries', limit);

    const { res, next } = await runMiddleware('aiQueries', userId);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'aiQueries',
        plan: 'free',
        limit,
      }),
    );
  });

  it('bloqueia com 429 quando limite free de bankConnections é excedido', async () => {
    const userId = 'user-free-bank';
    const limit = PLAN_LIMITS.free.bankConnections;

    await incrementMonthlyUsage(userId, 'bankConnections', limit);

    const { res, next } = await runMiddleware('bankConnections', userId);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('inclui headers X-RateLimit em respostas 2xx', async () => {
    const { res } = await runMiddleware('aiQueries', 'user-headers');

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Plan', 'free');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Resource', 'aiQueries');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', String(PLAN_LIMITS.free.aiQueries));
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  it('continua a requisicao se a persistencia de quota falhar', async () => {
    const spy = vi.spyOn(saasStore, 'incrementMonthlyUsage').mockRejectedValueOnce(new Error('quota store failed'));

    const { next, res } = await runMiddleware('aiQueries', 'user-quota-fallback');

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(500);
    spy.mockRestore();
  });

  it('inclui headers X-RateLimit em respostas 429', async () => {
    const userId = 'user-headers-429';
    await incrementMonthlyUsage(userId, 'aiQueries', PLAN_LIMITS.free.aiQueries);

    const { res } = await runMiddleware('aiQueries', userId);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', String(PLAN_LIMITS.free.aiQueries));
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
  });

  it('X-RateLimit-Reset aponta para o futuro (próximo mês)', async () => {
    const { res } = await runMiddleware('aiQueries', 'user-reset');

    const resetCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === 'X-RateLimit-Reset',
    );
    const resetEpoch = parseInt(resetCall[1], 10);
    expect(resetEpoch).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe('quotaMiddleware — plano pro', () => {
  beforeEach(() => {
    resetSaasStoreForTests();
    resetWorkspaceStoreForTests();
  });

  it('usuário pro tem limite maior de aiQueries que free', () => {
    expect(PLAN_LIMITS.pro.aiQueries).toBeGreaterThan(PLAN_LIMITS.free.aiQueries);
    expect(PLAN_LIMITS.pro.bankConnections).toBeGreaterThan(PLAN_LIMITS.free.bankConnections);
  });

  it('permite request quando uso pro está abaixo do limite maior', async () => {
    const userId = 'user-pro-ok';
    await setUserPlan(userId, 'pro');

    // Preenche além do limite free mas abaixo do limite pro
    await incrementMonthlyUsage(userId, 'aiQueries', PLAN_LIMITS.free.aiQueries + 10);

    const { next } = await runMiddleware('aiQueries', userId);
    expect(next).toHaveBeenCalled();
  });

  it('bloqueia pro com 429 apenas quando limite pro é excedido', async () => {
    const userId = 'user-pro-limit';
    await setUserPlan(userId, 'pro');
    await incrementMonthlyUsage(userId, 'aiQueries', PLAN_LIMITS.pro.aiQueries);

    const { res, next } = await runMiddleware('aiQueries', userId);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ plan: 'pro' }));
  });
});

describe('quotaMiddleware — sem userId', () => {
  beforeEach(() => {
    resetSaasStoreForTests();
    resetWorkspaceStoreForTests();
  });

  it('chama next() sem bloquear quando userId está ausente (auth deve bloquear antes)', async () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const next = vi.fn();

    const mw = quotaMiddleware('aiQueries');
    mw(req, res, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('saasStore — funções auxiliares', () => {
  beforeEach(() => {
    resetSaasStoreForTests();
    resetWorkspaceStoreForTests();
  });

  it('getMonthlyCount retorna 0 inicial', () => {
    expect(getMonthlyCount('fresh-user', 'aiQueries')).toBe(0);
  });

  it('incrementMonthlyUsage retorna novo total', async () => {
    const total = await incrementMonthlyUsage('counter-user', 'aiQueries', 5);
    expect(total).toBe(5);
    const total2 = await incrementMonthlyUsage('counter-user', 'aiQueries', 3);
    expect(total2).toBe(8);
  });

  it('setUserPlan persiste plano e getUserPlan recupera', async () => {
    await setUserPlan('plan-user', 'pro');
    expect(PLAN_LIMITS['pro'].aiQueries).toBe(5000);
  });

  it('resetSaasStoreForTests limpa tudo', async () => {
    await incrementMonthlyUsage('r-user', 'aiQueries', 50);
    await setUserPlan('r-user', 'pro');
    resetSaasStoreForTests();
    expect(getMonthlyCount('r-user', 'aiQueries')).toBe(0);
  });
});

describe('quotaMiddleware - workspace scope', () => {
  beforeEach(() => {
    resetSaasStoreForTests();
    resetWorkspaceStoreForTests();
  });

  it('aplica limites e contador no escopo do workspace quando o contexto existe', async () => {
    const workspace = createWorkspace('Quota Workspace', 'owner-workspace');

    await runMiddleware('aiQueries', 'owner-workspace', workspace.workspaceId);

    expect(getWorkspaceMonthlyCount(workspace.workspaceId, 'aiQueries')).toBe(1);
    expect(getMonthlyCount('owner-workspace', 'aiQueries')).toBe(0);
  });

  it('usa limites do plano do workspace em vez do plano legado do usuario', async () => {
    const workspace = createWorkspace('Pro Workspace', 'owner-pro');
    updateWorkspaceBilling(workspace.workspaceId, {
      plan: 'pro',
      subscription: {
        subscriptionId: 'sub_quota_pro',
        provider: 'internal',
        status: 'active',
        plan: 'pro',
        startedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
      },
    });

    setUserPlan('owner-pro', 'free');
    incrementWorkspaceMonthlyUsage(workspace.workspaceId, 'aiQueries', PLAN_LIMITS.free.aiQueries + 5);

    const { next, res } = await runMiddleware('aiQueries', 'owner-pro', workspace.workspaceId);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Plan', 'pro');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Scope', 'workspace');
  });

  it('bloqueia quando o limite do workspace e excedido', async () => {
    const workspace = createWorkspace('Free Workspace', 'owner-free');
    incrementWorkspaceMonthlyUsage(workspace.workspaceId, 'bankConnections', PLAN_LIMITS.free.bankConnections);

    const { next, res } = await runMiddleware('bankConnections', 'owner-free', workspace.workspaceId);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'workspace',
      scopeId: workspace.workspaceId,
      plan: 'free',
    }));
  });

  it('mantem bankConnections no caminho legado durante o cutover exclusivo de AI', async () => {
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    const workspace = createWorkspace('Banking legacy cutover', 'owner-bank-legacy');

    const { next } = await runMiddleware('bankConnections', 'owner-bank-legacy', workspace.workspaceId);

    expect(next).toHaveBeenCalledOnce();
    expect(usageAuthorityMocks.reserveWorkspaceUsage).not.toHaveBeenCalled();
    expect(getWorkspaceMonthlyCount(workspace.workspaceId, 'bankConnections')).toBe(1);
  });

  it('faz fallback legado apenas no desenvolvimento/teste quando a autoridade Firestore nao esta configurada', async () => {
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    const workspace = createWorkspace('Workspace fallback', 'owner-fallback');
    usageAuthorityMocks.reserveWorkspaceUsage.mockRejectedValue(
      new usageAuthorityMocks.WorkspaceUsageAuthorityUnavailableError(),
    );

    await runMiddleware('aiQueries', 'owner-fallback', workspace.workspaceId);

    expect(usageAuthorityMocks.reserveWorkspaceUsage).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: workspace.workspaceId,
      userId: 'owner-fallback',
      idempotencyKey: 'request-quota-test',
    }));
    expect(getWorkspaceMonthlyCount(workspace.workspaceId, 'aiQueries')).toBe(1);
  });

  it('usa a reserva atomica autoritativa e bloqueia o replay antes do controller', async () => {
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    const workspace = createWorkspace('Workspace authority', 'owner-authority');
    usageAuthorityMocks.reserveWorkspaceUsage
      .mockResolvedValueOnce({
        outcome: 'accepted',
        idempotent: false,
        current: 1,
        limit: 50,
        remaining: 49,
        monthKey: '2026-07',
        plan: 'free',
      })
      .mockResolvedValueOnce({
        outcome: 'accepted',
        idempotent: true,
        current: 1,
        limit: 50,
        remaining: 49,
        monthKey: '2026-07',
        plan: 'free',
      });

    const first = await runMiddleware('aiQueries', 'owner-authority', workspace.workspaceId, { idempotencyKey: 'quota-replay-1' });
    const replay = await runMiddleware('aiQueries', 'owner-authority', workspace.workspaceId, { idempotencyKey: 'quota-replay-1' });

    expect(first.next).toHaveBeenCalledOnce();
    expect(replay.next).not.toHaveBeenCalled();
    expect(replay.res.status).toHaveBeenCalledWith(409);
    expect(replay.res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'idempotency_replay',
    }));
    expect(usageAuthorityMocks.reserveWorkspaceUsage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      idempotencyKey: 'quota-replay-1',
    }));
    expect(getWorkspaceMonthlyCount(workspace.workspaceId, 'aiQueries')).toBe(0);
    expect(replay.res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '49');
  });

  it('retorna 429 da decisao autoritativa sem chamar next', async () => {
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    const workspace = createWorkspace('Workspace exceeded', 'owner-exceeded');
    usageAuthorityMocks.reserveWorkspaceUsage.mockResolvedValue({
      outcome: 'limit_exceeded',
      idempotent: false,
      current: 50,
      limit: 50,
      remaining: 0,
      monthKey: '2026-07',
      plan: 'free',
    });

    const { res, next } = await runMiddleware('aiQueries', 'owner-exceeded', workspace.workspaceId);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
  });

  it('retorna 409 quando a chave de idempotencia conflita', async () => {
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    const workspace = createWorkspace('Workspace conflict', 'owner-conflict');
    usageAuthorityMocks.reserveWorkspaceUsage.mockRejectedValue(
      new usageAuthorityMocks.WorkspaceUsageIdempotencyConflictError('conflict'),
    );

    const { res, next } = await runMiddleware('aiQueries', 'owner-conflict', workspace.workspaceId);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('falha fechada com 503 em producao quando a autoridade nao esta configurada', async () => {
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    const workspace = createWorkspace('Workspace production', 'owner-production');
    vi.stubEnv('NODE_ENV', 'production');
    usageAuthorityMocks.reserveWorkspaceUsage.mockRejectedValue(
      new usageAuthorityMocks.WorkspaceUsageAuthorityUnavailableError(),
    );

    const { res, next } = await runMiddleware(
      'aiQueries',
      'owner-production',
      workspace.workspaceId,
      { idempotencyKey: 'production-authority-unavailable' },
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(getWorkspaceMonthlyCount(workspace.workspaceId, 'aiQueries')).toBe(0);
  });

  it('falha fechada com 503 no Vercel mesmo fora de NODE_ENV production', async () => {
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    const workspace = createWorkspace('Workspace Vercel', 'owner-vercel');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL', '1');
    usageAuthorityMocks.reserveWorkspaceUsage.mockRejectedValue(
      new usageAuthorityMocks.WorkspaceUsageAuthorityUnavailableError(),
    );

    const { res, next } = await runMiddleware(
      'aiQueries',
      'owner-vercel',
      workspace.workspaceId,
      { idempotencyKey: 'vercel-authority-unavailable' },
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(getWorkspaceMonthlyCount(workspace.workspaceId, 'aiQueries')).toBe(0);
  });

  it('exige Idempotency-Key explicita em producao', async () => {
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    const workspace = createWorkspace('Workspace production key', 'owner-production-key');
    vi.stubEnv('NODE_ENV', 'production');

    const { res, next } = await runMiddleware(
      'aiQueries',
      'owner-production-key',
      workspace.workspaceId,
      { requestId: 'generated-request-id' },
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'missing_idempotency_key',
    }));
    expect(usageAuthorityMocks.reserveWorkspaceUsage).not.toHaveBeenCalled();
  });

  it('rejeita Idempotency-Key invalida antes de reservar ou executar o controller', async () => {
    usageAuthorityMocks.isFirestoreAiUsageAuthorityEnabled.mockReturnValue(true);
    const workspace = createWorkspace('Workspace invalid key', 'owner-invalid-key');

    const { res, next } = await runMiddleware(
      'aiQueries',
      'owner-invalid-key',
      workspace.workspaceId,
      { idempotencyKey: 'invalid/key' },
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(usageAuthorityMocks.reserveWorkspaceUsage).not.toHaveBeenCalled();
  });
});
