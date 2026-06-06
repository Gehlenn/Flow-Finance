import cors from 'cors';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: loggerMocks.warn,
    info: loggerMocks.info,
  },
}));

import { createCorsOptions } from '../../src/config/cors';

function buildApp() {
  const app = express();
  const corsOptions = createCorsOptions({
    nodeEnv: 'production',
    allowedOrigins: 'https://app.flow-finance.com',
  });

  app.use(cors(corsOptions));
  app.get('/api/version', (_req, res) => res.status(200).json({ ok: true }));
  app.get('/api/health', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/api/auth/firebase', (_req, res) => res.status(200).json({ ok: true }));

  return app;
}

describe('CORS preflight for public and auth routes', () => {
  it.each([
    { path: '/api/version', method: 'GET' as const },
    { path: '/api/health', method: 'GET' as const },
    { path: '/api/auth/firebase', method: 'POST' as const },
  ])('allows Sentry tracing headers for %s', async ({ path, method }) => {
    const app = buildApp();
    const origin = 'https://app.flow-finance.com';

    const response = await request(app)
      .options(path)
      .set('Origin', origin)
      .set('Access-Control-Request-Method', method)
      .set('Access-Control-Request-Headers', 'content-type,sentry-trace,baggage,x-client-version');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);

    const allowHeaders = String(response.headers['access-control-allow-headers'] || '');
    expect(allowHeaders).toContain('sentry-trace');
    expect(allowHeaders).toContain('baggage');
    expect(allowHeaders).toContain('X-Client-Version');
  });
});
