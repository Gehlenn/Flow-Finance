const SENSITIVE_KEY_PATTERN = /(password|token|authorization|secret|api[-_]?key|access[-_]?key|credential|private)/i;
const REDACTED_VALUE = '[REDACTED]';

function sanitizeDetails(details: unknown): unknown {
  if (details === null || details === undefined) {
    return details;
  }

  if (typeof details === 'string') {
    // Redact tokens in string values
    if (SENSITIVE_KEY_PATTERN.test(details) && details.length > 10) {
      return REDACTED_VALUE;
    }
    return details;
  }

  if (Array.isArray(details)) {
    return details.map(sanitizeDetails);
  }

  if (typeof details === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = REDACTED_VALUE;
      } else {
        sanitized[key] = sanitizeDetails(value);
      }
    }
    return sanitized;
  }

  return details;
}

export class AppError extends Error {
  statusCode: number;
  details?: unknown;
  originalDetails?: unknown; // For internal logging only

  constructor(message: string, statusCode?: number, details?: unknown);
  constructor(statusCode: number, message: string, details?: unknown);
  constructor(
    messageOrStatusCode: string | number,
    statusCodeOrMessage: number | string = 500,
    details?: unknown
  ) {
    const message = typeof messageOrStatusCode === 'number'
      ? String(statusCodeOrMessage)
      : messageOrStatusCode;
    const statusCode = typeof messageOrStatusCode === 'number'
      ? messageOrStatusCode
      : typeof statusCodeOrMessage === 'number'
        ? statusCodeOrMessage
        : 500;

    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.originalDetails = details;
    this.details = sanitizeDetails(details);
  }

  /**
   * Get sanitized details safe for external exposure
   */
  getSafeDetails(): unknown {
    return this.details;
  }

  /**
   * Get original details for internal logging (may contain sensitive data)
   */
  getOriginalDetails(): unknown {
    return this.originalDetails;
  }
}
