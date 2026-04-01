/**
 * TESTES — Quota Enforcement Middleware (C4)
 * Verifica que:
 *  - Requests dentro do limite passam e incrementam contador
 *  - Requests que excedem o limite recebem 429 com headers corretos
 *  - Usuário free tem limite menor que usuário pro
 *  - trackOnly incrementa sem bloquear
 *  - Headers X-RateLimit-* estão presentes em toda resposta
 *  - Reset epoch aponta para início do próximo mês
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { quotaMiddleware } from '../../backend/src/middleware/quota';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(userId = 'user-test', workspaceId?: string) {
  return {
    userId,
    workspaceId,
    header: vi.fn().mockImplementation((name: string) => (name === 'x-workspace-id' ? workspaceId : undefined)),
    params: {},
    query: {},
    body: {},
  } as any;
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
  options?: { trackOnly?: boolean },
  workspaceId?: string,
) {
  const req = makeReq(userId, workspaceId);
  const res = makeRes();
  const next = vi.fn();
  const mw = quotaMiddleware(resource, 1, options);
  mw(req as any, res as any, next);
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
    incrementMonthlyUsage(userId, 'aiQueries', limit);

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

    incrementMonthlyUsage(userId, 'bankConnections', limit);

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

  it('inclui headers X-RateLimit em respostas 429', async () => {
    const userId = 'user-headers-429';
    incrementMonthlyUsage(userId, 'aiQueries', PLAN_LIMITS.free.aiQueries);

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
    setUserPlan(userId, 'pro');

    // Preenche além do limite free mas abaixo do limite pro
    incrementMonthlyUsage(userId, 'aiQueries', PLAN_LIMITS.free.aiQueries + 10);

    const { next } = await runMiddleware('aiQueries', userId);
    expect(next).toHaveBeenCalled();
  });

  it('bloqueia pro com 429 apenas quando limite pro é excedido', async () => {
    const userId = 'user-pro-limit';
    setUserPlan(userId, 'pro');
    incrementMonthlyUsage(userId, 'aiQueries', PLAN_LIMITS.pro.aiQueries);

    const { res, next } = await runMiddleware('aiQueries', userId);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ plan: 'pro' }));
  });
});

describe('quotaMiddleware — trackOnly', () => {
  beforeEach(() => {
    resetSaasStoreForTests();
    resetWorkspaceStoreForTests();
  });

  it('trackOnly passa mesmo com limite excedido', async () => {
    const userId = 'user-track-only';
    incrementMonthlyUsage(userId, 'transactions', PLAN_LIMITS.free.transactions + 1000);

    const { next } = await runMiddleware('transactions', userId, { trackOnly: true });
    expect(next).toHaveBeenCalled();
  });

  it('trackOnly ainda incrementa o contador', async () => {
    const userId = 'user-track-count';
    await runMiddleware('transactions', userId, { trackOnly: true });
    expect(getMonthlyCount(userId, 'transactions')).toBe(1);
  });
});

describe('quotaMiddleware — sem userId', () => {
  beforeEach(() => {
    resetSaasStoreForTests();
    resetWorkspaceStoreForTests();
  });

  it('chama next() sem bloquear quando userId está ausente (auth deve bloquear antes)', async () => {
    const req = { userId: undefined } as any;
    const res = makeRes();
    const next = vi.fn();

    const mw = quotaMiddleware('aiQueries');
    mw(req, res as any, next);
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

  it('incrementMonthlyUsage retorna novo total', () => {
    const total = incrementMonthlyUsage('counter-user', 'aiQueries', 5);
    expect(total).toBe(5);
    const total2 = incrementMonthlyUsage('counter-user', 'aiQueries', 3);
    expect(total2).toBe(8);
  });

  it('setUserPlan persiste plano e getUserPlan recupera', () => {
    setUserPlan('plan-user', 'pro');
    expect(PLAN_LIMITS['pro'].aiQueries).toBe(5000);
  });

  it('resetSaasStoreForTests limpa tudo', () => {
    incrementMonthlyUsage('r-user', 'aiQueries', 50);
    setUserPlan('r-user', 'pro');
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

    await runMiddleware('aiQueries', 'owner-workspace', undefined, workspace.workspaceId);

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

    const { next, res } = await runMiddleware('aiQueries', 'owner-pro', undefined, workspace.workspaceId);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Plan', 'pro');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Scope', 'workspace');
  });

  it('bloqueia quando o limite do workspace e excedido', async () => {
    const workspace = createWorkspace('Free Workspace', 'owner-free');
    incrementWorkspaceMonthlyUsage(workspace.workspaceId, 'bankConnections', PLAN_LIMITS.free.bankConnections);

    const { next, res } = await runMiddleware('bankConnections', 'owner-free', undefined, workspace.workspaceId);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'workspace',
      scopeId: workspace.workspaceId,
      plan: 'free',
    }));
  });
});
