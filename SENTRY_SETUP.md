# Sentry Crash Reporting Setup

> Complete setup guide for integrating Sentry error tracking and performance monitoring into Flow Finance.

## Overview

Sentry provides:
- **Error Tracking**: Automatic capture of JavaScript errors, unhandled promise rejections, and React component errors
- **Performance Monitoring**: Page load times, API call performance, and user interaction tracing
- **Release Tracking**: Associate errors with specific app versions
- **User Context**: Link errors to specific users for better debugging

## Prerequisites

1. **Sentry Account**: Sign up at [sentry.io](https://sentry.io)
2. **Two Projects**: One for frontend (React), one for backend (Node.js)
3. **DSN Keys**: Project-specific connection strings

## Step 1: Create Sentry Projects

### Frontend Project (React)

1. Go to [sentry.io](https://sentry.io) and sign in
2. Click "Create Project"
3. Choose:
   - **Platform**: React
   - **Project Name**: `flow-finance-frontend`
   - **Team**: Your team
4. Click "Create Project"
5. Copy the **DSN** (starts with `https://...@sentry.io/...`)

### Backend Project (Node.js)

1. Click "Create Project" again
2. Choose:
   - **Platform**: Node.js
   - **Project Name**: `flow-finance-backend`
   - **Team**: Your team
3. Click "Create Project"
4. Copy the **DSN** (starts with `https://...@sentry.io/...`)

## Step 2: Configure Environment Variables

### Frontend (.env)

Create or update your `.env` file in the project root:

```env
# Error Tracking & Monitoring
VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
VITE_SENTRY_DEV_ENABLED=false
VITE_APP_VERSION=0.1.0
```

### Backend (backend/.env)

Create or update your `backend/.env` file:

```env
# Monitoring & Observability
SENTRY_DSN=https://your-backend-dsn@sentry.io/project-id
SENTRY_DEV_ENABLED=false
APP_VERSION=0.1.0
```

## Step 3: Test Configuration

### Frontend Testing

1. **Start development server:**
```bash
npm run dev
```

2. **Trigger a test error:**
   - Open browser console
   - Run: `throw new Error('Sentry test error')`
   - Check Sentry dashboard for the error

3. **Verify user context:**
   - Log into the app
   - Trigger an error
   - Check that user email/ID appears in Sentry

### Backend Testing

1. **Start backend server:**
```bash
cd backend
npm run dev
```

2. **Test API error:**
```bash
# This should trigger a 500 error
curl -X POST http://localhost:3001/api/ai/interpret \
  -H "Content-Type: application/json" \
  -d '{"text": ""}'
```

3. **Check Sentry dashboard** for backend errors

## Step 4: Production Deployment

### Environment Variables

**Frontend (Vercel/Netlify):**
```
VITE_SENTRY_DSN=https://your-prod-dsn@sentry.io/project-id
VITE_SENTRY_DEV_ENABLED=false
VITE_APP_VERSION=0.1.0
```

**Backend (Railway/Render/Fly.io):**
```
SENTRY_DSN=https://your-prod-dsn@sentry.io/project-id
SENTRY_DEV_ENABLED=false
APP_VERSION=0.1.0
NODE_ENV=production
```

### Release Tracking

Set up releases to associate errors with specific versions:

**Frontend (package.json):**
```json
{
  "version": "0.1.0",
  "scripts": {
    "build": "vite build",
    "postbuild": "sentry-cli releases new $npm_package_version && sentry-cli releases files $npm_package_version upload-sourcemaps dist && sentry-cli releases finalize $npm_package_version"
  }
}
```

**Backend (package.json):**
```json
{
  "scripts": {
    "postbuild": "sentry-cli releases new $npm_package_version && sentry-cli releases finalize $npm_package_version"
  }
}
```

## Step 5: Monitoring Dashboard

### Key Metrics to Monitor

1. **Error Rate**: Track error frequency over time
2. **Performance**: Page load times, API response times
3. **User Impact**: Which users are affected by errors
4. **Release Health**: Errors introduced in recent releases

### Alert Rules

Set up alerts for:
- New errors in production
- Error rate spikes (>5% increase)
- Performance degradation (>2s response time)
- Failed releases

## Configuration Details

### Frontend (React)

**Features Enabled:**
- Error boundary integration
- User context tracking
- Platform detection (web/android/ios)
- Performance monitoring (10% sample rate in prod)
- Release tracking

**Error Filtering:**
- Ignores network errors (expected)
- Ignores ResizeObserver loop (React common)
- Ignores Capacitor plugin errors (handled elsewhere)

### Backend (Node.js)

**Features Enabled:**
- Express integration
- Performance profiling
- Request context tracking
- User authentication context
- Error filtering (ignores JWT validation errors)

**Rate Limiting Integration:**
- Errors are tracked with rate limit context
- Distinguishes between client errors (4xx) and server errors (5xx)

## Troubleshooting

### Errors Not Appearing

1. **Check DSN**: Verify DSN is correct and matches project
2. **Check Environment**: Ensure `NODE_ENV` or `VITE_SENTRY_DEV_ENABLED`
3. **Check Network**: Browser dev tools for blocked requests
4. **Check Console**: Look for Sentry initialization messages

### Performance Impact

- **Development**: Minimal (only if `VITE_SENTRY_DEV_ENABLED=true`)
- **Production**: ~1-2% performance overhead
- **Bundle Size**: ~50KB gzipped for frontend

### Privacy Considerations

- **IP Addresses**: Not collected by default
- **Sensitive Data**: Configure data scrubbing rules
- **PII**: Avoid logging user data in breadcrumbs

## Advanced Configuration

### Custom Error Reporting

```typescript
import { reportError, addBreadcrumb } from '@/config/sentry';

// Add context before reporting
addBreadcrumb('User clicked export button', 'ui', 'info');

// Report custom error
reportError(new Error('Export failed'), {
  feature: 'data-export',
  format: 'csv',
  recordCount: 1500
});
```

### Performance Monitoring

```typescript
// Custom performance measurement
const transaction = Sentry.startTransaction({
  name: 'ai-processing',
  op: 'ai.process'
});

// ... your code ...

transaction.finish();
```

### Data Scrubbing

Configure in Sentry dashboard to remove sensitive data:
- API keys
- Passwords
- Personal information
- Financial data

## Support

- **Documentation**: [docs.sentry.io](https://docs.sentry.io)
- **Community**: [forum.sentry.io](https://forum.sentry.io)
- **Status**: [status.sentry.io](https://status.sentry.io)

## Next Steps

1. ✅ **Crash Reporting Setup** — Complete
2. ⬜ **Type Safety** — Replace remaining `any` types
3. ⬜ **Mobile Testing** — Android/iOS device testing
4. ⬜ **Production Deployment** — Deploy with monitoring

---

**🎯 Goal**: Zero undetected production errors with full user context and performance insights.