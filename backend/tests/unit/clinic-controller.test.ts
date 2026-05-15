import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../src/config/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/observability', () => ({
  IntegrationTelemetry: class IntegrationTelemetry {
    constructor() {}
  },
  IntegrationMonitor: class IntegrationMonitor {
    constructor() {}
  },
}));

vi.mock('../../src/services/clinic', () => ({
  ClinicAutomationService: class ClinicAutomationService {
    processWebhookEvent = vi.fn();
    healthCheck = vi.fn();
  },
}));

vi.mock('../../src/config/featureFlags', () => ({
  getFeatureFlagService: vi.fn(() => ({
    isEnabled: vi.fn(() => ({ enabled: true, reason: 'test' })),
  })),
}));

vi.mock('../../src/config/redis', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    setEx: vi.fn(),
    exists: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    ttl: vi.fn(),
    ping: vi.fn(),
  },
}));

describe('clinic controller', () => {
  it('rejects invalid clinic payloads before reaching the service layer', async () => {
    const { receiveClinicFinancialEvent } = await import('../../src/controllers/clinicController');

    const req = {
      body: {
        type: 'payment_received',
        amount: 10,
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      header: vi.fn(() => ''),
    } as unknown as Request;

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = {
      status,
      json,
    } as unknown as Response;

    await receiveClinicFinancialEvent(req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Invalid clinic webhook payload',
    }));
  }, 20_000);
});


