import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { processExternalIntegrationEvent } from '../services/externalIntegrationService';
import { ExternalIntegrationEvent } from '../types/externalIntegration';

export const receiveExternalIntegrationEventController = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as ExternalIntegrationEvent;

  // CR-01: if middleware bound a verifiedWorkspaceId (Path B), ensure body matches
  const verifiedWorkspaceId = (req as Request & { verifiedWorkspaceId?: string }).verifiedWorkspaceId;
  if (verifiedWorkspaceId && payload.workspaceId !== verifiedWorkspaceId) {
    res.status(403).json({ error: 'workspaceId mismatch' });
    return;
  }

  const result = await processExternalIntegrationEvent(payload);
  res.status(result.status === 'duplicate' ? 200 : 202).json(result);
});
