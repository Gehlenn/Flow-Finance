import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { ingestIntegrationReminder, ingestIntegrationTransaction } from '../services/businessIntegrationService';
import type { IntegrationReminderInput, IntegrationTransactionInput } from '../validation/businessIntegration.schema';

export const ingestIntegrationTransactionController = asyncHandler(async (req: Request, res: Response) => {
  const result = await ingestIntegrationTransaction(req.body as IntegrationTransactionInput);
  res.status(result.action === 'created' ? 201 : 200).json(result);
});

export const ingestIntegrationReminderController = asyncHandler(async (req: Request, res: Response) => {
  const result = await ingestIntegrationReminder(req.body as IntegrationReminderInput);
  res.status(result.action === 'created' ? 201 : 200).json(result);
});
