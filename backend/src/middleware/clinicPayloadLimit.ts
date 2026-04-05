import { NextFunction, Request, Response } from 'express';

const DEFAULT_MAX_BYTES = 256 * 1024; // 256KB

function resolveMaxPayloadBytes(): number {
  const raw = process.env.CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES;
  const parsed = Number.parseInt(raw || '', 10);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_MAX_BYTES;
}

export function createClinicPayloadLimitMiddleware(maxBytes = resolveMaxPayloadBytes()) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawBody = (req as Request & { rawBody?: string }).rawBody || '';
    const bodyBytes = Buffer.byteLength(rawBody, 'utf8');

    if (bodyBytes > maxBytes) {
      res.status(413).json({
        error: 'Payload too large',
        maxBytes,
      });
      return;
    }

    next();
  };
}
