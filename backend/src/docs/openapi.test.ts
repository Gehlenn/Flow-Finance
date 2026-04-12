import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../index';
import { buildOpenApiSpec, isApiDocsEnabled, renderSwaggerHtml } from './openapi';

describe('openapi docs', () => {
  it('exposes core mounted routes in the generated spec', () => {
    const spec = buildOpenApiSpec() as {
      paths: Record<string, {
        get?: {
          description?: string;
          parameters?: Array<{ name?: string; description?: string }>;
          requestBody?: unknown;
          responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
        };
        post?: {
          description?: string;
          parameters?: Array<{ name?: string; description?: string }>;
          requestBody?: unknown;
          responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
        };
        put?: {
          requestBody?: unknown;
          responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
        };
      }>;
    };

    expect(spec.paths['/api/auth/login']).toBeDefined();
    expect(spec.paths['/api/sync/push']).toBeDefined();
    expect(spec.paths['/api/finance/events']).toBeDefined();
    expect(spec.paths['/api/saas/usage/increment']).toBeDefined();
    expect(spec.paths['/api/integrations/external/events']).toBeDefined();
    expect(spec.paths['/api/integrations/transactions']).toBeDefined();
    expect(spec.paths['/api/integrations/reminders']).toBeDefined();
    expect(spec.paths['/api/integrations/clinic/webhook']).toBeDefined();
    expect(spec.paths['/api/integrations/clinic/financial-events']).toBeDefined();
    expect(spec.paths['/api/integrations/clinic/health']).toBeDefined();
    expect(spec.paths['/api/workspace/{workspaceId}/users']).toBeDefined();

    expect(spec.paths['/api/integrations/transactions'].post?.requestBody).toBeDefined();
    expect(spec.paths['/api/integrations/transactions'].post?.responses?.['503']).toBeDefined();
    expect(spec.paths['/api/integrations/reminders'].post?.requestBody).toBeDefined();
    expect(spec.paths['/api/integrations/reminders'].post?.responses?.['503']).toBeDefined();

    const transactionParams = spec.paths['/api/integrations/transactions'].post?.parameters ?? [];
    const reminderParams = spec.paths['/api/integrations/reminders'].post?.parameters ?? [];
    const txnIdempotency = transactionParams.find((param) => param.name === 'Idempotency-Key');
    const remIdempotency = reminderParams.find((param) => param.name === 'Idempotency-Key');

    expect(txnIdempotency?.description).toContain('sourceSystem + externalRecordId');
    expect(remIdempotency?.description).toContain('sourceSystem + externalRecordId');
    expect(spec.paths['/api/integrations/transactions'].post?.description).toContain('materialized as reminders');
    expect(spec.paths['/api/auth/oauth/google/start'].get?.responses?.['200']?.content?.['application/json']?.schema?.$ref)
      .toBe('#/components/schemas/GoogleOAuthStartResponse');
    expect(spec.paths['/api/auth/oauth/google/start'].get?.responses?.['302']).toBeUndefined();
    expect(spec.paths['/api/auth/oauth/google/callback'].get?.responses?.['200']?.content?.['application/json']?.schema?.$ref)
      .toBe('#/components/schemas/OAuthCallbackResponse');
    expect(spec.paths['/api/saas/usage'].get?.responses?.['200']?.content?.['application/json']?.schema?.$ref)
      .toBe('#/components/schemas/WorkspaceUsageResponse');
    expect(spec.paths['/api/saas/usage'].put?.requestBody).toBeDefined();
    expect(spec.paths['/api/saas/stripe/checkout-session'].post?.requestBody).toBeDefined();
    expect(spec.paths['/api/saas/stripe/checkout-session'].post?.responses?.['200']?.content?.['application/json']?.schema?.$ref)
      .toBe('#/components/schemas/StripeCheckoutResponse');
    expect(spec.paths['/api/saas/stripe/portal-session'].post?.responses?.['200']?.content?.['application/json']?.schema?.$ref)
      .toBe('#/components/schemas/StripePortalResponse');
    expect(spec.paths['/api/saas/billing-hooks'].post?.requestBody).toBeDefined();
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
