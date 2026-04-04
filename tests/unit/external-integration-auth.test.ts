import { beforeEach, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import { externalIntegrationAuth } from '../../backend/src/middleware/externalIntegrationAuth';

function buildReq(options: {
  key?: string;
  signature?: string;
  timestamp?: string;
  rawBody?: string;
}) {
  return {
    header(name: string) {
      const headers: Record<string, string | undefined> = {
        'x-integration-key': options.key,
        'x-integration-signature': options.signature,
        'x-integration-timestamp': options.timestamp,
      };
      return headers[name.toLowerCase()];
    },
    rawBody: options.rawBody,
  } as any;
}

function buildRes() {
  return {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as any;
}

describe('externalIntegrationAuth', () => {
  beforeEach(() => {
    process.env.FLOW_EXTERNAL_INTEGRATION_KEYS = 'int_key_1';
    delete process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS;
  });

  it('allows valid integration key when HMAC is not configured', () => {
    const req = buildReq({ key: 'int_key_1' });
    const res = buildRes();
    const next = { called: false };

    externalIntegrationAuth(req, res, () => {
      next.called = true;
    });

    expect(next.called).toBe(true);
  });

  it('rejects invalid integration key', () => {
    const req = buildReq({ key: 'bad_key' });
    const res = buildRes();

    externalIntegrationAuth(req, res, () => undefined);

    expect(res.statusCode).toBe(401);
  });

  it('validates HMAC when configured', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'secret_1';

    const timestamp = new Date().toISOString();
    const rawBody = JSON.stringify({ hello: 'world' });
    const signedPayload = `${timestamp}.${rawBody}`;
    const digest = crypto.createHmac('sha256', 'secret_1').update(signedPayload).digest('hex');

    const req = buildReq({
      key: 'int_key_1',
      timestamp,
      rawBody,
      signature: `sha256=${digest}`,
    });

    const res = buildRes();
    const next = { called: false };

    externalIntegrationAuth(req, res, () => {
      next.called = true;
    });

    expect(next.called).toBe(true);
  });

  it('rejects invalid HMAC signature', () => {
    process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS = 'secret_1';

    const req = buildReq({
      key: 'int_key_1',
      timestamp: new Date().toISOString(),
      rawBody: JSON.stringify({ hello: 'world' }),
      signature: 'sha256=invalid',
    });

    const res = buildRes();

    externalIntegrationAuth(req, res, () => undefined);

    expect(res.statusCode).toBe(401);
  });
});
