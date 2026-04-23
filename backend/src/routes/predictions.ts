/**
 * predictions.ts
 * API routes for AI-powered cash flow predictions
 */

import { Router } from 'express';
import { PredictionEngine } from '../services/PredictionEngine';
import { authMiddleware } from '../middleware/auth';
import { PredictionApiResponse } from '../types/prediction';

const router = Router();

// Initialize prediction engine
const predictionEngine = new PredictionEngine();

/**
 * GET /api/predictions/cash-flow
 * Get cash flow prediction for authenticated user
 * Query params: days (default: 30)
 */
router.get('/cash-flow', authMiddleware, async (req, res): Promise<any> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as PredictionApiResponse);
    }

    const days = parseInt(req.query.days as string) || 30;
    
    // Validate days parameter
    if (days < 7 || days > 90) {
      return res.status(400).json({
        success: false,
        error: 'Days must be between 7 and 90',
      } as PredictionApiResponse);
    }

    // Fetch user's transaction history from Firestore
    const db = req.app.locals.db;
    const transactionsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('transactions')
      .orderBy('date', 'desc')
      .limit(365 * 2) // Last 2 years
      .get();

    const transactions = transactionsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(doc.data().date),
    }));

    if (transactions.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient historical data. Need at least 10 transactions.',
      } as PredictionApiResponse);
    }

    // Build transaction history object
    const historicalData = {
      userId,
      transactions,
      dateRange: {
        start: transactions[transactions.length - 1]?.date || new Date(),
        end: transactions[0]?.date || new Date(),
      },
      totalIncome: transactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + t.amount, 0),
      totalExpenses: transactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0),
      transactionCount: transactions.length,
    };

    // Generate prediction
    const prediction = await predictionEngine.predictCashFlow(
      userId,
      historicalData,
      days
    );

    // Store prediction in Firestore
    await db
      .collection('users')
      .doc(userId)
      .collection('predictions')
      .doc('latest')
      .set({
        ...prediction,
        dateRange: {
          start: prediction.dateRange.start.toISOString(),
          end: prediction.dateRange.end.toISOString(),
        },
        dailyPredictions: prediction.dailyPredictions.map(d => ({
          ...d,
          date: d.date.toISOString(),
        })),
        generatedAt: prediction.generatedAt.toISOString(),
      });

    // Also store in history
    await db
      .collection('users')
      .doc(userId)
      .collection('predictions')
      .doc('history')
      .collection('snapshots')
      .doc(new Date().toISOString().split('T')[0])
      .set({
        ...prediction,
        dateRange: {
          start: prediction.dateRange.start.toISOString(),
          end: prediction.dateRange.end.toISOString(),
        },
        dailyPredictions: prediction.dailyPredictions.map(d => ({
          ...d,
          date: d.date.toISOString(),
        })),
        generatedAt: prediction.generatedAt.toISOString(),
      });

    res.json({
      success: true,
      data: prediction,
      cached: false,
    } as PredictionApiResponse);

  } catch (error) {
    console.error('[Predictions API] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    } as PredictionApiResponse);
  }
});

/**
 * GET /api/predictions/shortfall-risk
 * Get shortfall risk warning for authenticated user
 */
router.get('/shortfall-risk', authMiddleware, async (req, res): Promise<any> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as PredictionApiResponse);
    }

    // Get latest prediction from Firestore
    const db = req.app.locals.db;
    const predictionDoc = await db
      .collection('users')
      .doc(userId)
      .collection('predictions')
      .doc('latest')
      .get();

    if (!predictionDoc.exists) {
      // Generate new prediction
      return res.status(404).json({
        success: false,
        error: 'No prediction found. Generate a cash flow prediction first.',
      } as PredictionApiResponse);
    }

    const predictionData = predictionDoc.data();
    
    // Convert Firestore timestamps back to proper format
    const prediction = {
      ...predictionData,
      dateRange: {
        start: new Date(predictionData?.dateRange?.start),
        end: new Date(predictionData?.dateRange?.end),
      },
      dailyPredictions: predictionData?.dailyPredictions?.map((d: any) => ({
        ...d,
        date: new Date(d.date),
      })) || [],
      generatedAt: new Date(predictionData?.generatedAt),
    };

    // Check for shortfall
    const shortfallRisk = await predictionEngine.predictShortfall(userId, prediction as any);

    res.json({
      success: true,
      data: shortfallRisk,
    } as PredictionApiResponse);

  } catch (error) {
    console.error('[Predictions API] Shortfall error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    } as PredictionApiResponse);
  }
});

/**
 * GET /api/predictions/seasonality
 * Get seasonal patterns detected in user's transactions
 */
router.get('/seasonality', authMiddleware, async (req, res): Promise<any> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as PredictionApiResponse);
    }

    // Fetch user's transaction history
    const db = req.app.locals.db;
    const transactionsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('transactions')
      .orderBy('date', 'desc')
      .limit(365)
      .get();

    const transactions = transactionsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(doc.data().date),
    }));

    if (transactions.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient historical data',
      } as PredictionApiResponse);
    }

    // Detect seasonal patterns
    const patterns = predictionEngine.detectSeasonality(transactions as any);

    res.json({
      success: true,
      data: patterns,
    } as PredictionApiResponse);

  } catch (error) {
    console.error('[Predictions API] Seasonality error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    } as PredictionApiResponse);
  }
});

/**
 * POST /api/predictions/refresh
 * Force refresh of prediction (clear cache and regenerate)
 */
router.post('/refresh', authMiddleware, async (req, res): Promise<any> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as PredictionApiResponse);
    }

    // Clear cache
    predictionEngine.clearCache(userId);

    // Fetch fresh data
    const db = req.app.locals.db;
    const transactionsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('transactions')
      .orderBy('date', 'desc')
      .limit(365 * 2)
      .get();

    const transactions = transactionsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(doc.data().date),
    }));

    if (transactions.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient historical data',
      } as PredictionApiResponse);
    }

    const historicalData = {
      userId,
      transactions,
      dateRange: {
        start: transactions[transactions.length - 1]?.date || new Date(),
        end: transactions[0]?.date || new Date(),
      },
      totalIncome: transactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + t.amount, 0),
      totalExpenses: transactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0),
      transactionCount: transactions.length,
    };

    // Generate fresh prediction
    const prediction = await predictionEngine.predictCashFlow(
      userId,
      historicalData,
      req.body.days || 30
    );

    // Store in Firestore
    await db
      .collection('users')
      .doc(userId)
      .collection('predictions')
      .doc('latest')
      .set({
        ...prediction,
        dateRange: {
          start: prediction.dateRange.start.toISOString(),
          end: prediction.dateRange.end.toISOString(),
        },
        dailyPredictions: prediction.dailyPredictions.map(d => ({
          ...d,
          date: d.date.toISOString(),
        })),
        generatedAt: prediction.generatedAt.toISOString(),
      });

    res.json({
      success: true,
      data: prediction,
      cached: false,
    } as PredictionApiResponse);

  } catch (error) {
    console.error('[Predictions API] Refresh error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    } as PredictionApiResponse);
  }
});

/**
 * GET /api/predictions/health
 * Health check endpoint for prediction service
 */
router.get('/health', async (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'prediction-engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
