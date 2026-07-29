import { describe, expect, it, vi } from 'vitest';

type MarkerMiddleware = ((...args: never[]) => void) & { marker: string };

function marker(marker: string): MarkerMiddleware {
  const middleware = (() => undefined) as MarkerMiddleware;
  middleware.marker = marker;
  return middleware;
}

const routeMarkers = {
  auth: marker('auth'),
  workspace: marker('workspace'),
  aiLimiter: marker('aiLimiter'),
  bankingLimiter: marker('bankingLimiter'),
  aiSecurity: marker('aiSecurity'),
  quota: marker('quota'),
  validate: marker('validate'),
  authz: marker('authz'),
  feature: marker('feature'),
  controller: marker('controller'),
};

vi.mock('../../backend/src/middleware/auth', () => ({ authMiddleware: routeMarkers.auth }));
vi.mock('../../backend/src/middleware/authz', () => ({
  authz: vi.fn(() => routeMarkers.authz),
  requireFeature: vi.fn(() => routeMarkers.feature),
}));
vi.mock('../../backend/src/middleware/rateLimit', () => ({
  aiLimiterByUser: routeMarkers.aiLimiter,
  bankingLimiterByUser: routeMarkers.bankingLimiter,
}));
vi.mock('../../backend/src/middleware/quota', () => ({ quotaMiddleware: vi.fn(() => routeMarkers.quota) }));
vi.mock('../../backend/src/middleware/workspaceContext', () => ({ workspaceContextMiddleware: routeMarkers.workspace }));
vi.mock('../../backend/src/middleware/aiSecurity', () => ({ aiInputSecurityMiddleware: vi.fn(() => routeMarkers.aiSecurity) }));
vi.mock('../../backend/src/middleware/validate', () => ({ validate: vi.fn(() => routeMarkers.validate) }));
vi.mock('../../backend/src/middleware/featureGate', () => ({ featureGateOpenFinance: vi.fn(() => routeMarkers.feature) }));
vi.mock('../../backend/src/controllers/aiController', () => ({
  interpretController: routeMarkers.controller,
  scanReceiptController: routeMarkers.controller,
  classifyTransactionsController: routeMarkers.controller,
  generateInsightsController: routeMarkers.controller,
  tokenCountController: routeMarkers.controller,
  cfoController: routeMarkers.controller,
}));
vi.mock('../../backend/src/controllers/bankingController', () => ({
  bankingHealthController: routeMarkers.controller,
  connectBankController: routeMarkers.controller,
  createConnectTokenController: routeMarkers.controller,
  disconnectBankController: routeMarkers.controller,
  listBanksController: routeMarkers.controller,
  listConnectionsController: routeMarkers.controller,
  listConnectorsController: routeMarkers.controller,
  migrateCurrentUserConnectionsToFirebaseController: routeMarkers.controller,
  pluggyWebhookController: routeMarkers.controller,
  syncBankController: routeMarkers.controller,
}));
vi.mock('../../backend/src/validation/ai.schema', () => ({
  CFOSchema: {},
  InterpretSchema: {},
  ScanReceiptSchema: {},
  ClassifyTransactionsSchema: {},
  GenerateInsightsSchema: {},
  TokenCountSchema: {},
}));
vi.mock('../../backend/src/validation/banking.schema', () => ({
  ConnectBankSchema: {},
  ConnectTokenSchema: {},
  DisconnectBankSchema: {},
  SyncBankSchema: {},
}));

type RouteLayer = {
  route?: {
    path: string;
    stack: Array<{ handle: MarkerMiddleware }>;
  };
};

function routeMarkersFor(router: unknown, path: string): string[] {
  const stack = (router as { stack: RouteLayer[] }).stack;
  const route = stack.find((layer) => layer.route?.path === path)?.route;
  if (!route) {
    throw new Error(`Route ${path} was not registered`);
  }
  return route.stack.map((layer) => layer.handle.marker);
}

describe('quota route ordering', () => {
  it('validates and screens AI input before reserving quota', async () => {
    const aiRouter = (await import('../../backend/src/routes/ai')).default;

    expect(routeMarkersFor(aiRouter, '/cfo')).toEqual([
      'validate',
      'aiSecurity',
      'quota',
      'controller',
    ]);
    expect(routeMarkersFor(aiRouter, '/interpret')).toEqual([
      'validate',
      'aiSecurity',
      'quota',
      'controller',
    ]);
    expect(routeMarkersFor(aiRouter, '/scan-receipt')).toEqual([
      'validate',
      'quota',
      'controller',
    ]);
  });

  it('validates the banking connection payload before reserving quota', async () => {
    const bankingRouter = (await import('../../backend/src/routes/banking')).default;

    expect(routeMarkersFor(bankingRouter, '/connect')).toEqual([
      'authz',
      'validate',
      'quota',
      'controller',
    ]);
  });
});
