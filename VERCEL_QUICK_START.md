# 🔗 Vercel Linking & Deployment Guide

## Quick Start (5 minutes)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```
- Choose "Continue with GitHub" (recommended)
- Or "Continue with email"
- Approve in browser

### Step 3: Link Your Project
```bash
vercel link
```
- When asked "Set up and deploy?", choose **Yes**
- Choose "Other" for framework
- Root directory: `.`
- Project name: `flow-finance`
- ✅ Your project is now linked!

### Step 4: Configure Environment Variables

#### Option A: Quick Setup (Recommended)
```bash
# Windows PowerShell
.\setup.ps1

# macOS/Linux
bash setup.sh
```

Then add variables to Vercel:
```bash
vercel env add OPENAI_API_KEY
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add VITE_API_PROD_URL
```

#### Option B: Via Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select `flow-finance` project
3. Click **Settings**
4. Go to **Environment Variables**
5. Click **Add New**
6. Add these variables:

| Name | Value | Scope |
|------|-------|-------|
| `OPENAI_API_KEY` | `sk-proj-...` | Production, Preview |
| `FIREBASE_PROJECT_ID` | `komodo-flow` | Production, Preview |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk...` | Production, Preview |
| `VITE_API_PROD_URL` | `https://...` | Production |

### Step 5: Deploy

```bash
# Deploy to preview (staging)
npm run deploy:preview

# Deploy to production
npm run deploy
```

Visit your live site:
- Preview: https://flow-finance-preview.vercel.app
- Production: https://flow-finance.vercel.app

---

## Complete Setup Checklist

### ✅ Local Setup
- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Copy `.env.local.example` → `.env.local`
- [ ] Fill in OPENAI_API_KEY
- [ ] Fill in FIREBASE credentials
- [ ] Set VITE_API_PROD_URL (your backend)

### ✅ Vercel Setup
- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Login: `vercel login`
- [ ] Link project: `vercel link`
- [ ] Add environment variables via CLI or dashboard
- [ ] Verify in Settings → Environment Variables

### ✅ Deploy
- [ ] Test locally: `npm run build` ✅
- [ ] Deploy to preview: `npm run deploy:preview`
- [ ] Test preview deployment
- [ ] Deploy to production: `npm run deploy`

---

## Environment Variables Reference

### Required for Frontend
```env
VITE_API_PROD_URL=https://your-backend-api.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=komodo-flow
```

### Required for Backend (API)
```env
OPENAI_API_KEY=sk-proj-...
FIREBASE_PROJECT_ID=komodo-flow
FIREBASE_CLIENT_EMAIL=...@iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
```

### Optional
```env
SENTRY_DSN=...
VITE_SENTRY_DEV_ENABLED=false
```

---

## Verification

### Check Vercel Project Status
```bash
vercel status
```

### View Real-time Logs
```bash
vercel logs
```

### View Environment Variables
```bash
vercel env ls
```

### Inspect Deployment
```bash
vercel inspect
```

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
vercel build --prod --yes

# See detailed logs
vercel logs --tail
```

### Environment Variables Not Working
```bash
# Verify they're set
vercel env ls

# Re-deploy after setting variables
vercel deploy --prod
```

### API Calls Fail
- Check `VITE_API_PROD_URL` is correct
- Check backend is running
- Check CORS headers on backend
- View logs: `vercel logs`

### Custom Domain (Optional)
1. Go to Vercel Dashboard
2. Select project → Settings → Domains
3. Add your domain (e.g., `flowfinance.com`)
4. Update DNS records

---

## Cost & Limits

- **Free Tier**: 
  - ✅ 100 GB bandwidth/month
  - ✅ Unlimited deployments
  - ✅ Automatic HTTPS

- **Pro Tier** ($20/month):
  - 1 TB bandwidth/month
  - Priority support
  - Recommended for production

- **Enterprise**: Custom pricing

---

## Next Steps After Deployment

1. ✅ Set up custom domain
2. ✅ Configure Sentry error tracking
3. ✅ Set up auto-deploys from GitHub
4. ✅ Monitor performance in Vercel dashboard
5. ✅ Set up email notifications

---

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Status Page**: https://vercel-status.com
- **Support**: https://vercel.com/support
- **Community**: https://github.com/vercel/next.js/discussions

Happy deploying! 🚀