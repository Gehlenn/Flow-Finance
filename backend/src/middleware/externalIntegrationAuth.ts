import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

function getAllowedIntegrationKeys(): string[] {
  return String(process.env.FLOW_EXTERNAL_INTEGRATION_KEYS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getAllowedHmacSecrets(): string[] {
  return String(process.env.FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function verifyHmacSignature(req: Request, secrets: string[]): boolean {
  if (!secrets.length) {
    return true;
  }

  const signature = req.header('x-integration-signature');
  const timestamp = req.header('x-integration-timestamp');
  const rawBody = req.rawBody;

  if (!signature || !timestamp || !rawBody) {
    return false;
  }

  const message = `${timestamp}.${rawBody}`;

  for (const secret of secrets) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    const expectedValue = `sha256=${expected}`;

    try {
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedValue);

      if (
        signatureBuffer.length === expectedBuffer.length
        && crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

export function externalIntegrationAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const allowedKeys = getAllowedIntegrationKeys();
  if (!allowedKeys.length) {
    res.status(503).json({ error: 'External integration is not configured' });
    return;
  }

  const providedKey = req.header('x-integration-key');
  if (!providedKey || !allowedKeys.includes(providedKey)) {
    res.status(401).json({ error: 'Invalid integration key' });
    return;
  }

  const allowedHmacSecrets = getAllowedHmacSecrets();
  if (!verifyHmacSignature(req, allowedHmacSecrets)) {
    res.status(401).json({ error: 'Invalid integration signature' });
    return;
  }

  next();
}
