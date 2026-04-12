import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeServiceMocks = vi.hoisted(() => ({
  ingestIntegrationTransaction: vi.fn(),
  ingestIntegrationReminder: vi.fn(),
}));

vi.mock('../../src/services/businessIntegrationService', () => ({
  ingestIntegrationTransaction: routeServiceMocks.ingestIntegrationTransaction,
  ingestIntegrationReminder: routeServiceMocks.ingestIntegrationReminder,
}));

import businessIntegrationRoutes from '../../src/routes/businessIntegration';

function createApp() {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  }));
  app.use('/api/integrations', businessIntegrationRoutes);
  return app;
}

describe('business integration routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_BINDINGS = 'valid-key|ws_123|n8n_ops';
    delete process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS;
  });

  it('returns contract-shaped unauthorized response for invalid integration key', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/transactions')
      .set('x-integration-key', 'wrong-key')
      .send({
        workspaceId: 'ws_123',
        sourceSystem: 'n8n_ops',
        externalRecordId: 'txn_1',
        type: 'income',
        amount: 100,
        currency: 'BRL',
        occurredAt: '2026-04-09T14:30:00.000Z',
        description: 'Pagamento confirmado',
        status: 'confirmed',
      });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      ok: false,
      error: 'unauthorized',
      message: 'integration credentials are invalid',
    });
  });

  it('returns contract-shaped forbidden response when key is valid but not scoped to workspace/source', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/reminders')
      .set('x-integration-key', 'valid-key')
      .send({
        workspaceId: 'ws_other',
        sourceSystem: 'n8n_ops',
        externalRecordId: 'rem_1',
        title: 'Lembrete',
        remindAt: '2026-04-10T10:00:00.000Z',
        kind: 'financial',
        status: 'active',
      });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      ok: false,
      error: 'forbidden',
      message: 'integration key is not scoped to this workspace and source system',
    });
  });

  it('returns 503 with contract shape when binding is not configured', async () => {
    delete process.env.FLOW_EXTERNAL_INTEGRATION_BINDINGS;
    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/transactions')
      .set('x-integration-key', 'valid-key')
      .send({
        workspaceId: 'ws_123',
        sourceSystem: 'n8n_ops',
        externalRecordId: 'txn_1',
        type: 'income',
        amount: 100,
        currency: 'BRL',
        occurredAt: '2026-04-09T14:30:00.000Z',
        description: 'Pagamento confirmado',
        status: 'confirmed',
      });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      ok: false,
      error: 'integration_unavailable',
      message: 'integration binding is not configured',
    });
  });

  it('returns 400 with validation_error when payload is invalid', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/transactions')
      .set('x-integration-key', 'valid-key')
      .send({
        workspaceId: 'ws_123',
        sourceSystem: 'n8n_ops',
        externalRecordId: 'txn_1',
        type: 'income',
        amount: 100,
        currency: 'BRL',
        occurredAt: '2026-04-09T14:30:00.000Z',
        status: 'confirmed',
      });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/description/i);
  });

  it('returns 400 when Idempotency-Key header is invalid', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/transactions')
      .set('x-integration-key', 'valid-key')
      .set('Idempotency-Key', 'x'.repeat(129))
      .send({
        workspaceId: 'ws_123',
        sourceSystem: 'n8n_ops',
        externalRecordId: 'txn_1',
        type: 'income',
        amount: 100,
        currency: 'BRL',
        occurredAt: '2026-04-09T14:30:00.000Z',
        description: 'Pagamento confirmado',
        status: 'confirmed',
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'Idempotency-Key header is invalid',
    });
  });

  it('returns 201 and normalized response for valid transaction ingest', async () => {
    routeServiceMocks.ingestIntegrationTransaction.mockResolvedValue({
      ok: true,
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'txn_1',
      action: 'created',
      entity: 'transaction',
      storedAs: 'transactions',
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/integrations/transactions')
      .set('x-integration-key', 'valid-key')
      .set('Idempotency-Key', 'idem-transaction-1')
      .send({
        workspaceId: 'ws_123',
        sourceSystem: 'n8n_ops',
        externalRecordId: 'txn_1',
        type: 'income',
        amount: 100,
        currency: 'BRL',
        occurredAt: '2026-04-09T14:30:00.000Z',
        description: 'Pagamento confirmado',
        status: 'confirmed',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true, action: 'created' });
  });

  it('returns 200 for replayed reminder ingest', async () => {
    routeServiceMocks.ingestIntegrationReminder.mockResolvedValue({
      ok: true,
      workspaceId: 'ws_123',
      sourceSystem: 'n8n_ops',
      externalRecordId: 'rem_1',
      action: 'replayed',
      entity: 'reminder',
      storedAs: 'reminders',
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/integrations/reminders')
      .set('x-integration-key', 'valid-key')
      .send({
        workspaceId: 'ws_123',
        sourceSystem: 'n8n_ops',
        externalRecordId: 'rem_1',
        title: 'Lembrete operacional',
        remindAt: '2026-04-10T10:00:00.000Z',
        kind: 'operational',
        status: 'active',
      });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('replayed');
  });
});
