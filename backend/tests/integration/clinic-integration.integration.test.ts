import crypto from 'crypto';
import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, afterEach } from 'vitest';
import { resetRateLimitStore } from '../../src/middleware/rateLimitByUser';

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
  const burstIntegrationKey = 'clinic-key-burst';
  const hmacSecret = 'clinic-hmac-secret-test';

  beforeAll(async () => {
    process.env.NODE_ENV = 'staging';
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = `${integrationKey},${burstIntegrationKey}`;
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = hmacSecret;
    process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS = '300';
    process.env.FF_CLINIC_INGEST = 'true';
    process.env.CLINIC_EDGE_RATE_LIMIT_MAX = '5';
    process.env.CLINIC_AUTH_RATE_LIMIT_MAX = '3';
    process.env.CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES = '1024';

    ({ default: app } = await import('../../src/index'));
  });

  beforeEach(() => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = `${integrationKey},${burstIntegrationKey}`;
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = hmacSecret;
    process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS = '300';
    process.env.FF_CLINIC_INGEST = 'true';
    process.env.CLINIC_EDGE_RATE_LIMIT_MAX = '5';
    process.env.CLINIC_AUTH_RATE_LIMIT_MAX = '3';
    process.env.CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES = '1024';
    resetRateLimitStore();
  });

  afterEach(() => {
    delete process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS;
    delete process.env.FF_CLINIC_INGEST;
    delete process.env.CLINIC_EDGE_RATE_LIMIT_MAX;
    delete process.env.CLINIC_AUTH_RATE_LIMIT_MAX;
    delete process.env.CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES;
    resetRateLimitStore();
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

  it('deve retornar 400 para externalEventId com formato inválido', async () => {
    const invalidPayload = {
      type: 'payment_received',
      externalEventId: 'evt invalid/1',
      externalPatientId: 'patient-xyz',
      amount: 120,
      currency: 'BRL',
      date: new Date().toISOString(),
      paymentMethod: 'pix',
      description: 'Pagamento inválido para teste',
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

  it('deve retornar 413 quando payload excede o limite configurado da rota clínica', async () => {
    const payload = {
      ...buildPaymentPayload(`evt-oversized-${Date.now()}`),
      description: 'x'.repeat(3000),
    };

    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(payload);
    const signature = signWebhook(timestamp, rawBody, hmacSecret);

    const res = await request(app)
      .post('/api/integrations/clinic/financial-events')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Payload too large');
  });

  it('deve retornar 429 em burst acima do limite autenticado configurado', async () => {
    const requests = [];

    for (let i = 0; i < 4; i++) {
      const payload = buildPaymentPayload(`evt-burst-${Date.now()}-${i}`);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify(payload);
      const signature = signWebhook(timestamp, rawBody, hmacSecret);

      requests.push(
        request(app)
          .post('/api/integrations/clinic/financial-events')
          .set('x-integration-key', burstIntegrationKey)
          .set('x-integration-timestamp', timestamp)
          .set('x-integration-signature', signature)
          .send(payload)
      );
    }

    const responses = await Promise.all(requests);
    const statuses = responses.map((response) => response.status);

    expect(statuses).toContain(429);
  });

  it('deve retornar 401 no health quando x-integration-key for inválida', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signWebhook(timestamp, '', hmacSecret);

    const res = await request(app)
      .get('/api/integrations/clinic/health')
      .set('x-integration-key', 'wrong-key')
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid integration key');
  });

  it('deve retornar status de health da integração clínica com autenticação válida', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signWebhook(timestamp, '', hmacSecret);

    const res = await request(app)
      .get('/api/integrations/clinic/health')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature);

    expect([200, 503]).toContain(res.status);
    expect(typeof res.body.healthy).toBe('boolean');
    expect(res.body.dependencies).toBeDefined();
    expect(res.body.features).toBeDefined();
    expect(res.body.safeguards).toBeDefined();
  });

  it('deve retornar 429 no health quando exceder limite de borda por IP', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signWebhook(timestamp, '', hmacSecret);

    const responses = await Promise.all(
      Array.from({ length: 6 }, () => (
        request(app)
          .get('/api/integrations/clinic/health')
          .set('x-integration-key', integrationKey)
          .set('x-integration-timestamp', timestamp)
          .set('x-integration-signature', signature)
      ))
    );

    const statuses = responses.map((response) => response.status);
    expect(statuses).toContain(429);
  });
});
