import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import logger from './config/logger';
import { initGemini } from './config/gemini';
import { initOpenAI } from './config/openai';
import { initSentry, sentryRequestHandler, sentryErrorHandler, addBreadcrumb } from './config/sentry';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { validateJsonMiddleware } from './middleware/jsonValidation';
import { apiLimiter } from './middleware/rateLimit';
import { requestContextMiddleware } from './middleware/requestContext';

// Routes
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';
import saasRoutes from './routes/saas';
import bankingRoutes from './routes/banking';
import financeRoutes from './routes/finance';
import adminRoutes from './routes/admin';
import syncRoutes from './routes/sync';
import { featureGateOpenFinance } from './middleware/featureGate';

// ─── INITIALIZATION ──────────────────────────────────────────────────────────

// Initialize Sentry for error tracking (must be first)
initSentry();
addBreadcrumb('Backend server initialization', 'server', 'info');

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

function getRequestContext(req: Request): { requestId?: string; routeScope?: string } {
  const contextReq = req as Request & { requestId?: string; routeScope?: string };
  return {
    requestId: contextReq.requestId,
    routeScope: contextReq.routeScope,
  };
}

// Trust proxy for Vercel/serverless environments
app.set('trust proxy', 1);

// Initialize AI providers
const aiProviders: string[] = [];

if (process.env.OPENAI_API_KEY) {
  try {
    initOpenAI();
    aiProviders.push('OpenAI');
  } catch (error) {
    logger.warn({ error }, 'Failed to initialize OpenAI');
  }
}

if (process.env.GEMINI_API_KEY) {
  try {
    initGemini();
    aiProviders.push('Gemini');
  } catch (error) {
    logger.warn({ error }, 'Failed to initialize Gemini');
  }
}

if (aiProviders.length === 0) {
  logger.error('No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env');
} else {
  logger.info(`AI providers available: ${aiProviders.join(', ')}`);
}

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────

// Sentry request handler (must be first)
app.use(sentryRequestHandler);

// Security headers
app.use(helmet());

// CORS
// Build list of allowed origins (dev + production)
const defaultOrigins = [
  'http://localhost:3078',
  'http://127.0.0.1:3078',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://flow-finance-frontend-nine.vercel.app', // Production frontend
];

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([
  ...defaultOrigins,
  ...configuredOrigins,
]));

logger.info({ allowedOrigins, environment: process.env.NODE_ENV }, 'CORS allowed origins configured');

const corsOptions = {
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow same-origin/server-to-server tools without Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // Log rejected origin for debugging but don't throw - just reject silently
    logger.warn({ origin }, 'CORS request rejected');
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Client-Platform']
};
app.use(cors(corsOptions));

// Request context middleware
app.use(requestContextMiddleware);

// Logging middleware
app.use((_req: Request, _res: Response, next: NextFunction) => {
  const requestContext = getRequestContext(_req);
  logger.info(
    {
      requestId: requestContext.requestId,
      routeScope: requestContext.routeScope,
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
app.use(express.json({
  limit: '10mb',
  verify: (req: Request, _res: Response, buf: Buffer) => {
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// JSON validation middleware (catches malformed JSON)
app.use(validateJsonMiddleware);

// General rate limiter
app.use(apiLimiter);

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '0.6.3'
  });
});

// API version
app.get('/api/version', (_req: Request, res: Response) => {
  res.json({
    version: process.env.APP_VERSION || '0.6.3',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API health check (stable endpoint for probes)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'flow-finance-api',
    version: process.env.APP_VERSION || '0.6.3',
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// AI routes (Gemini proxy)
app.use('/api/ai', aiRoutes);

// SaaS routes (usage + billing hooks)
app.use('/api/saas', saasRoutes);

// Banking routes (Open Finance integration)
app.use('/api/banking', featureGateOpenFinance, bankingRoutes);

// Finance metrics routes (D3/D4 computations)
app.use('/api/finance', financeRoutes);

// Cloud sync routes (accounts/transactions/goals/subscriptions)
app.use('/api/sync', syncRoutes);

// Admin routes (audit log, etc.)
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  const requestContext = getRequestContext(req);
  logger.warn(
    {
      requestId: requestContext.requestId,
      routeScope: requestContext.routeScope,
      method: req.method,
      path: req.path,
    },
    'Route not found'
  );
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`,
    requestId: requestContext.requestId,
    routeScope: requestContext.routeScope,
    timestamp: new Date().toISOString()
  });
});

// Sentry error handler (before global error handler)
app.use(sentryErrorHandler);

// Global error handler (must be last)
app.use(errorHandlerMiddleware);

// ─── SERVER START ────────────────────────────────────────────────────────────

// Only start server in non-serverless environments (local dev)
// Vercel will handle the request routing via api/index.ts
if (process.env.VERCEL !== '1') {
  const server = app.listen(PORT);

  server.on('listening', () => {
    logger.info(
      {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        allowedOrigins,
      },
      'Backend API server running'
    );
    logger.info(
      { version: process.env.APP_VERSION || '0.6.3', build: 'event-listeners+cache+observability' },
      '[Bootstrap] Flow Finance backend v0.6.3 iniciado'
    );
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.warn(
        { port: PORT },
        'Port already in use. Another backend process is already running, exiting this instance.'
      );
      process.exit(0);
    }

    logger.error({ error, port: PORT }, 'Failed to start backend server');
    process.exit(1);
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
}

export default app;
