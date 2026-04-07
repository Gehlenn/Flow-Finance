export function isApiDocsEnabled(nodeEnv = process.env.NODE_ENV || 'development'): boolean {
  return nodeEnv !== 'production';
}

type OpenApiSpec = Record<string, unknown>;

export function buildOpenApiSpec(): OpenApiSpec {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Flow Finance API',
      version: process.env.APP_VERSION || '0.6.3',
      description: 'Backend API for auth, workspace tenancy, sync, SaaS billing, AI, banking, and finance insights.',
    },
    servers: [
      {
        url: '/',
        description: 'Current environment',
      },
    ],
    tags: [
      { name: 'Auth' },
      { name: 'Tenant' },
      { name: 'Workspace' },
      { name: 'Sync' },
      { name: 'Finance' },
      { name: 'AI' },
      { name: 'SaaS' },
      { name: 'Integrations' },
      { name: 'Banking' },
      { name: 'Billing' },
      { name: 'Admin' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        WorkspaceHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'x-workspace-id',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
        Workspace: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            tenantId: { type: 'string', nullable: true },
            name: { type: 'string' },
            plan: { type: 'string' },
            role: { type: 'string' },
          },
        },
        SyncItem: {
          type: 'object',
          required: ['id', 'updatedAt'],
          properties: {
            id: { type: 'string' },
            clientId: { type: 'string' },
            updatedAt: { type: 'string', format: 'date-time' },
            deleted: { type: 'boolean' },
            payload: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        DomainEvent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workspaceId: { type: 'string' },
            tenantId: { type: 'string', nullable: true },
            userId: { type: 'string', nullable: true },
            aggregateId: { type: 'string', nullable: true },
            aggregateType: { type: 'string', nullable: true },
            type: { type: 'string' },
            payload: { type: 'object', additionalProperties: true },
            metadata: { type: 'object', additionalProperties: true },
            occurredAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Admin'],
          summary: 'Global health check',
          responses: {
            '200': { description: 'Healthy' },
            '503': { description: 'Degraded' },
          },
        },
      },
      '/api/health': {
        get: {
          tags: ['Admin'],
          summary: 'API liveness probe',
          responses: {
            '200': { description: 'Service reachable' },
          },
        },
      },
      '/api/version': {
        get: {
          tags: ['Admin'],
          summary: 'API version',
          responses: {
            '200': { description: 'Version payload' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Authenticated session' },
          },
        },
      },
      '/api/auth/firebase': {
        post: {
          tags: ['Auth'],
          summary: 'Exchange Firebase ID token for backend session',
          responses: { '200': { description: 'Authenticated session' } },
        },
      },
      '/api/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          responses: { '200': { description: 'Refreshed tokens' } },
        },
      },
      '/api/auth/validate': {
        get: {
          tags: ['Auth'],
          summary: 'Validate current access token',
          responses: { '200': { description: 'Session validation result' } },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout current session',
          responses: { '200': { description: 'Session invalidated' } },
        },
      },
      '/api/auth/oauth/google/start': {
        get: {
          tags: ['Auth'],
          summary: 'Start Google OAuth flow',
          responses: { '302': { description: 'Redirect to Google' } },
        },
      },
      '/api/auth/oauth/google/callback': {
        get: {
          tags: ['Auth'],
          summary: 'Handle Google OAuth callback',
          responses: { '200': { description: 'OAuth callback handled' } },
        },
      },
      '/api/tenant': {
        post: {
          tags: ['Tenant'],
          summary: 'Create tenant/workspace root',
          responses: { '201': { description: 'Tenant created' } },
        },
      },
      '/api/tenant/select': {
        post: {
          tags: ['Tenant'],
          summary: 'Select active tenant/workspace context',
          responses: { '200': { description: 'Active tenant selected' } },
        },
      },
      '/api/workspace': {
        post: {
          tags: ['Workspace'],
          summary: 'Create workspace',
          security: [{ BearerAuth: [] }],
          responses: { '201': { description: 'Workspace created' } },
        },
        get: {
          tags: ['Workspace'],
          summary: 'List workspaces for current user',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Workspace list' } },
        },
      },
      '/api/workspace/{workspaceId}/users': {
        post: {
          tags: ['Workspace'],
          summary: 'Add user to workspace',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          parameters: [
            { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '201': { description: 'Membership created' } },
        },
        get: {
          tags: ['Workspace'],
          summary: 'List workspace members',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          parameters: [
            { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Workspace members' } },
        },
      },
      '/api/workspace/{workspaceId}/users/{userId}': {
        delete: {
          tags: ['Workspace'],
          summary: 'Remove user from workspace',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          parameters: [
            { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '204': { description: 'Membership removed' } },
        },
      },
      '/api/sync/health': {
        get: {
          tags: ['Sync'],
          summary: 'Cloud sync backend health',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Sync store health' } },
        },
      },
      '/api/sync/push': {
        post: {
          tags: ['Sync'],
          summary: 'Push scoped entities to cloud sync',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['entity', 'items'],
                  properties: {
                    entity: { type: 'string', enum: ['accounts', 'transactions', 'goals', 'subscriptions'] },
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SyncItem' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Sync push result' },
          },
        },
      },
      '/api/sync/pull': {
        get: {
          tags: ['Sync'],
          summary: 'Pull scoped entities from cloud sync',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          parameters: [
            { name: 'since', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          ],
          responses: { '200': { description: 'Sync pull result' } },
        },
      },
      '/api/finance/metrics': {
        post: {
          tags: ['Finance'],
          summary: 'Compute finance metrics and timeline',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Metrics payload' } },
        },
      },
      '/api/finance/events': {
        post: {
          tags: ['Finance'],
          summary: 'Append domain event to event store',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DomainEvent' },
              },
            },
          },
          responses: { '201': { description: 'Event stored' } },
        },
        get: {
          tags: ['Finance'],
          summary: 'Query finance domain events',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Event list' } },
        },
      },
      '/api/saas/usage': {
        get: {
          tags: ['SaaS'],
          summary: 'Read workspace usage snapshot',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Usage snapshot' } },
        },
        put: {
          tags: ['SaaS'],
          summary: 'Upsert usage snapshot',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Usage updated' } },
        },
      },
      '/api/saas/usage/increment': {
        post: {
          tags: ['SaaS'],
          summary: 'Increment usage for a feature/resource',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Usage incremented' } },
        },
      },
      '/api/saas/usage/reset': {
        post: {
          tags: ['SaaS'],
          summary: 'Reset usage period',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Usage reset' } },
        },
      },
      '/api/saas/plans': {
        get: {
          tags: ['SaaS'],
          summary: 'List plan catalog for workspace',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Plan catalog' } },
        },
      },
      '/api/saas/metering': {
        get: {
          tags: ['SaaS'],
          summary: 'Read usage metering and events',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Metering data' } },
        },
      },
      '/api/saas/stripe/checkout-session': {
        post: {
          tags: ['SaaS'],
          summary: 'Create Stripe checkout session',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Checkout session' } },
        },
      },
      '/api/saas/stripe/portal-session': {
        post: {
          tags: ['SaaS'],
          summary: 'Create Stripe billing portal session',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Portal session' } },
        },
      },
      '/api/saas/plan': {
        post: {
          tags: ['SaaS'],
          summary: 'Change workspace plan',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Plan updated' } },
        },
      },
      '/api/saas/billing-hooks': {
        post: {
          tags: ['SaaS'],
          summary: 'Record billing hook event',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: { '200': { description: 'Billing hook recorded' } },
        },
      },
      '/api/saas/stripe/webhook': {
        post: {
          tags: ['SaaS'],
          summary: 'Stripe webhook receiver',
          responses: { '200': { description: 'Webhook accepted' } },
        },
      },
      '/api/integrations/external/events': {
        post: {
          tags: ['Integrations'],
          summary: 'Receive external operational/financial reflection events',
          parameters: [
            { name: 'x-integration-key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'x-integration-signature', in: 'header', required: false, schema: { type: 'string' } },
            { name: 'x-integration-timestamp', in: 'header', required: false, schema: { type: 'string' } },
          ],
          responses: {
            '202': { description: 'Event applied' },
            '200': { description: 'Duplicate ignored' },
            '400': { description: 'Validation failed' },
            '401': { description: 'Auth/signature failed' },
          },
        },
      },
      '/api/integrations/clinic/webhook': {
        post: {
          tags: ['Integrations'],
          summary: 'Receive clinic automation financial events (canonical v1 endpoint)',
          parameters: [
            { name: 'x-integration-key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'x-integration-signature', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'x-integration-timestamp', in: 'header', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '202': { description: 'Event applied' },
            '200': { description: 'Duplicate ignored' },
            '400': { description: 'Validation failed' },
            '401': { description: 'Auth/signature failed' },
            '429': { description: 'Rate limit reached' },
          },
        },
      },
      '/api/integrations/clinic/financial-events': {
        post: {
          tags: ['Integrations'],
          summary: 'Deprecated clinic ingestion endpoint kept for backward compatibility',
          deprecated: true,
          parameters: [
            { name: 'x-integration-key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'x-integration-signature', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'x-integration-timestamp', in: 'header', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '202': { description: 'Event applied' },
            '200': { description: 'Duplicate ignored' },
            '400': { description: 'Validation failed' },
            '401': { description: 'Auth/signature failed' },
            '429': { description: 'Rate limit reached' },
          },
        },
      },
      '/api/integrations/clinic/health': {
        get: {
          tags: ['Integrations'],
          summary: 'Health check for clinic automation ingest pipeline',
          parameters: [
            { name: 'x-integration-key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'x-integration-signature', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'x-integration-timestamp', in: 'header', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Healthy' },
            '401': { description: 'Auth/signature failed' },
            '429': { description: 'Rate limit reached' },
            '503': { description: 'Unhealthy dependency or safeguards state' },
          },
        },
      },
      '/api/ai/cfo': { post: { tags: ['AI'], summary: 'Generate CFO analysis', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'CFO response' } } } },
      '/api/ai/interpret': { post: { tags: ['AI'], summary: 'Interpret natural language into finance actions', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Interpretation result' } } } },
      '/api/ai/scan-receipt': { post: { tags: ['AI'], summary: 'OCR receipt scan', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Scanned receipt fields' } } } },
      '/api/ai/classify-transactions': { post: { tags: ['AI'], summary: 'Categorize transactions', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Classification result' } } } },
      '/api/ai/insights': { post: { tags: ['AI'], summary: 'Generate AI insights', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Insight list' } } } },
      '/api/ai/token-count': { post: { tags: ['AI'], summary: 'Estimate token count', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Token estimate' } } } },
      '/api/banking/health': { get: { tags: ['Banking'], summary: 'Banking provider health', responses: { '200': { description: 'Provider health' } } } },
      '/api/banking/banks': { get: { tags: ['Banking'], summary: 'List supported banks', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Bank list' } } } },
      '/api/banking/connectors': { get: { tags: ['Banking'], summary: 'List banking connectors', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Connector list' } } } },
      '/api/banking/connections': { get: { tags: ['Banking'], summary: 'List banking connections', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Connection list' } } } },
      '/api/banking/connect-token': { post: { tags: ['Banking'], summary: 'Create bank connect token', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Connect token' } } } },
      '/api/banking/connect': { post: { tags: ['Banking'], summary: 'Create banking connection', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Connection created' } } } },
      '/api/banking/migrate/firebase': { post: { tags: ['Banking'], summary: 'Migrate banking data from Firebase', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Migration result' } } } },
      '/api/banking/sync': { post: { tags: ['Banking'], summary: 'Sync banking connection', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Sync result' } } } },
      '/api/banking/disconnect': { post: { tags: ['Banking'], summary: 'Disconnect banking connection', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Disconnected' } } } },
      '/api/banking/webhooks/pluggy': { post: { tags: ['Banking'], summary: 'Pluggy webhook receiver', responses: { '200': { description: 'Webhook accepted' } } } },
      '/api/billing/subscription': { post: { tags: ['Billing'], summary: 'Create or change subscription', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Subscription updated' } } } },
      '/api/billing/export': { get: { tags: ['Billing'], summary: 'Export workspace data', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Export link' } } } },
      '/api/admin/users': { get: { tags: ['Admin'], summary: 'List workspace users', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'User list' } } } },
      '/api/admin/audit-logs': { get: { tags: ['Admin'], summary: 'List audit logs', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Audit log list' } } } },
      '/api/admin/audit-logs/export': { get: { tags: ['Admin'], summary: 'Export audit logs', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Audit export' } } } },
      '/api/admin/usage-metering': { get: { tags: ['Admin'], summary: 'List workspace metering', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Usage metering' } } } },
      '/api/admin/usage-metering/export': { get: { tags: ['Admin'], summary: 'Export workspace metering', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Usage export' } } } },
    },
  };
}

export function renderSwaggerHtml(specUrl = '/api/openapi.json'): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flow Finance API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    </script>
  </body>
</html>`;
}
