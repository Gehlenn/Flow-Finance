import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { processExternalIntegrationEvent } from '../services/externalIntegrationService';
import { ExternalIntegrationEvent } from '../types/externalIntegration';

export const receiveExternalIntegrationEventController = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as ExternalIntegrationEvent;

  const result = await processExternalIntegrationEvent(payload);
  res.status(result.status === 'duplicate' ? 200 : 202).json(result);
});
