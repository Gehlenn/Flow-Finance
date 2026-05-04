import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Attempts to extract a raw JSON string from an LLM response that may contain
 * markdown code fences or preamble/trailing text.
 */
function extractJsonString(raw: string): string {
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Find the first JSON object or array in the string
  const objectMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (objectMatch) return objectMatch[1].trim();

  return raw.trim();
}

/**
 * Safe JSON parse with detailed error logging
 * Prevents SyntaxError from crashing the API.
 * Handles LLM responses that wrap JSON in markdown code fences or preamble text.
 */
export function safeJsonParse<T = any>(
  jsonString: string,
  context: string = 'unknown'
): T {
  const candidate = extractJsonString(jsonString);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        context,
        jsonPreview: candidate.substring(0, 200),
        jsonLength: candidate.length,
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
          preview: candidate.substring(0, 100),
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
