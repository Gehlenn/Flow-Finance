import { NextFunction, Request, Response } from 'express';
import { sanitizeIntegrationHeaderValue } from './externalIntegrationAuth';

declare global {
  namespace Express {
    interface Request {
      integrationBinding?: {
        workspaceId: string;
        sourceSystem: string;
      };
    }
  }
}

interface IntegrationBinding {
  key: string;
  workspaceId: string;
  sourceSystem: string;
}

function getConfiguredBindings(): IntegrationBinding[] {
  return String(process.env.FLOW_EXTERNAL_INTEGRATION_BINDINGS || '')
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, workspaceId, sourceSystem] = entry.split('|').map((piece) => piece?.trim());
      return { key, workspaceId, sourceSystem };
    })
    .filter((entry): entry is IntegrationBinding => Boolean(entry.key && entry.workspaceId && entry.sourceSystem));
}

export function integrationBindingScope(req: Request, res: Response, next: NextFunction): void {
  const bindings = getConfiguredBindings();
  if (!bindings.length) {
    res.status(503).json({
      ok: false,
      error: 'integration_unavailable',
      message: 'integration binding is not configured',
    });
    return;
  }

  const providedKey = sanitizeIntegrationHeaderValue(req.header('x-integration-key'));
  const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() : '';
  const sourceSystem = typeof req.body?.sourceSystem === 'string' ? req.body.sourceSystem.trim() : '';

  const matched = bindings.find((binding) => (
    binding.key === providedKey
    && binding.workspaceId === workspaceId
    && binding.sourceSystem === sourceSystem
  ));

  if (!matched) {
    res.status(403).json({
      ok: false,
      error: 'forbidden',
      message: 'integration key is not scoped to this workspace and source system',
    });
    return;
  }

  req.integrationBinding = {
    workspaceId: matched.workspaceId,
    sourceSystem: matched.sourceSystem,
  };

  next();
}
