import { PLAN_IDS } from '../../shared/saasCatalog';
import { SYNC_ENTITIES } from '../validation/sync.schema';

const AI_IDEMPOTENCY_KEY_HEADER = {
  name: 'Idempotency-Key',
  in: 'header',
  required: false,
  schema: { type: 'string', minLength: 1, maxLength: 128 },
  description: 'Required in production when FIRESTORE_AI_USAGE_AUTHORITY_ENABLED=true. Replays are blocked before provider execution.',
};

const AI_QUOTA_ERROR_RESPONSES = {
  '400': { description: 'Invalid payload or missing/invalid Idempotency-Key' },
  '409': { description: 'Idempotency-Key replay or conflict' },
  '429': { description: 'Monthly AI quota reached' },
  '503': { description: 'AI quota authority unavailable' },
};

export const OPENAPI_COMPONENTS = {
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
        AuthUser: {
          type: 'object',
          required: ['userId', 'email'],
          properties: {
            userId: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            picture: { type: 'string', format: 'uri' },
            emailVerified: { type: 'boolean' },
          },
        },
        AuthSessionResponse: {
          type: 'object',
          required: ['token', 'accessToken', 'refreshToken', 'expiresIn', 'refreshExpiresIn', 'user'],
          properties: {
            token: { type: 'string' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer' },
            refreshExpiresIn: { type: 'integer' },
            user: { $ref: '#/components/schemas/AuthUser' },
          },
        },
        AuthRefreshRequest: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        AuthRefreshResponse: {
          type: 'object',
          required: ['token', 'accessToken', 'expiresIn'],
          properties: {
            token: { type: 'string' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer' },
            refreshExpiresIn: { type: 'integer' },
          },
        },
        AuthValidationResponse: {
          type: 'object',
          required: ['valid'],
          properties: {
            valid: { type: 'boolean' },
            user: { $ref: '#/components/schemas/AuthUser' },
            expiresIn: { type: 'integer' },
          },
        },
        AuthLogoutResponse: {
          type: 'object',
          required: ['success', 'revokedRefreshTokens', 'message'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            revokedRefreshTokens: { type: 'integer' },
            message: { type: 'string' },
          },
        },
        FirebaseSessionRequest: {
          type: 'object',
          required: ['idToken'],
          properties: {
            idToken: { type: 'string' },
          },
        },
        GoogleOAuthStartResponse: {
          type: 'object',
          required: ['provider', 'authUrl', 'state', 'expiresIn', 'mockMode'],
          properties: {
            provider: { type: 'string', enum: ['google'] },
            authUrl: { type: 'string', format: 'uri' },
            state: { type: 'string' },
            expiresIn: { type: 'integer' },
            mockMode: { type: 'boolean' },
          },
        },
        OAuthCallbackResponse: {
          allOf: [
            { $ref: '#/components/schemas/AuthSessionResponse' },
            {
              type: 'object',
              required: ['oauth'],
              properties: {
                oauth: {
                  type: 'object',
                  required: ['provider', 'linked'],
                  properties: {
                    provider: { type: 'string', enum: ['google'] },
                    linked: { type: 'boolean', enum: [true] },
                  },
                },
              },
            },
          ],
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
        SyncConflict: {
          type: 'object',
          required: ['id', 'reason', 'incomingUpdatedAt', 'existingUpdatedAt', 'resolution'],
          properties: {
            id: { type: 'string' },
            reason: {
              type: 'string',
              enum: ['stale_client_update', 'same_timestamp_divergent_payload', 'invalid_updated_at'],
            },
            incomingUpdatedAt: { type: 'string', format: 'date-time' },
            existingUpdatedAt: { type: 'string', format: 'date-time' },
            resolution: {
              type: 'string',
              enum: ['preserved_existing'],
            },
          },
        },
        SyncPushResult: {
          type: 'object',
          required: ['success', 'upserted', 'deleted', 'latestServerUpdatedAt', 'reconciledIds', 'conflictPolicy', 'conflicts'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            upserted: { type: 'integer' },
            deleted: { type: 'integer' },
            latestServerUpdatedAt: { type: 'string', format: 'date-time' },
            conflictPolicy: {
              type: 'string',
              enum: ['client-updated-at-last-write-wins'],
            },
            reconciledIds: {
              type: 'array',
              items: {
                type: 'object',
                required: ['clientId', 'serverId'],
                properties: {
                  clientId: { type: 'string' },
                  serverId: { type: 'string' },
                },
              },
            },
            conflicts: {
              type: 'array',
              items: { $ref: '#/components/schemas/SyncConflict' },
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
        UsageSnapshot: {
          type: 'object',
          required: ['transactions', 'aiQueries', 'bankConnections'],
          properties: {
            transactions: { type: 'integer', minimum: 0 },
            aiQueries: { type: 'integer', minimum: 0 },
            bankConnections: { type: 'integer', minimum: 0 },
          },
        },
        UsageMap: {
          type: 'object',
          additionalProperties: { $ref: '#/components/schemas/UsageSnapshot' },
        },
        WorkspaceUsageResponse: {
          type: 'object',
          required: ['scope', 'workspaceId', 'usage'],
          properties: {
            scope: { type: 'string', enum: ['workspace'] },
            workspaceId: { type: 'string' },
            currentMonthKey: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
            plan: { type: 'string', enum: PLAN_IDS },
            usage: { $ref: '#/components/schemas/UsageMap' },
          },
        },
        PlanCatalogEntry: {
          type: 'object',
          required: ['id', 'name', 'priceMonthlyCents', 'currency', 'limits', 'features'],
          properties: {
            id: { type: 'string', enum: PLAN_IDS },
            name: { type: 'string' },
            priceMonthlyCents: { type: 'integer', minimum: 0 },
            currency: { type: 'string', enum: ['BRL'] },
            limits: { $ref: '#/components/schemas/UsageSnapshot' },
            features: { type: 'array', items: { type: 'string' } },
          },
        },
        PlanCatalogResponse: {
          type: 'object',
          required: [
            'scope',
            'workspaceId',
            'currentPlan',
            'mockBillingEnabled',
            'stripeConfigured',
            'stripePortalEnabled',
            'hasBillingCustomer',
            'billingProvider',
            'manualPlanChangeAllowed',
            'plans',
          ],
          properties: {
            scope: { type: 'string', enum: ['workspace'] },
            workspaceId: { type: 'string' },
            currentPlan: { type: 'string', enum: PLAN_IDS },
            mockBillingEnabled: { type: 'boolean' },
            stripeConfigured: { type: 'boolean' },
            stripePortalEnabled: { type: 'boolean' },
            hasBillingCustomer: { type: 'boolean' },
            billingProvider: { type: 'string', enum: ['stripe', 'mock', 'none'] },
            manualPlanChangeAllowed: { type: 'boolean' },
            plans: { type: 'array', items: { $ref: '#/components/schemas/PlanCatalogEntry' } },
          },
        },
        MeteringEvent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
            resource: { type: 'string', enum: ['transactions', 'aiQueries', 'bankConnections'] },
            amount: { type: 'integer', minimum: 0 },
            at: { type: 'string', format: 'date-time' },
            metadata: { type: 'object', additionalProperties: true },
          },
        },
        MeteringCostCoverage: {
          type: 'object',
          properties: {
            aiQueries: {
              type: 'object',
              required: ['status', 'reason'],
              properties: {
                status: { type: 'string', enum: ['partial', 'unavailable'] },
                reason: { type: 'string' },
              },
            },
          },
        },
        MeteringResponse: {
          type: 'object',
          required: ['scope', 'workspaceId', 'filters', 'summary', 'events'],
          properties: {
            scope: { type: 'string', enum: ['workspace'] },
            workspaceId: { type: 'string' },
            filters: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                resource: { type: 'string', enum: ['transactions', 'aiQueries', 'bankConnections'] },
              },
            },
            summary: {
              type: 'object',
              properties: {
                costCoverage: {
                  $ref: '#/components/schemas/MeteringCostCoverage',
                  description: 'Present only while the Firestore AI usage authority is enabled. Its current-month reservation events do not contain provider token metadata, so AI cost estimates are incomplete or unavailable.',
                },
              },
              additionalProperties: true,
            },
            events: { type: 'array', items: { $ref: '#/components/schemas/MeteringEvent' } },
          },
        },
        StripeCheckoutRequest: {
          type: 'object',
          required: ['returnUrl'],
          properties: {
            returnUrl: { type: 'string', format: 'uri' },
          },
        },
        StripeCheckoutResponse: {
          type: 'object',
          required: ['id', 'url'],
          properties: {
            id: { type: 'string' },
            url: { type: 'string', nullable: true, format: 'uri' },
          },
        },
        StripePortalRequest: {
          type: 'object',
          required: ['returnUrl'],
          properties: {
            returnUrl: { type: 'string', format: 'uri' },
          },
        },
        StripePortalResponse: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', format: 'uri' },
          },
        },
        WorkspacePlanChangeRequest: {
          type: 'object',
          required: ['plan'],
          properties: {
            workspaceId: { type: 'string' },
            plan: { type: 'string', enum: PLAN_IDS },
          },
        },
        WorkspacePlanChangeResponse: {
          type: 'object',
          required: ['scope', 'workspaceId', 'previousPlan', 'currentPlan', 'changed', 'source'],
          properties: {
            scope: { type: 'string', enum: ['workspace'] },
            workspaceId: { type: 'string' },
            previousPlan: { type: 'string', enum: PLAN_IDS },
            currentPlan: { type: 'string', enum: PLAN_IDS },
            changed: { type: 'boolean' },
            source: { type: 'string', enum: ['mock_api', 'billing_hook'] },
          },
        },
        BillingHookRequest: {
          type: 'object',
          required: ['plan', 'event', 'amount', 'at'],
          properties: {
            workspaceId: { type: 'string' },
            plan: { type: 'string', enum: PLAN_IDS },
            event: { type: 'string', enum: ['usage_recorded', 'limit_reached', 'upgrade_required', 'plan_changed'] },
            resource: { type: 'string', enum: ['transactions', 'aiQueries', 'bankConnections'] },
            amount: { type: 'number', minimum: 0 },
            at: { type: 'string' },
            metadata: { type: 'object', additionalProperties: true },
          },
        },
        BillingHookResponse: {
          type: 'object',
          required: ['success', 'scope', 'workspaceId', 'currentPlan', 'changed', 'events'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            scope: { type: 'string', enum: ['workspace'] },
            workspaceId: { type: 'string' },
            currentPlan: { type: 'string', enum: PLAN_IDS },
            changed: { type: 'boolean' },
            events: { type: 'integer', minimum: 0 },
          },
        },
        StripeWebhookResponse: {
          type: 'object',
          required: ['received'],
          properties: {
            received: { type: 'boolean', enum: [true] },
          },
        },
        BusinessIntegrationResult: {
          type: 'object',
          required: ['ok', 'workspaceId', 'sourceSystem', 'externalRecordId', 'action'],
          properties: {
            ok: { type: 'boolean', enum: [true] },
            workspaceId: { type: 'string' },
            sourceSystem: { type: 'string' },
            externalRecordId: { type: 'string' },
            action: { type: 'string', enum: ['created', 'updated', 'replayed'] },
            entity: { type: 'string', enum: ['transaction', 'reminder'] },
            storedAs: { type: 'string', enum: ['transactions', 'reminders'] },
          },
        },
        BusinessIntegrationErrorResponse: {
          type: 'object',
          required: ['ok', 'error', 'message'],
          properties: {
            ok: { type: 'boolean', enum: [false] },
            error: {
              type: 'string',
              enum: ['validation_error', 'unauthorized', 'forbidden', 'integration_unavailable'],
            },
            message: { type: 'string' },
          },
        },
        BusinessIntegrationTransactionRequest: {
          type: 'object',
          required: ['workspaceId', 'sourceSystem', 'externalRecordId', 'type', 'amount', 'currency', 'occurredAt', 'description', 'status'],
          properties: {
            workspaceId: { type: 'string' },
            sourceSystem: { type: 'string' },
            externalRecordId: { type: 'string' },
            integrationId: { type: 'string' },
            externalCustomerId: { type: 'string', description: 'Technical external reference only. Never send CPF, email or phone.' },
            type: {
              type: 'string',
              enum: ['income', 'expense', 'receivable', 'payable'],
              description: 'Use receivable/payable for values that can remain open before confirmation.',
            },
            amount: { type: 'number', exclusiveMinimum: 0 },
            currency: { type: 'string', pattern: '^[A-Z]{3}$' },
            occurredAt: { type: 'string', format: 'date-time' },
            description: { type: 'string' },
            status: {
              type: 'string',
              enum: ['confirmed', 'pending', 'overdue'],
              description: 'income/expense must be confirmed. receivable/payable with pending/overdue are materialized as reminders.',
            },
            category: { type: 'string' },
            subcategory: { type: 'string' },
            counterpartyLabel: { type: 'string' },
            notes: { type: 'string' },
            dueAt: {
              type: 'string',
              format: 'date-time',
              description: 'Required when type is receivable/payable and status is pending/overdue.',
            },
            referenceDate: { type: 'string', format: 'date-time' },
            metadata: {
              type: 'object',
              additionalProperties: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                  { type: 'boolean' },
                  { type: 'null' },
                ],
              },
            },
          },
        },
        BusinessIntegrationReminderRequest: {
          type: 'object',
          required: ['workspaceId', 'sourceSystem', 'externalRecordId', 'title', 'remindAt', 'kind', 'status'],
          properties: {
            workspaceId: { type: 'string' },
            sourceSystem: { type: 'string' },
            externalRecordId: { type: 'string' },
            title: { type: 'string' },
            remindAt: { type: 'string', format: 'date-time' },
            kind: { type: 'string', enum: ['financial', 'operational'] },
            status: { type: 'string', enum: ['active', 'completed', 'canceled'] },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            relatedTransactionExternalId: { type: 'string' },
            integrationId: { type: 'string' },
            externalCustomerId: { type: 'string', description: 'Technical external reference only. Never send CPF, email or phone.' },
            metadata: {
              type: 'object',
              additionalProperties: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                  { type: 'boolean' },
                  { type: 'null' },
                ],
              },
            },
          },
        },
      },
    };

