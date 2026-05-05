import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  generateIntegrationKey,
  getIntegrationKeyMeta,
  revokeIntegrationKey,
} from '../services/workspaceIntegrationKeyStore';

export const getIntegrationKeyController = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId!;
  const meta = await getIntegrationKeyMeta(workspaceId);
  if (!meta) {
    res.json({ configured: false });
    return;
  }
  res.json({ configured: true, keyPrefix: meta.keyPrefix, createdAt: meta.createdAt });
});

export const generateIntegrationKeyController = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId!;
  const plaintext = await generateIntegrationKey(workspaceId);
  const meta = await getIntegrationKeyMeta(workspaceId);
  res.status(201).json({
    key: plaintext,
    keyPrefix: meta?.keyPrefix ?? plaintext.slice(0, 9),
    createdAt: meta?.createdAt ?? new Date().toISOString(),
    warning: 'Guarde esta chave — ela nao sera exibida novamente.',
  });
});

export const revokeIntegrationKeyController = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId!;
  await revokeIntegrationKey(workspaceId);
  res.status(204).send();
});
