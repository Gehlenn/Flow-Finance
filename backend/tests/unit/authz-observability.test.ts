import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
  getUserRoleInWorkspaceAsync: vi.fn(),
  assertCanPerform: vi.fn(),
  assertFeatureEnabled: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: mocks.loggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/admin/workspaceStore', () => ({
  getUserRoleInWorkspaceAsync: mocks.getUserRoleInWorkspaceAsync,
}));

vi.mock('../../shared/policyEngine', () => ({
  assertCanPerform: mocks.assertCanPerform,
  assertFeatureEnabled: mocks.assertFeatureEnabled,
}));

import { authz, requireFeature } from '../../src/middleware/authz';

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

describe('authz observability', () => {
  it('registra contexto quando ocorre erro inesperado em authz', async () => {
    mocks.getUserRoleInWorkspaceAsync.mockRejectedValueOnce(new Error('workspace lookup failed'));
    const middleware = authz('advancedInsights');
    const req = {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      workspace: { plan: 'free' },
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado', statusCode: 403 });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        permission: 'advancedInsights',
        fallback: 'authz-unexpected-error',
      }),
      'Authz middleware unexpected error',
    );
  });

  it('registra contexto quando ocorre erro inesperado em requireFeature', async () => {
    mocks.getUserRoleInWorkspaceAsync.mockRejectedValueOnce(new Error('workspace lookup failed'));
    const middleware = requireFeature('advancedInsights');
    const req = {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      workspace: { plan: 'free' },
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Feature indisponivel', statusCode: 403 });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        feature: 'advancedInsights',
        fallback: 'authz-feature-unexpected-error',
      }),
      'Authz feature gate unexpected error',
    );
  });
});
