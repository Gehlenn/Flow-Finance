import { OPENAPI_COMPONENTS, OPENAPI_PATHS } from './openapiFragments';

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
    components: OPENAPI_COMPONENTS,
    paths: OPENAPI_PATHS,
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
