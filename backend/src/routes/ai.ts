import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';
import {
  interpretController,
  scanReceiptController,
  classifyTransactionsController,
  generateInsightsController,
  tokenCountController,
  cfoController
} from '../controllers/aiController';

const router = Router();

// All AI routes require authentication and are rate-limited
router.use(authMiddleware);
router.use(aiLimiter);

/**
 * POST /api/ai/interpret
 * Parse smart input (text → transactions/reminders)
 *
 * Body: { text: string, memoryContext?: string }
 * Returns: { intent: 'transaction'|'reminder', data: TransactionData[] | ReminderData[] }
 */
router.post('/interpret', interpretController);

/**
 * POST /api/ai/scan-receipt
 * OCR document parsing
 *
 * Body: { imageBase64: string, imageMimeType: string, context?: string }
 * Returns: ReceiptScanResult
 */
router.post('/scan-receipt', scanReceiptController);

/**
 * POST /api/ai/classify-transactions
 * Classify and categorize transactions
 *
 * Body: { transactions: TransactionData[] }
 * Returns: TransactionClassification[]
 */
router.post('/classify-transactions', classifyTransactionsController);

/**
 * POST /api/ai/insights
 * Generate financial insights
 *
 * Body: { transactions: TransactionData[], type: 'daily'|'strategic' }
 * Returns: GenerateInsightsResponse
 */
router.post('/insights', generateInsightsController);

/**
 * POST /api/ai/token-count
 * Count tokens for a text (for cost estimation)
 *
 * Body: { text: string }
 * Returns: { tokenCount: number }
 */
router.post('/token-count', tokenCountController);

/**
 * POST /api/ai/cfo
 * Free-form assistant query using OpenAI GPT‑4
 * Body: { question: string, context: string, intent: string }
 * Returns: { answer: string }
 */
router.post('/cfo', cfoController);

export default router;
