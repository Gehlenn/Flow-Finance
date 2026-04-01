import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';
import { quotaMiddleware } from '../middleware/quota';
import {
  interpretController,
  scanReceiptController,
  classifyTransactionsController,
  generateInsightsController,
  tokenCountController,
  cfoController
} from '../controllers/aiController';
import { validate } from '../middleware/validate';
import {
  CFOSchema,
  InterpretSchema,
  ScanReceiptSchema,
  ClassifyTransactionsSchema,
  GenerateInsightsSchema,
  TokenCountSchema,
} from '../validation/ai.schema';

const router = Router();

// CFO route is public (no auth required) for testing
router.post('/cfo', aiLimiter, validate(CFOSchema), cfoController);

// All other AI routes require authentication and are rate-limited
router.use(authMiddleware);
router.use(aiLimiter);

/**
 * POST /api/ai/interpret
 * Parse smart input (text → transactions/reminders)
 *
 * Body: { text: string, memoryContext?: string }
 * Returns: { intent: 'transaction'|'reminder', data: TransactionData[] | ReminderData[] }
 */
router.post('/interpret', quotaMiddleware('aiQueries'), validate(InterpretSchema), interpretController);

/**
 * POST /api/ai/scan-receipt
 * OCR document parsing
 *
 * Body: { imageBase64: string, imageMimeType: string, context?: string }
 * Returns: ReceiptScanResult
 */
router.post('/scan-receipt', quotaMiddleware('aiQueries'), validate(ScanReceiptSchema), scanReceiptController);

/**
 * POST /api/ai/classify-transactions
 * Classify and categorize transactions
 *
 * Body: { transactions: TransactionData[] }
 * Returns: TransactionClassification[]
 */
router.post('/classify-transactions', quotaMiddleware('aiQueries'), validate(ClassifyTransactionsSchema), classifyTransactionsController);

/**
 * POST /api/ai/insights
 * Generate financial insights
 *
 * Body: { transactions: TransactionData[], type: 'daily'|'strategic' }
 * Returns: GenerateInsightsResponse
 */
router.post('/insights', quotaMiddleware('aiQueries'), validate(GenerateInsightsSchema), generateInsightsController);

/**
 * POST /api/ai/token-count
 * Count tokens for a text (for cost estimation)
 *
 * Body: { text: string }
 * Returns: { tokenCount: number }
 */
router.post('/token-count', validate(TokenCountSchema), tokenCountController);

export default router;
