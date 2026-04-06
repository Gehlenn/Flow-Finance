import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

import { externalIntegrationAuth } from '../../src/middleware/externalIntegrationAuth';

type Req = Omit<Partial<Request>, 'header'> & {
  rawBody?: string;
  headers: Record<string, string | undefined>;
  header: Request['header'];
};

describe('externalIntegrationAuth', () => {
  let req: Req;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = {
      headers: {},
      method: 'POST',
      header: ((name: string) => req.headers[name.toLowerCase()]) as Request['header'],
      rawBody: '{"test":"payload"}',
    };

    statusMock = vi.fn();
    jsonMock = vi.fn();
    statusMock.mockReturnValue({ json: jsonMock });

    res = {
      status: statusMock as any,
    };

    next = vi.fn();

    delete process.env.FLOW_EXTERNAL_INTEGRATION_KEYS;
    delete process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS;
    delete process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function sign(timestamp: string, body: string, secret: string): string {
    const digest = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    return `sha256=${digest}`;
  }

  it('retorna 503 quando integração externa não está configurada', () => {
    externalIntegrationAuth(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'External integration is not configured' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 para x-integration-key inválida', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    req.headers['x-integration-key'] = 'wrong-key';

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid integration key' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 quando HMAC está habilitado e assinatura não é enviada', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'super-secret';

    req.headers['x-integration-key'] = 'valid-key';
    req.headers['x-integration-timestamp'] = String(Math.floor(Date.now() / 1000));

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid integration signature' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 quando timestamp está fora da janela anti-replay', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'super-secret';
    process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS = '300';

    req.headers['x-integration-key'] = 'valid-key';
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600);
    req.headers['x-integration-timestamp'] = staleTimestamp;
    req.headers['x-integration-signature'] = sign(staleTimestamp, req.rawBody || '', 'super-secret');

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid integration signature' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 quando assinatura usa formato inválido', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'super-secret';

    req.headers['x-integration-key'] = 'valid-key';
    req.headers['x-integration-timestamp'] = String(Math.floor(Date.now() / 1000));
    req.headers['x-integration-signature'] = 'sha1=abc';

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid integration signature' });
    expect(next).not.toHaveBeenCalled();
  });

  it('chama next quando key e HMAC são válidos', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'super-secret';

    req.headers['x-integration-key'] = 'valid-key';
    const timestamp = String(Math.floor(Date.now() / 1000));
    req.headers['x-integration-timestamp'] = timestamp;
    req.headers['x-integration-signature'] = sign(timestamp, req.rawBody || '', 'super-secret');

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('chama next quando key contém espaços nas bordas e valor válido', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'super-secret';

    req.headers['x-integration-key'] = '  valid-key  ';
    const timestamp = String(Math.floor(Date.now() / 1000));
    req.headers['x-integration-timestamp'] = timestamp;
    req.headers['x-integration-signature'] = sign(timestamp, req.rawBody || '', 'super-secret');

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('retorna 401 quando x-integration-key excede limite de header', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'super-secret';

    req.headers['x-integration-key'] = 'x'.repeat(513);
    const timestamp = String(Math.floor(Date.now() / 1000));
    req.headers['x-integration-timestamp'] = timestamp;
    req.headers['x-integration-signature'] = sign(timestamp, req.rawBody || '', 'super-secret');

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid integration key' });
    expect(next).not.toHaveBeenCalled();
  });

  it('aceita assinatura SHA-256 em hexadecimal maiúsculo', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'super-secret';

    req.headers['x-integration-key'] = 'valid-key';
    const timestamp = String(Math.floor(Date.now() / 1000));
    req.headers['x-integration-timestamp'] = timestamp;
    req.headers['x-integration-signature'] = sign(timestamp, req.rawBody || '', 'super-secret').toUpperCase();

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('retorna 401 quando requisição com body não possui rawBody para validar assinatura', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'super-secret';

    req.headers['x-integration-key'] = 'valid-key';
    const timestamp = String(Math.floor(Date.now() / 1000));
    req.headers['x-integration-timestamp'] = timestamp;
    req.headers['x-integration-signature'] = sign(timestamp, '{"test":"payload"}', 'super-secret');
    req.rawBody = undefined;

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid integration signature' });
    expect(next).not.toHaveBeenCalled();
  });

  it('aceita assinatura para GET sem body mesmo sem rawBody', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'valid-key';
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'super-secret';

    req.method = 'GET';
    req.rawBody = undefined;
    req.headers['x-integration-key'] = 'valid-key';
    const timestamp = String(Math.floor(Date.now() / 1000));
    req.headers['x-integration-timestamp'] = timestamp;
    req.headers['x-integration-signature'] = sign(timestamp, '', 'super-secret');

    externalIntegrationAuth(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });
});
