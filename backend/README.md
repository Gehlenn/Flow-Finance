# Flow Finance Backend API

> Secure backend server for Flow Finance app — handles authentication, rate limiting, and AI proxy (OpenAI/Gemini).

## Overview

The backend serves as:
- **Authentication proxy**: Issues JWT tokens for mobile app users
- **AI proxy**: Routes OpenAI/Gemini API calls server-side (API keys never exposed to client)
- **Rate limiter**: Prevents abuse of AI endpoints
- **Logger**: Centralized observability for production incidents

## Architecture

```
Express Server (port 3001)
├── /api/auth/* → JWT token generation & validation
├── /api/ai/*   → OpenAI/Gemini API proxy with rate limiting
├── /health     → Server status
└── /api/version → API version
```

**Middleware Stack:**
1. **Security**: Helmet (headers), CORS (origin validation)
2. **Logging**: Pino (structured logs)
3. **Rate Limiting**: Tiered limits (general, AI, auth)
4. **Authentication**: JWT validation (except login)
5. **Error Handling**: Centralized error formatter

## Setup

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org))
- **npm** 8+ (comes with Node.js)
- **OpenAI API Key ou Gemini API Key** (ao menos um provider configurado)

### Installation

1. **Install dependencies:**

```bash
cd backend
npm install
```

2. **Create environment file:**

```bash
cp .env.example .env
```

3. **Configure environment variables:**

Edit `backend/.env`:

```env
# Required
OPENAI_API_KEY=your_openai_key
# or
GEMINI_API_KEY=your_api_key_from_google_ai_studio

# Recommended
JWT_SECRET=use_a_strong_random_string_in_production
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Generate a strong JWT secret (production):

```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### Open Finance persistence drivers

Open Finance banking connections can run with three drivers:

1. `memory`: fast for local development, but data is lost on restart.
2. `firebase`: recommended default for persistence without PostgreSQL.
3. `postgres`: optional SQL persistence for scale-out.

Set in `backend/.env`:

```env
OPEN_FINANCE_STORE_DRIVER=firebase
OPEN_FINANCE_POSTGRES_ENABLED=false

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=
```

When keeping PostgreSQL ready but disabled:

```env
OPEN_FINANCE_STORE_DRIVER=memory
OPEN_FINANCE_POSTGRES_ENABLED=false
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

If you decide to activate PostgreSQL later, run migration:

```bash
psql "$DATABASE_URL" -f sql/migrations/001_create_bank_connections.sql
```

#### Migrating current user connections to Firebase

With backend running in `memory`, call:

`POST /api/banking/migrate/firebase`

Requires auth token and migrates only the authenticated user's in-memory connections to Firebase.

#### Staging / production variables (Firebase-first)

Use the same set in staging and production backend environments:

```env
OPEN_FINANCE_PROVIDER=pluggy
OPEN_FINANCE_STORE_DRIVER=firebase
OPEN_FINANCE_POSTGRES_ENABLED=false

PLUGGY_CLIENT_ID=your_pluggy_client_id
PLUGGY_CLIENT_SECRET=your_pluggy_client_secret
PLUGGY_WEBHOOK_SECRET=generate_a_strong_random_secret

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

FRONTEND_URL=https://your-frontend-domain
```

Promotion checklist:

1. `/api/banking/health` returns `persistenceDriver=firebase` and `persistenceReady=true`.
2. `POST /api/banking/webhooks/pluggy` returns `401/401/202` for no secret / invalid secret / valid secret.
3. A connected bank remains listed after backend restart.

### Cloud Sync persistence

Cloud Sync can use the same Firebase Admin credentials already configured for Open Finance.

Set in `backend/.env`:

```env
CLOUD_SYNC_STORE_DRIVER=firebase

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=
```

Health check:

`GET /api/sync/health`

Expected in persisted mode:
- `driver=firebase`
- `ready=true`

### Stripe sandbox checkout and webhook

Status atual:
- Stripe nao e prioridade operacional nesta fase.
- Open Finance e billing externo estao em espera por viabilidade economica.
- Manter `ALLOW_MOCK_BILLING_UPDATES=true` em ambientes locais quando a intencao for apenas validar UX/plano.

Use Stripe test credentials only.

Set in `backend/.env`:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
ALLOW_MOCK_BILLING_UPDATES=false
```

Local webhook forwarding with Stripe CLI:

```bash
stripe login
stripe listen --forward-to http://localhost:3001/api/saas/stripe/webhook
```

Manual validation flow:
1. Start backend and frontend locally.
2. Open Settings.
3. Trigger `Fazer Upgrade`.
4. Complete Stripe checkout in test mode.
5. Confirm webhook reached `/api/saas/stripe/webhook`.
6. Confirm plan update in `/api/saas/plans` and UI refresh.

#### Persistence proof after restart

The Firebase store was validated locally after restart. For fully real-bank validation, a manual run is still required because bank credentials and MFA/consent cannot be automated safely from this workspace.

#### Manual real-bank validation

Observacao de produto:
- Open Finance foi colocado em standby estrategico por custo operacional do Pluggy.
- Antes de executar esta trilha, confirme que `DISABLE_OPEN_FINANCE=false` e que o custo ja foi aprovado para a fase do produto.

