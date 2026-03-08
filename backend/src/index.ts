import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import logger from './config/logger';
import { initGemini } from './config/gemini';
import { initSentry, sentryRequestHandler, sentryErrorHandler, addBreadcrumb } from './config/sentry';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';

// Routes
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';

// ─── INITIALIZATION ──────────────────────────────────────────────────────────

// Initialize Sentry for error tracking (must be first)
initSentry();
addBreadcrumb('Backend server initialization', 'server', 'info');

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini
try {
  initGemini();
  logger.info('Gemini AI initialized');
} catch (error) {
  logger.error({ error }, 'Failed to initialize Gemini');
  process.exit(1);
}

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────

// Sentry request handler (must be first)
app.use(sentryRequestHandler);

// Security headers
app.use(helmet());

// CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Logging middleware
app.use((_req: Request, _res: Response, next: NextFunction) => {
  logger.info(
    {
      method: _req.method,
      path: _req.path,
      query: _req.query,
      userAgent: _req.get('user-agent')
    },
    'HTTP Request'
  );
  next();
});

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// General rate limiter
app.use(apiLimiter);

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '0.1.0'
  });
});

// API version
app.get('/api/version', (_req: Request, res: Response) => {
  res.json({
    version: process.env.APP_VERSION || '0.1.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// AI routes (Gemini proxy)
app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  logger.warn({ method: req.method, path: req.path }, 'Route not found');
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`,
    timestamp: new Date().toISOString()
  });
});

// Sentry error handler (before global error handler)
app.use(sentryErrorHandler);

// Global error handler (must be last)
app.use(errorHandlerMiddleware);

// ─── SERVER START ────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      corsOrigin: corsOptions.origin
    },
    `🚀 Backend API server running`
  );
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
