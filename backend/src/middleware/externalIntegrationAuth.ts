import { NextFunction, Request, Response } from 'express';

function getAllowedIntegrationKeys(): string[] {
  return String(process.env.FLOW_EXTERNAL_INTEGRATION_KEYS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
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

  next();
}
