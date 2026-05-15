import request from 'supertest';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const healthCheckMock = vi.fn();

  return {
    loggerMock,
    healthCheckMock,
    clinicServiceConstructorMock: vi.fn(),
    monitorMock: {},
    featureFlagServiceMock: {},
  };
});

vi.mock('../../src/config/logger', () => ({
  default: mocks.loggerMock,
}));

vi.mock('../../src/services/clinic', () => ({
  ClinicAutomationService: class ClinicAutomationService {
    processWebhookEvent = vi.fn();
    healthCheck = mocks.healthCheckMock;
    constructor() {}
  },
}));

vi.mock('../../src/services/observability', () => ({
  IntegrationMonitor: class IntegrationMonitor {},
}));

vi.mock('../../src/services/featureFlags/EnhancedFeatureFlagService', () => ({
  EnhancedFeatureFlagService: class EnhancedFeatureFlagService {},
}));

vi.mock('../../src/config/redis', () => ({
  default: {
    ping: vi.fn(),
  },
}));

describe('clinic routes health observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra contexto quando o health check da integracao clinica falha', async () => {
    mocks.healthCheckMock.mockRejectedValueOnce(new Error('clinic health offline'));

    const { createClinicIntegrationRoutes } = await import('../../src/api/integrations/clinicRoutes');

    const app = express();
    app.use('/api/integrations/clinic', createClinicIntegrationRoutes(
      {} as never,
      {} as never,
    ));

    const res = await request(app).get('/api/integrations/clinic/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      service: 'clinic-automation',
      healthy: false,
      message: 'clinic health offline',
    });

    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'clinic-automation',
        error: 'clinic health offline',
        fallback: 'clinic-health-failed',
      }),
      'Clinic automation health check failed',
    );
  });
});
