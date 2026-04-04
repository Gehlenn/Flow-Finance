import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../index';
import { buildOpenApiSpec, isApiDocsEnabled, renderSwaggerHtml } from './openapi';

describe('openapi docs', () => {
  it('exposes core mounted routes in the generated spec', () => {
    const spec = buildOpenApiSpec() as { paths: Record<string, unknown> };

    expect(spec.paths['/api/auth/login']).toBeDefined();
    expect(spec.paths['/api/sync/push']).toBeDefined();
    expect(spec.paths['/api/finance/events']).toBeDefined();
    expect(spec.paths['/api/saas/usage/increment']).toBeDefined();
    expect(spec.paths['/api/integrations/external/events']).toBeDefined();
    expect(spec.paths['/api/workspace/{workspaceId}/users']).toBeDefined();
  });

  it('enables docs outside production and disables in production', () => {
    expect(isApiDocsEnabled('development')).toBe(true);
    expect(isApiDocsEnabled('test')).toBe(true);
    expect(isApiDocsEnabled('staging')).toBe(true);
    expect(isApiDocsEnabled('production')).toBe(false);
  });

  it('renders swagger html wired to the json spec endpoint', () => {
    const html = renderSwaggerHtml('/api/openapi.json');
    expect(html).toContain('/api/openapi.json');
    expect(html).toContain('swagger-ui');
  });

  it('serves openapi json in test environment', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/api/auth/login']).toBeDefined();
  });
});
