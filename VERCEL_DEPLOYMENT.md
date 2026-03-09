# 🚀 Flow Finance - Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: [Sign up at vercel.com](https://vercel.com)
2. **Backend API**: Deploy your backend first and get the production URL
3. **Environment Variables**: Configure API keys and URLs

## Quick Deploy

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy to Preview
```bash
npm run deploy:preview
```

### 4. Deploy to Production
```bash
npm run deploy
```

## Environment Variables

Configure these in your Vercel dashboard or using CLI:

### Required Variables
```bash
# Backend API URLs
VITE_API_DEV_URL=http://localhost:3001
VITE_API_PROD_URL=https://your-backend-api.com

# App Configuration
VITE_APP_VERSION=0.3.1
VITE_SENTRY_DSN=your_sentry_dsn_here
VITE_SENTRY_DEV_ENABLED=false
```

### Firebase Configuration (if using Firebase)
```bash
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

## Build Configuration

The `vercel.json` file is already configured with:
- Static build using Vite
- SPA routing (all routes serve index.html)
- API proxy to your backend
- Optimized build settings

## Backend API Requirements

Your backend must provide these endpoints:
- `POST /api/ai/interpret` - Text interpretation
- `POST /api/ai/analyze` - Transaction analysis
- `POST /api/ai/classify-transactions` - Category classification
- `POST /api/ai/scan-receipt` - Receipt OCR
- `POST /api/ai/insights` - Financial insights
- `POST /api/ai/cfo` - AI CFO assistant

## Custom Domain (Optional)

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Domains
4. Add your custom domain

## Monitoring & Analytics

- **Sentry**: Error tracking (configure VITE_SENTRY_DSN)
- **Vercel Analytics**: Built-in analytics
- **Performance**: Monitor with Vercel's dashboard

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure Node.js version >= 18.0.0
- Verify environment variables are set

### API Calls Fail
- Check backend URL in environment variables
- Ensure CORS is configured on backend
- Verify API endpoints match the expected format

### Performance Issues
- Enable Vercel's Edge Functions for better performance
- Use proper caching headers
- Optimize bundle size with code splitting

## Cost Optimization

- **Free Tier**: 100GB bandwidth, 1000 functions/month
- **Pro Tier**: $20/month for higher limits
- **Enterprise**: Custom pricing for large scale

Monitor usage in Vercel dashboard to optimize costs.