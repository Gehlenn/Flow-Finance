import { NextFunction, Request, Response } from 'express';
import AISecurityGuard from '../services/ai/AISecurityGuard';
import logger from '../config/logger';

/**
 * aiSecurityMiddleware - Middleware de segurança para rotas que aceitam texto livre do usuário.
 *
 * Aplica validação de input via AISecurityGuard para detectar:
 * - Padrões de injeção de prompt
 * - Perguntas fora do escopo financeiro
 * - Inputs malformados ou excessivamente grandes
 *
 * @param textField - Nome do campo no body que contém o texto do usuário (padrão: 'text')
 */
export function aiInputSecurityMiddleware(textField: string = 'text') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const inputValue = req.body?.[textField];

    // Campos não-textuais (OCR, classify) não passam por este guard
    if (typeof inputValue !== 'string') {
      return next();
    }

    const validation = AISecurityGuard.validateInput(inputValue);

    // Block invalid inputs AND out-of-scope requests at the HTTP boundary
    if (!validation.isValid || validation.intent === 'out-of-scope') {
      const intent = validation.intent ?? 'invalid';
      const reason = intent === 'injection-attempt'
        ? 'injection-attempt'
        : intent === 'out-of-scope'
          ? 'out-of-scope'
          : 'invalid';

      AISecurityGuard.logSecurityEvent('blocked_injection', {
        userId: req.userId,
        intent,
        reason: validation.errors?.[0],
        fieldName: textField,
      });

      res.status(400).json({
        blocked: true,
        reason,
        message: AISecurityGuard.getSafeResponse(reason),
      });
      return;
    }

    if (validation.isSuspicious) {
      logger.warn(
        { userId: req.userId, intent: validation.intent, field: textField },
        'Suspicious AI input detected but not blocked (intent classified)',
      );
    }

    // Normaliza o input antes de passar ao controller
    req.body[textField] = AISecurityGuard.normalizeInput(inputValue);
    next();
  };
}
