import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

const DEFAULT_MAX_TIMESTAMP_SKEW_SECONDS = 300;
const MAX_HEADER_VALUE_LENGTH = 512;

export type ExternalIntegrationAuthReason = 'not_configured' | 'invalid_key' | 'invalid_signature';

type ExternalIntegrationAuthResult =
  | { ok: true }
  | { ok: false; statusCode: 401 | 503; reason: ExternalIntegrationAuthReason };

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

function getMaxTimestampSkewSeconds(): number {
  const parsed = Number.parseInt(process.env.FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS || '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MAX_TIMESTAMP_SKEW_SECONDS;
}

function parseTimestampToSeconds(rawTimestamp: string): number | null {
  if (!/^\d{10,13}$/.test(rawTimestamp)) {
    return null;
  }

  const numeric = Number(rawTimestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  if (numeric > 1_000_000_000_000) {
    return Math.floor(numeric / 1000);
  }

  return Math.floor(numeric);
}

export function sanitizeIntegrationHeaderValue(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_HEADER_VALUE_LENGTH) {
    return null;
  }

  return normalized;
}

function hasMatchingIntegrationKey(providedKey: string, allowedKeys: string[]): boolean {
  const providedBuffer = Buffer.from(providedKey, 'utf8');

  for (const candidate of allowedKeys) {
    const candidateBuffer = Buffer.from(candidate, 'utf8');

    if (
      providedBuffer.length === candidateBuffer.length
      && crypto.timingSafeEqual(providedBuffer, candidateBuffer)
    ) {
      return true;
    }
  }

  return false;
}

function verifyHmacSignature(req: Request, secrets: string[]): boolean {
  if (!secrets.length) {
    return true;
  }

  const signature = sanitizeIntegrationHeaderValue(req.header('x-integration-signature'));
  const timestamp = sanitizeIntegrationHeaderValue(req.header('x-integration-timestamp'));
  const method = String(req.method || '').toUpperCase();
  const contentLengthHeader = req.header('content-length');
  const parsedContentLength = Number.parseInt(contentLengthHeader || '0', 10);
  const hasPositiveContentLength = Number.isFinite(parsedContentLength) && parsedContentLength > 0;
  const expectsSignedRequestBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    || hasPositiveContentLength;

  if (expectsSignedRequestBody && typeof req.rawBody !== 'string') {
    return false;
  }

  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : '';

  if (!signature || !timestamp) {
    return false;
  }

  const signatureMatch = /^sha256=([a-f0-9]{64})$/i.exec(signature);
  if (!signatureMatch) {
    return false;
  }

  const providedDigest = Buffer.from(signatureMatch[1], 'hex');

  const parsedTimestampSeconds = parseTimestampToSeconds(timestamp);
  if (parsedTimestampSeconds === null) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxSkew = getMaxTimestampSkewSeconds();
  if (Math.abs(nowSeconds - parsedTimestampSeconds) > maxSkew) {
    return false;
  }

  const message = `${timestamp}.${rawBody}`;

  for (const secret of secrets) {
    const expectedDigest = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest();

    try {
      if (providedDigest.length === expectedDigest.length && crypto.timingSafeEqual(providedDigest, expectedDigest)) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

export function authorizeExternalIntegrationRequest(req: Request): ExternalIntegrationAuthResult {
  const allowedKeys = getAllowedIntegrationKeys();
  if (!allowedKeys.length) {
    return { ok: false, statusCode: 503, reason: 'not_configured' };
  }

  const providedKey = sanitizeIntegrationHeaderValue(req.header('x-integration-key'));
  if (!providedKey || !hasMatchingIntegrationKey(providedKey, allowedKeys)) {
    return { ok: false, statusCode: 401, reason: 'invalid_key' };
  }

  const allowedHmacSecrets = getAllowedHmacSecrets();
  if (!verifyHmacSignature(req, allowedHmacSecrets)) {
    return { ok: false, statusCode: 401, reason: 'invalid_signature' };
  }

  return { ok: true };
}

export function externalIntegrationAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = authorizeExternalIntegrationRequest(req);
  if (!result.ok) {
    if (result.reason === 'not_configured') {
      res.status(503).json({ error: 'External integration is not configured' });
      return;
    }

    if (result.reason === 'invalid_key') {
      res.status(401).json({ error: 'Invalid integration key' });
      return;
    }

    res.status(401).json({ error: 'Invalid integration signature' });
    return;
  }

  next();
}
