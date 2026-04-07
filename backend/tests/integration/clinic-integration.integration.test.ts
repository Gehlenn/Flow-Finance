import crypto from 'crypto';
import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, afterEach } from 'vitest';
import { resetRateLimitStore } from '../../src/middleware/rateLimitByUser';
import { createTenant, resetWorkspaceStoreForTests } from '../../src/services/admin/workspaceStore';
import { getDomainEvents, resetDomainEventStoreForTests } from '../../src/services/finance/eventStore';
import { resetCloudSyncStoreForTests } from '../../src/services/sync/cloudSyncStore';
import { resetExternalIdempotencyStoreForTests } from '../../src/services/externalIdempotencyStore';

let app: Express;
let workspaceId: string;

function signWebhook(timestamp: string, rawBody: string, secret: string): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return `sha256=${digest}`;
}

function buildPaymentPayload(externalEventId: string, externalFacilityId: string) {
  return {
    type: 'payment_received',
    externalEventId,
    externalPatientId: 'patient-123',
    externalFacilityId,
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
    process.env.FF_CLINIC_AUTO_POST = 'true';
    process.env.CLINIC_EDGE_RATE_LIMIT_MAX = '5';
    process.env.CLINIC_AUTH_RATE_LIMIT_MAX = '10';
    process.env.CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES = '1024';

    ({ default: app } = await import('../../src/index'));
  });

  beforeEach(() => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = `${integrationKey},${burstIntegrationKey}`;
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = hmacSecret;
    process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS = '300';
    process.env.FF_CLINIC_INGEST = 'true';
    process.env.FF_CLINIC_AUTO_POST = 'true';
    process.env.CLINIC_EDGE_RATE_LIMIT_MAX = '5';
    process.env.CLINIC_AUTH_RATE_LIMIT_MAX = '10';
    process.env.CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES = '1024';
    resetWorkspaceStoreForTests();
    resetDomainEventStoreForTests();
    resetCloudSyncStoreForTests();
    resetExternalIdempotencyStoreForTests();
    workspaceId = createTenant('Clinic Test Workspace', 'clinic-integration-owner').workspace.workspaceId;
    resetRateLimitStore();
  });

  afterEach(() => {
    delete process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS;
    delete process.env.FF_CLINIC_INGEST;
    delete process.env.FF_CLINIC_AUTO_POST;
    delete process.env.CLINIC_EDGE_RATE_LIMIT_MAX;
    delete process.env.CLINIC_AUTH_RATE_LIMIT_MAX;
    delete process.env.CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES;
    resetWorkspaceStoreForTests();
    resetDomainEventStoreForTests();
    resetCloudSyncStoreForTests();
    resetExternalIdempotencyStoreForTests();
    resetRateLimitStore();
  });

  it('deve retornar 401 para x-integration-key inválida', async () => {
    const payload = buildPaymentPayload(`evt-invalid-key-${Date.now()}`, workspaceId);

    const res = await request(app)
      .post('/api/integrations/clinic/financial-events')
      .set('x-integration-key', 'wrong-key')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid integration key');
  });

  it('deve retornar 401 para assinatura HMAC inválida', async () => {
    const payload = buildPaymentPayload(`evt-invalid-sign-${Date.now()}`, workspaceId);
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
    const payload = buildPaymentPayload(`evt-stale-${Date.now()}`, workspaceId);
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

  it('deve aceitar ingestão pelo endpoint canônico /webhook (202)', async () => {
    const payload = buildPaymentPayload(`evt-webhook-${Date.now()}`, workspaceId);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(payload);
    const signature = signWebhook(timestamp, rawBody, hmacSecret);

    const res = await request(app)
      .post('/api/integrations/clinic/webhook')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.externalEventId).toBe(payload.externalEventId);
  });

  it('deve aceitar envelope v1 no /webhook e normalizar para persistência (202)', async () => {
    const externalEventId = `evt-v1-${Date.now()}`;
    const envelope = {
      schemaVersion: '1.0',
      sourceSystem: 'clinic-automation',
      workspaceId,
      externalEventId,
      eventType: 'payment_received',
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: 'patient-123',
        externalReceivableId: 'recv-123',
        amount: 250.5,
        currency: 'BRL',
        description: 'Consulta quitada via contrato v1',
      },
    };

    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(envelope);
    const signature = signWebhook(timestamp, rawBody, hmacSecret);

    const res = await request(app)
      .post('/api/integrations/clinic/webhook')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(envelope);

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.externalEventId).toBe(externalEventId);

    const domainEvents = await getDomainEvents({
      workspaceId,
      type: 'external.payment_received',
    });

    expect(domainEvents).toHaveLength(1);
    expect(domainEvents[0]?.payload).toMatchObject({
      externalEventId,
      sourceSystem: 'clinic-automation',
      amount: envelope.payload.amount,
      description: envelope.payload.description,
    });
  });

  it('deve marcar /financial-events como legado com headers de depreciação', async () => {
    const payload = buildPaymentPayload(`evt-legacy-${Date.now()}`, workspaceId);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(payload);
    const signature = signWebhook(timestamp, rawBody, hmacSecret);

    const res = await request(app)
      .post('/api/integrations/clinic/financial-events')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect([200, 202]).toContain(res.status);
    expect(res.headers.deprecation).toBe('true');
    expect(String(res.headers.sunset || '')).toContain('2026');
    expect(String(res.headers.link || '')).toContain('/api/integrations/clinic/webhook');
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
    const payload = buildPaymentPayload(externalEventId, workspaceId);

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

    const domainEvents = await getDomainEvents({
      workspaceId,
      type: 'external.payment_received',
    });

    expect(domainEvents).toHaveLength(1);
    expect(domainEvents[0]?.payload).toMatchObject({
      externalEventId,
      sourceSystem: 'clinic-automation',
      amount: payload.amount,
    });

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
      ...buildPaymentPayload(`evt-oversized-${Date.now()}`, workspaceId),
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

    for (let i = 0; i < 11; i++) {
      const payload = buildPaymentPayload(`evt-burst-${Date.now()}-${i}`, workspaceId);
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

  it('deve retornar 400 quando externalFacilityId estiver ausente para evitar roteamento inseguro', async () => {
    const payload = {
      type: 'payment_received',
      externalEventId: `evt-no-workspace-${Date.now()}`,
      externalPatientId: 'patient-123',
      amount: 250.5,
      currency: 'BRL',
      date: new Date().toISOString(),
      paymentMethod: 'pix',
      description: 'Consulta quitada',
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

    expect(res.status).toBe(400);
    expect(String(res.body.message || '')).toContain('externalFacilityId is required');
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

  it('deve suportar replay seguro (idempotência stricta) com mesmo externalEventId', async () => {
    const externalEventId = `evt-replay-strict-${Date.now()}`;
    const payload = buildPaymentPayload(externalEventId, workspaceId);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(payload);
    const signature = signWebhook(timestamp, rawBody, hmacSecret);

    // Primeira requisição
    const first = await request(app)
      .post('/api/integrations/clinic/webhook')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect(first.status).toBe(202);
    const firstEventId = first.body.receivedEventId;

    // Segunda requisição com mesmo payload (replay real)
    const second = await request(app)
      .post('/api/integrations/clinic/webhook')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect(second.status).toBe(200);
    expect(String(second.body.message || '')).toContain('already processed');

    // Terceira requisição após 1s (ainda é idempotente)
    await new Promise((resolve) => setTimeout(resolve, 100));
    const third = await request(app)
      .post('/api/integrations/clinic/webhook')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect(third.status).toBe(200);
    expect(third.body.receivedEventId).toBe(firstEventId);
  });

  it('deve rejeitar reenvio com assinatura inválida mesmo se evento seria idempotente', async () => {
    const externalEventId = `evt-bad-sig-${Date.now()}`;
    const payload = buildPaymentPayload(externalEventId, workspaceId);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(payload);
    const signature = signWebhook(timestamp, rawBody, hmacSecret);

    // Requisição inicial com assinatura válida
    const first = await request(app)
      .post('/api/integrations/clinic/webhook')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', signature)
      .send(payload);

    expect(first.status).toBe(202);

    // Reenvio com assinatura inválida (não processa mesmo que seria idempotente)
    const second = await request(app)
      .post('/api/integrations/clinic/webhook')
      .set('x-integration-key', integrationKey)
      .set('x-integration-timestamp', timestamp)
      .set('x-integration-signature', 'sha256=invalid_signature')
      .send(payload);

    expect(second.status).toBe(401);
    expect(second.body.error).toBe('Invalid integration signature');
  });

  it('deve processar múltiplas requisições simultâneas do mesmo evento de forma thread-safe', async () => {
    // Evita interferência do rate limit neste cenário de concorrência/idempotência.
    process.env.CLINIC_AUTH_RATE_LIMIT_MAX = '10';
    resetRateLimitStore();

    const externalEventId = `evt-concurrent-${Date.now()}`;
    const payload = buildPaymentPayload(externalEventId, workspaceId);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(payload);
    const signature = signWebhook(timestamp, rawBody, hmacSecret);

    // Enviar 5 requisições em paralelo com mesmo payload
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/integrations/clinic/webhook')
          .set('x-integration-key', integrationKey)
          .set('x-integration-timestamp', timestamp)
          .set('x-integration-signature', signature)
          .send(payload),
      ),
    );

    const statuses = responses.map((res) => res.status);

    // Primeira deve ser 202, resto deve ser 200 (idempotência)
    const twoHundredTwos = statuses.filter((s) => s === 202).length;
    const twoHundreds = statuses.filter((s) => s === 200).length;

    expect(twoHundredTwos).toBeGreaterThanOrEqual(1);
    expect(twoHundredTwos + twoHundreds).toBe(5);

    // Todas devem ter recordado apenas 1 evento no domain log
    const domainEvents = await getDomainEvents({
      workspaceId,
      type: 'external.payment_received',
    });

    expect(domainEvents.length).toBe(1);
    expect(domainEvents[0]?.payload?.externalEventId).toBe(externalEventId);
  });
});