Use this sequence in staging or production-like environment:

1. Log in with a controlled test user.
2. Open the Open Banking page.
3. Generate a Pluggy connect-token.
4. Complete bank consent and MFA in the Pluggy widget.
5. Confirm the created connection through `GET /api/banking/connections`.
6. Restart the backend.
7. Confirm the same connection is still returned after restart.
8. Validate webhook protection with no secret / invalid secret / valid secret.

### Running the Server

**Development (with auto-reload):**

```bash
npm run dev
```

Server starts at: `http://localhost:3001`

**Production:**

```bash
npm run build
npm start
```

**Type checking:**

```bash
npm run lint
```

## API Endpoints

### Authentication

#### `POST /api/auth/login`

Generate JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "any_password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "refreshExpiresIn": 2592000,
  "user": {
    "userId": "dXNlckBleGFtcG...",
    "email": "user@example.com"
  }
}
```

**Rate Limit:** 5 requests per 15 minutes

---

#### `POST /api/auth/refresh`

Refresh access token.

**Request (preferred):**
```json
{
  "refreshToken": "<refresh_token>"
}
```

**Legacy mode (still supported):**
```
Authorization: Bearer <old_token>
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "refreshExpiresIn": 2592000
}
```

---

#### `GET /api/auth/oauth/google/start`

Starts Google OAuth scaffold flow and returns URL + state.

**Response:**
```json
{
  "provider": "google",
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "a1b2c3...",
  "expiresIn": 600,
  "mockMode": true
}
```

---

#### `GET /api/auth/oauth/google/callback`

OAuth callback endpoint.

**Query:**
```
code=<oauth_code>&state=<oauth_state>
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "userId": "google_...",
    "email": "google-user@flowfinance.test"
  },
  "oauth": {
    "provider": "google",
    "linked": true
  }
}
```

---

#### `GET /api/auth/validate`

Check if token is valid (optional auth).

**Headers:**
```
Authorization: Bearer <token>  (optional)
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "userId": "dXNlckBleGFtcG...",
    "email": "user@example.com"
  },
  "expiresIn": 604500
}
```

---

#### `POST /api/auth/logout`

Logout and revoke refresh tokens.

**Request (at least one):**
- `Authorization: Bearer <access_token>`
- body `{ "refreshToken": "<refresh_token>" }`

**Response:**
```json
{
  "success": true,
  "revokedRefreshTokens": 1,
  "message": "Logged out successfully. Please clear tokens on the client side."
}
```

### AI Operations

All endpoints require `Authorization: Bearer <token>` header.

#### `POST /api/ai/interpret`

Parse smart input (text → transactions/reminders).

**Request:**
```json
{
  "text": "Gastei R$50 no mercado ontem",
  "memoryContext": "Sou freelancer com receita variável"
}
```

**Response:**
```json
{
  "intent": "transaction",
  "data": [
    {
      "amount": 50,
      "description": "Mercado",
      "category": "Pessoal",
      "type": "Despesa"
    }
  ]
}
```

**Rate Limit:** 10 requests per minute

---

#### `POST /api/ai/scan-receipt`

OCR document parsing (receipt, invoice, etc.).

**Request:**
```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAA...",
  "imageMimeType": "image/jpeg",
  "context": "Compra de material de escritório"
}
```

**Response:**
```json
{
  "amount": 125.50,
  "description": "Papelaria ABC",
  "date": "2024-01-15",
  "category": "Trabalho",
  "type": "Despesa"
}
```

---

#### `POST /api/ai/classify-transactions`

Classify and categorize transactions.

**Request:**
```json
{
  "transactions": [
    { "description": "Magalu", "amount": 89.90, "date": "2024-01-14" },
    { "description": "Freelance JP", "amount": 1500, "date": "2024-01-13" }
  ]
}
```

**Response:**
```json
[
  {
    "category": "Pessoal",
    "type": "Despesa",
    "confidence": 0.95
  },
  {
    "category": "Negócio",
    "type": "Receita",
    "confidence": 0.98
  }
]
```

---

#### `POST /api/ai/insights`

Generate financial insights.

**Request (Daily):**
```json
{
  "transactions": [...],
  "type": "daily"
}
```

**Response (Daily):**
```json
[
  {
    "title": "Gastos acima da média",
    "description": "Seus gastos com alimentação estão 20% acima do normal",
    "type": "alerta"
  }
]
```

**Request (Strategic):**
```json
{
  "transactions": [...],
  "type": "strategic"
}
```

**Response (Strategic):**
```json
{
  "summary": "Você está em bom estado financeiro...",
  "strengths": [...],
  "weaknesses": [...],
  "risks": [...],
  "opportunities": [...],
  "actions": [...]
}
```

---

#### `POST /api/ai/token-count`

Count tokens for cost estimation.

**Request:**
```json
{
  "text": "Seu texto aqui para contar tokens"
}
```

**Response:**
```json
{
  "tokenCount": 12
}
```

### System

#### `GET /health`

Server health check.

**Response:**
```json
{
  "status": "ok|degraded|error",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 123.45,
  "version": "0.1.0",
  "dependencies": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy|not_configured" },
    "ai": { "openaiConfigured": true, "geminiConfigured": false }
  }
}
```

---

#### `GET /api/version`

API version.

**Response:**
```json
{
  "version": "0.1.0",
  "environment": "development"
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "timestamp": "2024-01-15T10:30:00Z",
  "details": {}
}
```

**Common Status Codes:**
- `400`: Bad request (invalid input)
- `401`: Unauthorized (missing/invalid token)
- `429`: Too many requests (rate limited)
- `500`: Server error

## Rate Limiting

The server enforces tiered rate limits:

| Endpoint Category | Limit | Window |
|---|---|---|
| General (all) | 100 | 15 min |
| Auth (`/api/auth/*`) | 5 | 15 min |
| AI (`/api/ai/*`) | 10 | 1 min |

**Rate-limit headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1705314600
```

## Environment Variables

See [.env.example](.env.example) for all available options.

**Critical (must set):**
- `OPENAI_API_KEY` or `GEMINI_API_KEY` — At least one AI provider key
- `JWT_SECRET` — Strong random string for signing tokens

**Optional (sensible defaults):**
- `PORT` — Default: 3001
- `NODE_ENV` — Default: development
- `FRONTEND_URL` — Default: http://localhost:5173
- `LOG_LEVEL` — Default: info

## Development Workflow

### Watch Mode

Auto-recompile on file changes:

```bash
npm run dev
```

### Testing Request

Using `curl`:

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Use returned token
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Interpret
curl -X POST http://localhost:3001/api/ai/interpret \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Gastei R$50 no mercado"}'
```

Using Postman or VS Code REST Client (`.rest` file):

```http
### Login
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "test"
}

### Interpret
POST http://localhost:3001/api/ai/interpret
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "text": "Gastei R$50 no mercado"
}
```

## Deployment

### Local Testing

```bash
npm run build
npm start
```

### Docker (Optional)

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3001

CMD ["npm", "start"]
```

Build & run:

```bash
docker build -t flow-finance-api .
docker run -p 3001:3001 --env-file .env flow-finance-api
```

### Environment Variables (Production)

Use a secure secrets manager:

- **AWS Secrets Manager**
- **Google Cloud Secret Manager**
- **Azure Key Vault**
- **Heroku Config Vars**

Never commit `.env` to version control. Use `.env.example` as template only.

## Troubleshooting

### "No AI provider configured"

**Solution:** Make sure `.env` file exists and contains at least one key: `OPENAI_API_KEY` or `GEMINI_API_KEY`.

```bash
cat .env | grep -E "OPENAI_API_KEY|GEMINI_API_KEY"
```

### "Invalid token" errors

**Solution:** Tokens expire after 7 days. Call `/api/auth/refresh` to get a new one.

### Rate limit exceeded

**Solution:** Wait for the window to reset (see `X-RateLimit-Reset` header). Or contact admin to adjust limits.

### CORS errors (frontend can't call backend)

**Solution:** Ensure `FRONTEND_URL` environment variable matches your frontend origin:

```env
FRONTEND_URL=http://localhost:5173
```

## Security Notes

- **API Keys**: AI provider keys stay server-side only — never exposed to client
- **AI Providers**: OpenAI and Gemini are server-side only; no provider key is exposed to frontend
- **Tokens**: JWT tokens are stateless and expire after 7 days
- **Secrets**: Use environment variables for all secrets (never hardcode)
- **HTTPS**: Always use HTTPS in production (Helmet enforces secure headers)
- **Rate Limiting**: Protects against abuse and DDoS attacks
- **CORS**: Only allows requests from whitelisted `FRONTEND_URL`

### AI CFO Hardening (v0.9.1)

- `POST /api/ai/cfo` now follows the same protected chain as other AI routes:
  - JWT auth required
  - workspace context required
  - rate limit per user
  - quota guard (`aiQueries`)
- Request schema enforcement:
  - `question`: required, max 1000 chars
  - `context`: optional, max 20000 chars
  - `intent`: optional enum (`spending_advice`, `budget_question`, `risk_question`, `savings_question`, `investment_question`, `general_finance`)
- Controller normalization applies safe defaults and rejects malformed payloads.

## Monitoring

Logs are output to console with structured format (Pino JSON).

In production, send logs to:
- **CloudWatch** (AWS)
- **Stackdriver** (Google Cloud)
- **Datadog**
- **New Relic**

Enable pretty-print during development:

```env
LOG_PRETTY=true
LOG_LEVEL=debug
```

## Next Steps

1. ✅ Backend API server created
2. ⬜ Frontend integration tests
3. ⬜ Sentry error tracking setup
4. ⬜ Database integration (replace mock auth)
5. ⬜ Production deployment

## Contributing

See [CONTRIBUTING.md](../docs/CONTRIBUTING.md) for guidelines.

## License

See [LICENSE](../LICENSE) for details.

---

**Questions?** Start the dev server and check logs:

```bash
npm run dev
```

🎉 Happy coding!
