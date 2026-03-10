import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Safe JSON parse with detailed error logging
 * Prevents SyntaxError from crashing the API
 */
export function safeJsonParse<T = any>(
  jsonString: string,
  context: string = 'unknown'
): T {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        context,
        jsonPreview: jsonString.substring(0, 200), // First 200 chars for debugging
        jsonLength: jsonString.length,
      },
      'JSON parse error'
    );

    if (error instanceof SyntaxError) {
      throw new AppError(
        500,
        'AI response returned invalid JSON format',
        {
          code: 'INVALID_AI_RESPONSE',
          syntaxError: error.message,
          preview: jsonString.substring(0, 100),
        }
      );
    }

    throw error;
  }
}

/**
 * Validate that AI response contains expected fields
 */
export function validateAIResponse(
  parsed: any,
  requiredFields: string[],
  context: string
): void {
  const missing = requiredFields.filter(field => !(field in parsed));
  
  if (missing.length > 0) {
    logger.error(
      {
        context,
        missing,
        received: Object.keys(parsed),
      },
      'AI response missing required fields'
    );

    throw new AppError(
      500,
      'AI response incomplete',
      {
        code: 'INCOMPLETE_AI_RESPONSE',
        missing,
      }
    );
  }
}
