import crypto from 'crypto';
import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, afterEach } from 'vitest';

let app: Express;

function signWebhook(timestamp: string, rawBody: string, secret: string): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return `sha256=${digest}`;
}

function buildPaymentPayload(externalEventId: string) {
  return {
    type: 'payment_received',
    externalEventId,
    externalPatientId: 'patient-123',
    amount: 250.5,
    currency: 'BRL',
    date: new Date().toISOString(),
    paymentMethod: 'pix',
    description: 'Consulta quitada',
  };
}

describe('Clinic Integration API', () => {
  const integrationKey = 'clinic-key-test';
  const hmacSecret = 'clinic-hmac-secret-test';

  beforeAll(async () => {
    process.env.NODE_ENV = 'staging';
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = integrationKey;
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = hmacSecret;
    process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS = '300';
    process.env.FF_CLINIC_INGEST = 'true';

    ({ default: app } = await import('../../src/index'));
  });

  beforeEach(() => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = integrationKey;
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = hmacSecret;
    process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS = '300';
    process.env.FF_CLINIC_INGEST = 'true';
  });

  afterEach(() => {
    delete process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS;
    delete process.env.FF_CLINIC_INGEST;
  });

  it('deve retornar 401 para x-integration-key inválida', async () => {
    const payload = buildPaymentPayload(`evt-invalid-key-${Date.now()}`);

    const res = await request(app)
      .post('/api/integrations/clinic/financial-events')
      .set('x-integration-key', 'wrong-key')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid integration key');
  });

  it('deve retornar 401 para assinatura HMAC inválida', async () => {
    const payload = buildPaymentPayload(`evt-invalid-sign-${Date.now()}`);
    const timestamp = String(Math.floor(Date.now() / 1000));

    const res = await request(app)
      .post('/api/integrations/clinic/financial-events')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', 'sha256=invalid')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid integration signature');
  });

  it('deve retornar 401 para timestamp fora da janela anti-replay', async () => {
    const payload = buildPaymentPayload(`evt-stale-${Date.now()}`);
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 7200);
    const rawBody = JSON.stringify(payload);
    const signature = signWebhook(staleTimestamp, rawBody, hmacSecret);

    const res = await request(app)
      .post('/api/integrations/clinic/financial-events')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', staleTimestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid integration signature');
  });

  it('deve retornar 400 para payload inválido com autenticação válida', async () => {
    const invalidPayload = {
      type: 'payment_received',
      externalEventId: `evt-invalid-payload-${Date.now()}`,
      externalPatientId: 'patient-xyz',
      // missing required amount/date/paymentMethod/description
    };

    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(invalidPayload);
    const signature = signWebhook(timestamp, rawBody, hmacSecret);

    const res = await request(app)
      .post('/api/integrations/clinic/financial-events')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('deve aceitar evento novo (202) e responder idempotente em duplicata (200)', async () => {
    const externalEventId = `evt-idem-${Date.now()}`;
    const payload = buildPaymentPayload(externalEventId);

    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(payload);
    const signature = signWebhook(timestamp, rawBody, hmacSecret);

    const first = await request(app)
      .post('/api/integrations/clinic/financial-events')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect(first.status).toBe(202);
    expect(first.body.success).toBe(true);
    expect(first.body.externalEventId).toBe(externalEventId);

    const second = await request(app)
      .post('/api/integrations/clinic/financial-events')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect(second.status).toBe(200);
    expect(second.body.success).toBe(true);
    expect(String(second.body.message || '')).toContain('already processed');
  });
});
