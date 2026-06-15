import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('global API rate limiter routing', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_MAX_REQUESTS = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-chars';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('skips health, version, firebase session, and workspace bootstrap routes', async () => {
    const { apiLimiter } = await import('../../src/middleware/rateLimit');
    const app = express();
    app.use(express.json());
    app.use(apiLimiter);
    app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
    app.get('/api/health', (_req, res) => res.status(200).json({ ok: true }));
    app.get('/api/version', (_req, res) => res.status(200).json({ ok: true }));
    app.post('/api/auth/firebase', (_req, res) => res.status(200).json({ ok: true }));
    app.get('/api/workspace', (_req, res) => res.status(200).json({ ok: true }));
    app.post('/api/workspace', (_req, res) => res.status(201).json({ ok: true }));

    await request(app).get('/health').expect(200);
    await request(app).get('/health').expect(200);

    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/health').expect(200);

    await request(app).get('/api/version').expect(200);
    await request(app).get('/api/version').expect(200);

    await request(app).post('/api/auth/firebase').send({ idToken: 'x' }).expect(200);
    await request(app).post('/api/auth/firebase').send({ idToken: 'x' }).expect(200);

    await request(app).get('/api/workspace').expect(200);
    await request(app).get('/api/workspace').expect(200);

    await request(app).post('/api/workspace').send({ name: 'WS' }).expect(201);
    await request(app).post('/api/workspace').send({ name: 'WS' }).expect(201);
  });

  it('still limits generic routes by IP', async () => {
    const { apiLimiter } = await import('../../src/middleware/rateLimit');
    const app = express();
    app.use(apiLimiter);
    app.get('/api/other', (_req, res) => res.status(200).json({ ok: true }));

    await request(app).get('/api/other').expect(200);
    await request(app).get('/api/other').expect(429);
  });
});
