import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  getDomainEventPersistenceHealthCheck: vi.fn(),
  getPendingEvents: vi.fn(),
  appendDomainEvent: vi.fn(),
  acknowledgeEvent: vi.fn(),
  enqueueEvent: vi.fn(),
  retryEvent: vi.fn(),
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
  getDomainEventPersistenceHealthCheck: routeMocks.getDomainEventPersistenceHealthCheck,
  getDomainEvents: vi.fn(),
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
  return app;
}

describe('finance routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getDomainEventPersistenceHealthCheck.mockResolvedValue({
      status: 'healthy',
      mode: 'firebase',
      durable: true,
      configured: true,
      required: true,
      reason: 'firebase-ready',
    });
  });

  it('returns queued retry response and logs warning when finance event persistence fails', async () => {
    const app = createApp();

    routeMocks.getPendingEvents.mockResolvedValue([]);
    routeMocks.enqueueEvent.mockResolvedValue({ id: 'queue-1' });
    routeMocks.appendDomainEvent.mockRejectedValueOnce(new Error('event store offline'));
    routeMocks.retryEvent.mockResolvedValue({ id: 'queue-1' });

    const response = await request(app)
      .post('/api/finance/events')
      .send({
        type: 'transaction_created',
        payload: { id: 'tx-1' },
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ queued: true, retryScheduled: true });
    expect(routeMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        eventId: 'queue-1',
        workspaceId: 'ws-1',
        type: 'transaction_created',
        aggregateType: undefined,
        hasMetadata: false,
        fallback: 'finance-event-persist-failed',
      }),
      'Failed to persist finance event; scheduling retry',
    );
  });

  it('registra contexto ao falhar ao flushar evento enfileirado', async () => {
    const app = createApp();

    routeMocks.getPendingEvents.mockResolvedValue([
      {
        id: 'queued-1',
        payload: {
          type: 'transaction_created',
          workspaceId: 'ws-1',
          aggregateType: 'payment',
          payload: { id: 'tx-1' },
        },
      },
    ]);
    routeMocks.appendDomainEvent.mockRejectedValueOnce(new Error('flush failed'));
    routeMocks.retryEvent.mockResolvedValue({ id: 'queued-1' });
    routeMocks.enqueueEvent.mockResolvedValue({ id: 'queue-1' });

    const response = await request(app)
      .post('/api/finance/events')
      .send({
        type: 'transaction_created',
        payload: { id: 'tx-1' },
      });

    expect(response.status).toBe(201);
    expect(routeMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        eventId: 'queued-1',
        workspaceId: 'ws-1',
        eventType: 'transaction_created',
        aggregateType: 'payment',
        hasPayload: true,
        pendingCount: 1,
        fallback: 'finance-queued-event-flush-failed',
      }),
      'Failed to flush queued finance event; scheduling retry',
    );
  });
});



