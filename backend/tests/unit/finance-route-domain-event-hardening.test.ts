import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler';

const routeMocks = vi.hoisted(() => ({
  getPendingEvents: vi.fn(),
  appendDomainEvent: vi.fn(),
  acknowledgeEvent: vi.fn(),
  enqueueEvent: vi.fn(),
  retryEvent: vi.fn(),
  getDomainEventPersistenceHealthCheck: vi.fn(),
  loggerWarn: vi.fn(),
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
  getDomainEvents: vi.fn(),
  getDomainEventPersistenceHealthCheck: routeMocks.getDomainEventPersistenceHealthCheck,
  getDomainEventStoreHealthCheck: routeMocks.getDomainEventPersistenceHealthCheck,
}));

vi.mock('../../src/events/eventQueue', () => ({
  acknowledgeEvent: routeMocks.acknowledgeEvent,
  enqueueEvent: routeMocks.enqueueEvent,
  getPendingEvents: routeMocks.getPendingEvents,
  retryEvent: routeMocks.retryEvent,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: routeMocks.loggerWarn,
  },
}));

import financeRoutes from '../../src/routes/finance';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/finance', financeRoutes);
  app.use(errorHandler);
  return app;
}

describe('finance routes domain-event persistence hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 503 and skips domain-event writes when durable persistence is required but unavailable', async () => {
    routeMocks.getDomainEventPersistenceHealthCheck.mockResolvedValue({
      status: 'unhealthy',
      required: true,
      durable: false,
      configured: false,
      mode: 'memory',
      reason: 'no-durable-store-configured',
    });

    const app = createApp();

    const response = await request(app)
      .post('/api/finance/events')
      .send({
        type: 'transaction_created',
        payload: { id: 'tx-1' },
      });

    const errorText = response.body.message ?? response.body.error;

    expect(response.status).toBe(503);
    expect(typeof errorText).toBe('string');
    expect(errorText).toMatch(/duravel|persist|evento/i);
    expect(routeMocks.getDomainEventPersistenceHealthCheck).toHaveBeenCalledTimes(1);
    expect(routeMocks.getPendingEvents).not.toHaveBeenCalled();
    expect(routeMocks.enqueueEvent).not.toHaveBeenCalled();
    expect(routeMocks.appendDomainEvent).not.toHaveBeenCalled();
    expect(routeMocks.retryEvent).not.toHaveBeenCalled();
    expect(routeMocks.acknowledgeEvent).not.toHaveBeenCalled();
  });
});