export const OPENAPI_PATHS = {
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
          description: 'Legacy local login. In production this flow may be disabled unless secure credential verification is explicitly enabled.',
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
                    userId: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Authenticated session', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } } } },
            '400': { description: 'Email or password missing', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '503': { description: 'Local email/password login disabled or secure verifier not configured', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/auth/firebase': {
        post: {
          tags: ['Auth'],
          summary: 'Exchange Firebase ID token for backend session',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FirebaseSessionRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Authenticated session', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } } } },
            '400': { description: 'Firebase idToken missing', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '401': { description: 'Invalid Firebase identity token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '503': { description: 'Firebase identity verification not configured on backend', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          description: 'Supports refresh-token rotation by body/cookie and a backward-compatible access-token path through Authorization header.',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthRefreshRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Refreshed tokens', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRefreshResponse' } } } },
            '401': { description: 'Refresh token invalid, expired or authorization missing', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/auth/validate': {
        get: {
          tags: ['Auth'],
          summary: 'Validate current access token',
          responses: {
            '200': {
              description: 'Session validation result',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthValidationResponse' },
                },
              },
            },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout current session',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthRefreshRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Session invalidated', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthLogoutResponse' } } } },
            '401': { description: 'Authorization required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/auth/oauth/google/start': {
        get: {
          tags: ['Auth'],
          summary: 'Start Google OAuth flow',
          parameters: [
            { name: 'redirectUri', in: 'query', required: false, schema: { type: 'string', format: 'uri' } },
          ],
          responses: {
            '200': { description: 'OAuth start payload with provider URL and state', content: { 'application/json': { schema: { $ref: '#/components/schemas/GoogleOAuthStartResponse' } } } },
            '400': { description: 'Invalid redirectUri', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '500': { description: 'OAuth start misconfiguration or provider setup failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/auth/oauth/google/callback': {
        get: {
          tags: ['Auth'],
          summary: 'Handle Google OAuth callback',
          parameters: [
            { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'state', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'OAuth callback handled', content: { 'application/json': { schema: { $ref: '#/components/schemas/OAuthCallbackResponse' } } } },
            '400': { description: 'Missing code/state or provider callback failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '401': { description: 'Invalid or expired OAuth state', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '500': { description: 'OAuth callback failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/tenant': {
        post: {
          tags: ['Tenant'],
          summary: 'Create tenant/workspace root',
          security: [{ BearerAuth: [] }],
          responses: { '201': { description: 'Tenant created' } },
        },
      },
      '/api/tenant/select': {
        post: {
          tags: ['Tenant'],
          summary: 'Select active tenant/workspace context',
          security: [{ BearerAuth: [] }],
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
                    entity: { type: 'string', enum: SYNC_ENTITIES },
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
            '200': {
              description: 'Sync push result with explicit conflict policy and conflict details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SyncPushResult' },
                },
              },
            },
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
          responses: {
            '200': { description: 'Usage snapshot', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkspaceUsageResponse' } } } },
            '400': { description: 'workspaceId missing', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '403': { description: 'Workspace access denied', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '503': { description: 'AI usage authority unavailable during enabled cutover', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/saas/plans': {
        get: {
          tags: ['SaaS'],
          summary: 'List plan catalog for workspace',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: {
            '200': { description: 'Plan catalog', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlanCatalogResponse' } } } },
            '400': { description: 'workspaceId missing', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '403': { description: 'Workspace access denied', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '404': { description: 'Workspace not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/saas/metering': {
        get: {
          tags: ['SaaS'],
          summary: 'Read usage metering and events',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          parameters: [
            { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'ISO 8601 timestamp with timezone; must be earlier than or equal to to.' },
            { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'ISO 8601 timestamp with timezone; must be later than or equal to from.' },
            { name: 'resource', in: 'query', required: false, schema: { type: 'string', enum: ['transactions', 'aiQueries', 'bankConnections'] } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
          ],
          responses: {
            '200': { description: 'Metering data', content: { 'application/json': { schema: { $ref: '#/components/schemas/MeteringResponse' } } } },
            '400': { description: 'workspaceId missing or invalid metering date range', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '403': { description: 'Workspace access denied', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '503': { description: 'AI usage authority unavailable during enabled cutover', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/saas/stripe/checkout-session': {
        post: {
          tags: ['SaaS'],
          summary: 'Create Stripe checkout session',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StripeCheckoutRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Checkout session', content: { 'application/json': { schema: { $ref: '#/components/schemas/StripeCheckoutResponse' } } } },
            '400': { description: 'Invalid returnUrl or missing workspaceId', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '403': { description: 'Workspace access denied', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '404': { description: 'Workspace not found for billing context', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '409': { description: 'Multiple workspaces require explicit workspaceId', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '502': { description: 'Stripe API error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '503': { description: 'Stripe secret or price configuration missing', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/saas/stripe/portal-session': {
        post: {
          tags: ['SaaS'],
          summary: 'Create Stripe billing portal session',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StripePortalRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Portal session', content: { 'application/json': { schema: { $ref: '#/components/schemas/StripePortalResponse' } } } },
            '400': { description: 'Invalid returnUrl or missing workspaceId', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '403': { description: 'Workspace access denied', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '404': { description: 'Workspace or Stripe customer not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '409': { description: 'Multiple workspaces require explicit workspaceId', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '502': { description: 'Stripe API error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '503': { description: 'Stripe secret configuration missing', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/saas/plan': {
        post: {
          tags: ['SaaS'],
          summary: 'Change workspace plan',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkspacePlanChangeRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Plan updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkspacePlanChangeResponse' } } } },
            '400': { description: 'Invalid plan or missing workspaceId', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '403': { description: 'Workspace access denied or mock billing disabled', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '404': { description: 'Workspace not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/saas/billing-hooks': {
        get: {
          tags: ['SaaS'],
          summary: 'List authoritative workspace billing hook events',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          responses: {
            '200': {
              description: 'Workspace billing hooks',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['scope', 'workspaceId', 'hooks'],
                    properties: {
                      scope: { type: 'string', enum: ['workspace'] },
                      workspaceId: { type: 'string' },
                      hooks: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    },
                  },
                },
              },
            },
            '403': { description: 'Workspace access denied', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '404': { description: 'Workspace not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        post: {
          tags: ['SaaS'],
          summary: 'Record a mock billing hook event',
          description: 'Mock/test-only endpoint. Production billing state is synchronized from signed Stripe webhooks.',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BillingHookRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Billing hook recorded', content: { 'application/json': { schema: { $ref: '#/components/schemas/BillingHookResponse' } } } },
            '400': { description: 'Billing hook payload invalid or missing workspaceId', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '403': { description: 'Workspace access denied or mock billing disabled', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '404': { description: 'Workspace not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/saas/stripe/webhook': {
        post: {
          tags: ['SaaS'],
          summary: 'Stripe webhook receiver',
          parameters: [
            { name: 'stripe-signature', in: 'header', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          responses: {
            '200': { description: 'Webhook accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/StripeWebhookResponse' } } } },
            '400': { description: 'Invalid Stripe webhook JSON payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '401': { description: 'Invalid Stripe webhook signature', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '503': { description: 'Stripe webhook secret missing', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
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
      '/api/integrations/transactions': {
        post: {
          tags: ['Integrations'],
          summary: 'Ingest a lightweight business transaction payload',
          description: 'Confirmed transactions are stored as transactions. Receivable/payable with pending or overdue status are materialized as reminders to avoid inflating confirmed cash flow.',
          parameters: [
            { name: 'x-integration-key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'x-integration-timestamp', in: 'header', required: false, schema: { type: 'string' } },
            { name: 'x-integration-signature', in: 'header', required: false, schema: { type: 'string' } },
            {
              name: 'Idempotency-Key',
              in: 'header',
              required: false,
              schema: { type: 'string', maxLength: 128 },
              description: 'Compatibility header for sender retries. Primary idempotency key is sourceSystem + externalRecordId.',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BusinessIntegrationTransactionRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Transaction created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationResult' },
                },
              },
            },
            '200': {
              description: 'Transaction updated or replayed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationResult' },
                },
              },
            },
            '400': {
              description: 'Validation failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationErrorResponse' },
                },
              },
            },
            '401': {
              description: 'Invalid integration key/signature',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationErrorResponse' },
                },
              },
            },
            '403': {
              description: 'Integration key is not scoped for workspace/source',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationErrorResponse' },
                },
              },
            },
            '503': {
              description: 'Integration contract dependencies are not configured',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/integrations/reminders': {
        post: {
          tags: ['Integrations'],
          summary: 'Ingest a lightweight business reminder payload',
          parameters: [
            { name: 'x-integration-key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'x-integration-timestamp', in: 'header', required: false, schema: { type: 'string' } },
            { name: 'x-integration-signature', in: 'header', required: false, schema: { type: 'string' } },
            {
              name: 'Idempotency-Key',
              in: 'header',
              required: false,
              schema: { type: 'string', maxLength: 128 },
              description: 'Compatibility header for sender retries. Primary idempotency key is sourceSystem + externalRecordId.',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BusinessIntegrationReminderRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Reminder created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationResult' },
                },
              },
            },
            '200': {
              description: 'Reminder updated or replayed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationResult' },
                },
              },
            },
            '400': {
              description: 'Validation failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationErrorResponse' },
                },
              },
            },
            '401': {
              description: 'Invalid integration key/signature',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationErrorResponse' },
                },
              },
            },
            '403': {
              description: 'Integration key is not scoped for workspace/source',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationErrorResponse' },
                },
              },
            },
            '503': {
              description: 'Integration contract dependencies are not configured',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BusinessIntegrationErrorResponse' },
                },
              },
            },
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
      '/api/ai/cfo': { post: { tags: ['AI'], summary: 'Generate CFO analysis', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], parameters: [AI_IDEMPOTENCY_KEY_HEADER], responses: { '200': { description: 'CFO response' }, ...AI_QUOTA_ERROR_RESPONSES } } },
      '/api/ai/interpret': { post: { tags: ['AI'], summary: 'Interpret natural language into finance actions', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], parameters: [AI_IDEMPOTENCY_KEY_HEADER], responses: { '200': { description: 'Interpretation result' }, ...AI_QUOTA_ERROR_RESPONSES } } },
      '/api/ai/scan-receipt': { post: { tags: ['AI'], summary: 'OCR receipt scan', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], parameters: [AI_IDEMPOTENCY_KEY_HEADER], responses: { '200': { description: 'Scanned receipt fields' }, ...AI_QUOTA_ERROR_RESPONSES } } },
      '/api/ai/classify-transactions': { post: { tags: ['AI'], summary: 'Categorize transactions', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], parameters: [AI_IDEMPOTENCY_KEY_HEADER], responses: { '200': { description: 'Classification result' }, ...AI_QUOTA_ERROR_RESPONSES } } },
      '/api/ai/insights': { post: { tags: ['AI'], summary: 'Generate AI insights', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], parameters: [AI_IDEMPOTENCY_KEY_HEADER], responses: { '200': { description: 'Insight list' }, ...AI_QUOTA_ERROR_RESPONSES } } },
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
      '/api/banking/webhooks/pluggy': {
        post: {
          tags: ['Banking'],
          summary: 'Pluggy webhook receiver',
          parameters: [{
            in: 'header',
            name: 'x-pluggy-webhook-secret',
            required: false,
            schema: { type: 'string' },
            description: 'Webhook signing secret. Required whenever OPEN_FINANCE_PROVIDER=pluggy.',
          }],
          responses: {
            '202': { description: 'Webhook received; processing may be skipped when the provider is disabled or the item is unknown' },
            '401': { description: 'Webhook signing secret is invalid' },
            '503': { description: 'Pluggy is enabled but PLUGGY_WEBHOOK_SECRET is not configured' },
          },
        },
      },
      '/api/billing/subscription': {
        post: {
          tags: ['Billing'],
          summary: 'Create or change a mock subscription',
          description: 'Mock/test-only compatibility endpoint. Production subscription changes must use Stripe checkout and signed Stripe webhooks.',
          security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['plan'],
                  properties: {
                    plan: { type: 'string', enum: PLAN_IDS },
                    billingEmail: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Mock subscription created or changed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['workspaceId', 'subscription', 'entitlements', 'plan'],
                    properties: {
                      workspaceId: { type: 'string' },
                      plan: { type: 'string', enum: PLAN_IDS },
                      subscription: {
                        type: 'object',
                        required: ['subscriptionId', 'provider', 'status', 'plan', 'startedAt'],
                        properties: {
                          subscriptionId: { type: 'string' },
                          provider: { type: 'string', enum: ['internal', 'stripe'] },
                          status: { type: 'string', enum: ['trialing', 'active', 'past_due', 'canceled'] },
                          plan: { type: 'string', enum: PLAN_IDS },
                          startedAt: { type: 'string', format: 'date-time' },
                          renewsAt: { type: 'string', format: 'date-time' },
                        },
                      },
                      entitlements: { type: 'object', description: 'Workspace feature and limit entitlements' },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'Manual mock billing updates are disabled outside mock/test environments',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/billing/export': { get: { tags: ['Billing'], summary: 'Export workspace data (not yet available)', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '501': { description: 'Export not implemented yet' } } } },
      '/api/admin/users': { get: { tags: ['Admin'], summary: 'List workspace users', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'User list' } } } },
      '/api/admin/audit-logs': { get: { tags: ['Admin'], summary: 'List audit logs', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Audit log list' } } } },
      '/api/admin/audit-logs/export': { get: { tags: ['Admin'], summary: 'Export audit logs', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Audit export' } } } },
      '/api/admin/usage-metering': { get: { tags: ['Admin'], summary: 'List workspace metering', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Usage metering' } } } },
      '/api/admin/usage-metering/export': { get: { tags: ['Admin'], summary: 'Export workspace metering', security: [{ BearerAuth: [] }, { WorkspaceHeader: [] }], responses: { '200': { description: 'Usage export' } } } },
  };
