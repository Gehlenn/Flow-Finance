import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  isTrustedStateChangingOrigin,
  requireTrustedCookieStateChangingOrigin,
} from '../../src/middleware/csrfOrigin';

describe('csrf origin guard', () => {
  it('allows configured production frontend origins', () => {
    expect(isTrustedStateChangingOrigin({
      nodeEnv: 'production',
      origin: 'https://app.flowfinance.test',
      allowedOrigins: 'https://app.flowfinance.test',
    })).toBe(true);
  });

  it('rejects unknown production origins', () => {
    expect(isTrustedStateChangingOrigin({
      nodeEnv: 'production',
      origin: 'https://evil.example.com',
      allowedOrigins: 'https://app.flowfinance.test',
    })).toBe(false);
  });

  it('uses referer origin when origin header is absent', () => {
    expect(isTrustedStateChangingOrigin({
      nodeEnv: 'production',
      referer: 'https://app.flowfinance.test/settings?tab=billing',
      allowedOrigins: 'https://app.flowfinance.test',
    })).toBe(true);
  });

  it('keeps non-browser calls without origin or referer compatible', () => {
    expect(isTrustedStateChangingOrigin({
      nodeEnv: 'production',
      allowedOrigins: 'https://app.flowfinance.test',
    })).toBe(true);
  });

  it('can reject missing browser origin for cookie-authenticated state changes', () => {
    expect(isTrustedStateChangingOrigin({
      nodeEnv: 'production',
      allowedOrigins: 'https://app.flowfinance.test',
      allowMissingOrigin: false,
    })).toBe(false);
  });

  it('rejects cookie-authenticated state changes without trusted origin evidence', async () => {
    const app = express();
    app.use(requireTrustedCookieStateChangingOrigin);
    app.post('/api/sync/push', (_req, res) => res.json({ ok: true }));

    const response = await request(app)
      .post('/api/sync/push')
      .set('Cookie', 'flow_access_token=token-1')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: 'Origem nao autorizada' });
  });

  it('allows bearer-authenticated state changes without cookie CSRF coupling', async () => {
    const app = express();
    app.use(requireTrustedCookieStateChangingOrigin);
    app.post('/api/sync/push', (_req, res) => res.json({ ok: true }));

    const response = await request(app)
      .post('/api/sync/push')
      .set('Authorization', 'Bearer token-1')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ ok: true });
  });

  it('allows cookie-authenticated state changes from configured frontend origin', async () => {
    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'https://app.flowfinance.test';
    const app = express();
    app.use(requireTrustedCookieStateChangingOrigin);
    app.post('/api/sync/push', (_req, res) => res.json({ ok: true }));

    try {
      const response = await request(app)
        .post('/api/sync/push')
        .set('Cookie', 'flow_access_token=token-1')
        .set('Origin', 'https://app.flowfinance.test')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({ ok: true });
    } finally {
      if (originalAllowedOrigins === undefined) {
        delete process.env.ALLOWED_ORIGINS;
      } else {
        process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
      }
    }
  });
});
