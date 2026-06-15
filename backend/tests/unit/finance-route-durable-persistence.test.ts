import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler';

const routeMocks = vi.hoisted(() => ({
  getDomainEventPersistenceHealthCheck: vi.fn(),
  getPendingEvents: vi.fn(),
  appendDomainEvent: vi.fn(),
  acknowledgeEvent: vi.fn(),
  enqueueEvent: vi.fn(),
  retryEvent: vi.fn(),
  getDomainEvents: vi.fn(),
}));

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../src/middleware/authz', () => ({
  authz: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  requireFeature: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock('../../src/middleware/workspaceContext', () => ({
  workspaceContextMiddleware: (req: { workspaceId?: string; tenantId?: string; userId?: string }, _res: unknown, next: () => void) => {
    req.workspaceId = 'ws-1';
    req.tenantId = 'tenant-1';
    req.userId = 'user-1';
    next();
  },
}));

vi.mock('../../src/middleware/rateLimit', () => ({
  financeEventsLimiterByUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../src/controllers/financeController', () => ({
  financeMetricsController: (_req: unknown, res: { json: (value: unknown) => void }) => res.json({ ok: true }),
}));

vi.mock('../../src/services/finance/eventStore', () => ({
  appendDomainEvent: routeMocks.appendDomainEvent,
  getDomainEventPersistenceHealthCheck: routeMocks.getDomainEventPersistenceHealthCheck,
  getDomainEvents: routeMocks.getDomainEvents,
}));

vi.mock('../../src/events/eventQueue', () => ({
  acknowledgeEvent: routeMocks.acknowledgeEvent,
  enqueueEvent: routeMocks.enqueueEvent,
  getPendingEvents: routeMocks.getPendingEvents,
  retryEvent: routeMocks.retryEvent,
}));

import financeRoutes from '../../src/routes/finance';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/finance', financeRoutes);
  app.use(errorHandler);
  return app;
}

describe('finance routes durable persistence guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getDomainEventPersistenceHealthCheck.mockResolvedValue({
      status: 'unhealthy',
      mode: 'legacy-file',
      durable: false,
      configured: true,
      required: true,
      reason: 'legacy-file-not-accepted-for-production',
    });
  });

  it('returns 503 for POST /api/finance/events when durable persistence is required but unavailable', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/finance/events')
      .send({
        type: 'transaction_created',
        payload: { id: 'tx-1' },
      });

    expect(response.status).toBe(503);
    expect(response.body.message).toBe('Persistencia duravel de eventos indisponivel');
    expect(routeMocks.getPendingEvents).not.toHaveBeenCalled();
    expect(routeMocks.enqueueEvent).not.toHaveBeenCalled();
    expect(routeMocks.appendDomainEvent).not.toHaveBeenCalled();
  });

  it('returns 503 for GET /api/finance/events when durable persistence is required but unavailable', async () => {
    const app = createApp();

    const response = await request(app).get('/api/finance/events');

    expect(response.status).toBe(503);
    expect(response.body.message).toBe('Persistencia duravel de eventos indisponivel');
    expect(routeMocks.getDomainEvents).not.toHaveBeenCalled();
  });
});
