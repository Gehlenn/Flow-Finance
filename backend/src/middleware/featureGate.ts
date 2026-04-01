import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * Middleware que verifica se Open Finance está desativado
 * Retorna 503 (Service Unavailable) se DISABLE_OPEN_FINANCE=true
 * Mantém a infraestrutura intacta para reativação futura (quando o app virar rentável)
 *
 * Razão: Open Finance via Pluggy custava >R$ 1.000/mês mantendo app inviável
 * Status: Será reativado quando receita justificar o custo
 */
export function featureGateOpenFinance(_req: Request, _res: Response, next: NextFunction): void {
  if (process.env.DISABLE_OPEN_FINANCE === 'true') {
    throw new AppError(
      503,
      'Open Finance integration temporarily unavailable. We are working to make this feature cost-effective and will re-enable it soon.'
    );
  }
  next();
}
