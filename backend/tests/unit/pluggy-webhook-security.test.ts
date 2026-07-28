import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {
    OPEN_FINANCE_PROVIDER: 'mock',
    PLUGGY_WEBHOOK_SECRET: '',
  },
  isPluggyEnabled: vi.fn(),
  extractWebhookEventName: vi.fn(),
  extractWebhookItemId: vi.fn(),
  findConnectionsByExternalItemId: vi.fn(),
  refreshPluggyConnectionsByItemId: vi.fn(),
  markConnectionsAsError: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../src/config/env', () => ({ default: mocks.env }));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    debug: vi.fn(),
  },
}));

vi.mock('../../src/controllers/bankingControllerHelpers', () => ({
  BRAZILIAN_BANKS: [],
  bankingConnectionStore: {},
  buildWorkspaceScopedStorageKey: vi.fn(),
  countUsersWithConnections: vi.fn(),
  assertConnectionOwnership: vi.fn(),
  extractWebhookEventName: mocks.extractWebhookEventName,
  extractWebhookItemId: mocks.extractWebhookItemId,
  findConnectionsByExternalItemId: mocks.findConnectionsByExternalItemId,
  generateMockTransactions: vi.fn(),
  getConnectionsForUserAsync: vi.fn(),
  getPluggyConnectToken: vi.fn(),
  isPluggyEnabled: mocks.isPluggyEnabled,
  mapPluggyAccountType: vi.fn(),
  markConnectionsAsError: mocks.markConnectionsAsError,
  parseConnectorMap: vi.fn(),
  parseDefaultCredentials: vi.fn(),
  randomBalance: vi.fn(),
  randomTransactionCount: vi.fn(),
  refreshPluggyConnectionsByItemId: mocks.refreshPluggyConnectionsByItemId,
  resolveAuthenticatedUserId: vi.fn(),
  setConnectionsForUser: vi.fn(),
  stringsEqual: (provided: string, configured: string) => provided === configured,
  toExternalConnection: vi.fn(),
  pluggyClient: {},
}));

vi.mock('../../src/services/openFinance/bankingConnectionStore', () => ({
  createBankingConnectionStore: vi.fn(),
  migrateConnectionsBetweenStores: vi.fn(),
}));

vi.mock('../../src/services/admin/auditLog', () => ({ recordAuditEvent: vi.fn() }));

import { pluggyWebhookController } from '../../src/controllers/bankingController';

type MockResponse = Pick<Response, 'status' | 'json'> & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

function createResponse(): MockResponse {
  const response = {} as MockResponse;
  response.status = vi.fn(() => response);
  response.json = vi.fn(() => response);
  return response;
}

function createRequest(secret?: string): Request {
  return {
    path: '/webhooks/pluggy',
    query: {},
    headers: secret ? { 'x-pluggy-webhook-secret': secret } : {},
    body: { event: 'item/updated', itemId: 'item-123' },
  } as unknown as Request;
}

describe('pluggyWebhookController signing-secret enforcement', () => {
  beforeEach(() => {
    mocks.env.OPEN_FINANCE_PROVIDER = 'mock';
    mocks.env.PLUGGY_WEBHOOK_SECRET = '';
    mocks.isPluggyEnabled.mockReset();
    mocks.extractWebhookEventName.mockReset().mockReturnValue('item/updated');
    mocks.extractWebhookItemId.mockReset().mockReturnValue('item-123');
    mocks.findConnectionsByExternalItemId.mockReset();
    mocks.refreshPluggyConnectionsByItemId.mockReset();
    mocks.markConnectionsAsError.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerInfo.mockReset();
    mocks.loggerWarn.mockReset();
  });

  it('acknowledges without processing while Pluggy is disabled', async () => {
    mocks.isPluggyEnabled.mockReturnValue(false);
    const response = createResponse();

    await pluggyWebhookController(createRequest(), response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({
      received: true,
      processed: false,
      reason: 'provider-disabled',
    });
    expect(mocks.findConnectionsByExternalItemId).not.toHaveBeenCalled();
    expect(mocks.refreshPluggyConnectionsByItemId).not.toHaveBeenCalled();
  });

  it('fails closed when Pluggy is enabled without a webhook signing secret', async () => {
    mocks.isPluggyEnabled.mockReturnValue(true);
    const response = createResponse();

    await pluggyWebhookController(createRequest(), response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Pluggy webhook is unavailable because its signing secret is not configured',
    });
    expect(mocks.findConnectionsByExternalItemId).not.toHaveBeenCalled();
    expect(mocks.refreshPluggyConnectionsByItemId).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ fallback: 'pluggy-webhook-secret-missing' }),
      expect.stringContaining('PLUGGY_WEBHOOK_SECRET'),
    );
  });

  it('rejects an invalid signing secret before processing an active Pluggy webhook', async () => {
    mocks.isPluggyEnabled.mockReturnValue(true);
    mocks.env.PLUGGY_WEBHOOK_SECRET = 'configured-secret';
    const response = createResponse();

    await pluggyWebhookController(createRequest('wrong-secret'), response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: 'Invalid webhook secret' });
    expect(mocks.findConnectionsByExternalItemId).not.toHaveBeenCalled();
    expect(mocks.refreshPluggyConnectionsByItemId).not.toHaveBeenCalled();
  });

  it('accepts the documented signing-secret header when Pluggy is active', async () => {
    mocks.isPluggyEnabled.mockReturnValue(true);
    mocks.env.PLUGGY_WEBHOOK_SECRET = 'configured-secret';
    mocks.findConnectionsByExternalItemId.mockResolvedValue([]);
    const response = createResponse();

    await pluggyWebhookController(createRequest('configured-secret'), response, vi.fn());

    expect(mocks.findConnectionsByExternalItemId).toHaveBeenCalledWith('item-123');
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({
      received: true,
      processed: false,
      reason: 'item-not-registered',
    });
  });
});
