# 🔧 Quick Setup Guide - Flow Finance

## 1️⃣ OpenAI / GPT-4 Configuration

### Get Your OpenAI API Key

1. **Go to OpenAI Platform**
   - Visit: https://platform.openai.com/api/keys
   - Login with your account

2. **Create API Key**
   - Click "Create new secret key"
   - Copy the key (starts with `sk-proj-`)
   - ⚠️ Save it securely (never share!)

3. **Add to .env.local**
   ```
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   OPENAI_MODEL=gpt-4-turbo-preview
   OPENAI_MAX_TOKENS=4096
   ```

4. **Cost Estimation**
   - GPT-4: ~$0.03 per 1K tokens
   - 1000 users = ~$10-50/month
   - Can optimize with prompt engineering

### Setup Backend OpenAI Integration

1. **Backend URL**
   ```
   VITE_API_DEV_URL=http://localhost:3001
   VITE_API_PROD_URL=https://your-backend.vercel.app
   ```

2. **Verify Backend is Configured**
   - Check: `backend/src/config/openai.ts` ✅ (already done)
   - Check: `backend/src/controllers/aiController.ts` ✅ (already done)

---

## 2️⃣ Firebase Configuration

### Option A: Firebase Console (Recommended)

1. **Go to Firebase Console**
   - https://console.firebase.google.com
   - Select project: `komodo-flow`

2. **Get Admin SDK Key**
   - Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - A JSON file will download

3. **Extract Values**
   ```
   FIREBASE_PROJECT_ID=komodo-flow
   FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@komodo-flow.iam.gserviceaccount.com
   ```

4. **Add to .env.local**
   ```env
   FIREBASE_PROJECT_ID=komodo-flow
   FIREBASE_PRIVATE_KEY="YOUR_PRIVATE_KEY_HERE"
   FIREBASE_CLIENT_EMAIL=YOUR_EMAIL_HERE
   ```

### Option B: Using Firestore Web SDK
- Already configured in the app
- Keys from Firebase Console → Project Settings → General tab:
  - API Key
  - Auth Domain
  - Project ID
  - Storage Bucket

---

## 3️⃣ Vercel Deployment & Linking

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```
- Opens browser
- Approve authentication
- Returns to terminal

### Step 3: Link Your Project

```bash
vercel link
```
- Select "Create a new project"
- Set project name: `flow-finance`
- Framework: React ✅
- Root directory: `.` ✅

### Step 4: Add Environment Variables

**Option A: Via CLI**
```bash
vercel env add OPENAI_API_KEY
vercel env add VITE_API_PROD_URL
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_PRIVATE_KEY
vercel env add FIREBASE_CLIENT_EMAIL
```

**Option B: Via Vercel Dashboard**
1. Go to Vercel Dashboard
2. Select `flow-finance` project
3. Settings → Environment Variables
4. Add all variables from `.env.local`

### Step 5: Deploy to Production

```bash
npm run deploy
```

Or for preview:
```bash
npm run deploy:preview
```

---

## 4️⃣ Environment Variables Checklist

### Frontend (.env.local)
- [ ] `VITE_API_DEV_URL` = http://localhost:3001
- [ ] `VITE_API_PROD_URL` = your backend URL
- [ ] `VITE_FIREBASE_API_KEY`
- [ ] `VITE_FIREBASE_PROJECT_ID`

### Backend (.env or .env.local)
- [ ] `OPENAI_API_KEY` = your OpenAI key
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_PRIVATE_KEY`
- [ ] `FIREBASE_CLIENT_EMAIL`

### Vercel Dashboard
- [ ] All backend variables set
- [ ] Production domain configured
- [ ] Auto-deploy from Git enabled

---

## 5️⃣ Testing the Setup

### Local Development
```bash
# Terminal 1: Backend
cd backend
npm install
npm start

# Terminal 2: Frontend
npm install
npm run dev
```

Visit: http://localhost:3078

### Production Testing
```bash
npm run deploy:preview
```

Visit: https://flow-finance-preview.vercel.app

### Production Deployment
```bash
npm run deploy
```

Visit: https://flow-finance.vercel.app

---

## 6️⃣ Troubleshooting

### OpenAI 401 Unauthorized
- [ ] Check API key is correct
- [ ] Check API key hasn't expired
- [ ] Check API key has usage credits

### Firebase Connection Error
- [ ] Check FIREBASE_PROJECT_ID is correct
- [ ] Check private key format (should have newlines)
- [ ] Check email is from same Google account

### Vercel Deployment Failed
- [ ] Check `npm run build` passes locally
- [ ] Check all environment variables are set
- [ ] Check Node.js version >= 18
- [ ] Check no circular dependencies

### API Calls Fail
- [ ] Check backend is running
- [ ] Check `VITE_API_PROD_URL` is correct
- [ ] Check CORS is configured
- [ ] Check API endpoints match

---

## 7️⃣ Next Steps

1. ✅ Set up OpenAI + Firebase locally
2. ✅ Test with `npm run dev`
3. ✅ Deploy backend to Vercel/Railway
4. ✅ Link Vercel project
5. ✅ Configure environment variables
6. ✅ Deploy frontend to Vercel
7. ✅ Monitor production metrics

---

## 📞 Support

- **OpenAI Help**: https://platform.openai.com/docs
- **Firebase Help**: https://firebase.google.com/docs
- **Vercel Help**: https://vercel.com/docs

Happy coding! 🚀