import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/shared/AppError';
import { errorHandler } from '../../src/middleware/errorHandler';

const routeMocks = vi.hoisted(() => ({
  authMiddleware: vi.fn((req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = 'user-1';
    next();
  }),
  workspaceContextMiddleware: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  authz: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  createWorkspaceAsync: vi.fn(),
  listWorkspaceSummariesForUserAsync: vi.fn(),
  addUserToWorkspaceAsync: vi.fn(),
  getWorkspaceUsersAsync: vi.fn(),
  removeUserFromWorkspaceAsync: vi.fn(),
}));

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: routeMocks.authMiddleware,
}));

vi.mock('../../src/middleware/workspaceContext', () => ({
  workspaceContextMiddleware: routeMocks.workspaceContextMiddleware,
}));

vi.mock('../../src/middleware/authz', () => ({
  authz: routeMocks.authz,
}));

vi.mock('../../src/services/admin/workspaceStore', () => ({
  createWorkspaceAsync: routeMocks.createWorkspaceAsync,
  listWorkspaceSummariesForUserAsync: routeMocks.listWorkspaceSummariesForUserAsync,
  addUserToWorkspaceAsync: routeMocks.addUserToWorkspaceAsync,
  getWorkspaceUsersAsync: routeMocks.getWorkspaceUsersAsync,
  removeUserFromWorkspaceAsync: routeMocks.removeUserFromWorkspaceAsync,
}));

import workspaceRoutes from '../../src/routes/workspace';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/workspace', workspaceRoutes);
  app.use(errorHandler);
  return app;
}

describe('workspace route fail-closed behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 503 instead of creating a workspace when production has no durable backend', async () => {
    routeMocks.createWorkspaceAsync.mockRejectedValueOnce(
      new AppError(503, 'Persistencia duravel de workspace indisponivel'),
    );

    const app = createApp();

    const res = await request(app)
      .post('/api/workspace')
      .send({ name: 'Workspace Production' });

    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Persistencia duravel de workspace indisponivel');
    expect(routeMocks.createWorkspaceAsync).toHaveBeenCalledWith('Workspace Production', 'user-1', undefined);
  });

  it('keeps the create path available when a durable backend is configured', async () => {
    routeMocks.createWorkspaceAsync.mockResolvedValue({
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      name: 'Workspace Production',
    });

    const app = createApp();

    const res = await request(app)
      .post('/api/workspace')
      .send({ name: 'Workspace Production' });

    expect(res.status).toBe(201);
    expect(res.body.workspaceId).toBe('ws-1');
    expect(routeMocks.createWorkspaceAsync).toHaveBeenCalledWith('Workspace Production', 'user-1', undefined);
  });
});
