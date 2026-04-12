# 🚀 Configuração do Vercel - Flow Finance

> **Este guia resolve os 4 problemas críticos de deploy identificados**

## 📋 Índice
- [Problema Identificado](#-problema-identificado)
- [Solução Completa](#-solução-completa)
- [Frontend](#-configuração-frontend)
- [Backend](#-configuração-backend)
- [Validação](#-validação)
- [Troubleshooting](#-troubleshooting)

---

## 🔥 Problema Identificado

### Erro atual no console:
```
https://api.flowfinance.app/api/ai/insights
ERR_NAME_NOT_RESOLVED
```

### Causa raiz:
❌ Frontend está tentando chamar `https://api.flowfinance.app`  
✅ Backend real está em `https://flow-finance-backend.vercel.app`

### Impacto:
- ❌ AI CFO quebra
- ❌ Insights não funcionam
- ❌ AI Orchestrator falha
- ❌ Autopilot não executa

---

## ✅ Solução Completa

### 1️⃣ Configurar variável de ambiente no Frontend (Vercel)

No projeto **Frontend** do Vercel:

```bash
# Acesse: https://vercel.com/seu-usuario/flow-finance-frontend/settings/environment-variables

# Adicione:
VITE_API_PROD_URL=https://flow-finance-backend.vercel.app
```

**IMPORTANTE:**
- ✅ Marcar para: **Production**, **Preview** e **Development**
- ✅ Salvar
- ✅ **Redeploy** o projeto frontend

### 2️⃣ Verificar variáveis do Backend

No projeto **Backend** do Vercel:

```bash
# Acesse: https://vercel.com/seu-usuario/flow-finance-backend/settings/environment-variables

# Variáveis obrigatórias:
GEMINI_API_KEY=sua-chave-aqui
OPENAI_API_KEY=sua-chave-aqui
NODE_ENV=production
APP_VERSION=0.4.0

# Opcional (para permitir frontend):
FRONTEND_URL=https://flow-finance-frontend-nine.vercel.app
```

### 3️⃣ Limpar cache do Vercel

No dashboard do Vercel:

1. **Frontend**: Deployments → ⋯ (três pontos) → **Redeploy** → ✅ **Clear build cache**
2. **Backend**: Deployments → ⋯ (três pontos) → **Redeploy** → ✅ **Clear build cache**

### 4️⃣ Limpar Service Worker no browser

No browser (após deploy):

1. Abrir DevTools (F12)
2. **Application** → **Service Workers**
3. Clicar **Unregister** em todos os SWs
4. **Application** → **Storage** → **Clear site data**
5. Hard refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)

---

## 🎨 Configuração Frontend

### Estrutura de configuração da API

O código já está correto em [`src/config/api.config.ts`](./src/config/api.config.ts):

```typescript
const BACKEND_BASE_URL = (() => {
  if (IS_DEVELOPMENT) {
    return import.meta.env.VITE_API_DEV_URL || 'http://localhost:3001';
  }
  // Fallback correto para produção
  return import.meta.env.VITE_API_PROD_URL || 'https://flow-finance-backend.vercel.app';
})();
```

✅ **Já implementado** - O código usa o fallback correto.

### O que falta:

Apenas configurar a variável no Vercel:

```bash
VITE_API_PROD_URL=https://flow-finance-backend.vercel.app
```

### Por que isso acontece:

Quando você faz deploy no Vercel **sem** configurar `VITE_API_PROD_URL`, o Vite **não substitui** a variável, e o fallback é usado.

O fallback está correto (`https://flow-finance-backend.vercel.app`), então **em teoria funciona**.

**MAS:**  
Se você tem **cache antigo** ou **Service Worker antigo**, o browser pode estar usando um build antigo com URL errada.

---

## 🔧 Configuração Backend

### Endpoints disponíveis:

O backend já tem os endpoints corretos:

```typescript
// Health check
GET /health
Response: { status: "ok", timestamp, uptime, version }

// Version check
GET /api/version
Response: { version: "0.4.0", environment: "production" }

// AI routes
POST /api/ai/cfo
POST /api/ai/interpret
POST /api/ai/insights
POST /api/ai/scan-receipt
POST /api/ai/classify-transactions
POST /api/ai/token-count
```

### Trust Proxy configurado:

✅ Já implementado em [`backend/src/index.ts`](./backend/src/index.ts):

```typescript
app.set('trust proxy', true);
```

Isso resolve o erro `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` do express-rate-limit.

---

## ✅ Validação

### 1. Testar backend diretamente:

```bash
# Health check
curl https://flow-finance-backend.vercel.app/health

# Esperado:
{
  "status": "ok",
  "timestamp": "2026-03-09T...",
  "uptime": 123.45,
  "version": "0.4.0"
}
```

### 2. Testar API version:

```bash
curl https://flow-finance-backend.vercel.app/api/version

# Esperado:
{
  "version": "0.4.0",
  "environment": "production"
}
```

### 3. Testar CFO endpoint:

```bash
curl -X POST https://flow-finance-backend.vercel.app/api/ai/cfo \
  -H "Content-Type: application/json" \
  -d '{"question":"Como estão minhas finanças?","context":"Saldo: R$ 1000","intent":"monthly_summary"}'

# Esperado: { "answer": "..." }
```

### 4. Verificar frontend:

1. Abrir: https://flow-finance-frontend-nine.vercel.app
2. Abrir DevTools → Network
3. Filtrar por `ai`
4. Abrir AI CFO ou qualquer feature de IA
5. Verificar que as requisições vão para:
   ```
   https://flow-finance-backend.vercel.app/api/ai/*
   ```

✅ Se aparecer `https://api.flowfinance.app`, significa que o cache não foi limpo.

---

## 🔍 Troubleshooting

### Problema: Ainda aparece `api.flowfinance.app`

**Causa:** Cache do Vercel ou Service Worker antigo

**Solução:**
1. Limpar cache do Vercel (Redeploy com "Clear build cache")
2. Limpar Service Worker no browser
3. Hard refresh: `Ctrl+Shift+R`

---

### Problema: `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` no backend

**Causa:** Trust proxy não configurado (JÁ RESOLVIDO)

**Status:** ✅ Já implementado no código

---

### Problema: `SyntaxError: Expected property name or '}'`

**Causa:** JSON inválido sendo enviado ao backend

**Solução:** ✅ Já implementado:
- Middleware de validação JSON em [`backend/src/middleware/jsonValidation.ts`](./backend/src/middleware/jsonValidation.ts)
- Helper `safeJsonParse` em [`backend/src/utils/jsonHelpers.ts`](./backend/src/utils/jsonHelpers.ts)

O backend agora retorna erro estruturado:
```json
{
  "error": "Bad Request",
  "code": "INVALID_JSON",
  "message": "Request body contains invalid JSON",
  "timestamp": "...",
  "path": "/api/ai/cfo"
}
```

---

### Problema: `Failed to fetch dynamically imported module`

**Causa:** Service Worker servindo bundle antigo após deploy novo

**Solução:**
1. Desregistrar Service Worker:
   - DevTools → Application → Service Workers → Unregister
2. Limpar storage:
   - DevTools → Application → Clear site data
3. Hard refresh: `Ctrl+Shift+R`

**Prevenção futura:**

Considerar adicionar versionamento no Service Worker em [`public/sw.js`](./public/sw.js):

```javascript
const CACHE_VERSION = 'v0.4.0';
```

---

### Problema: AI CFO retorna 500

**Verificar logs no Vercel:**

1. Backend → Runtime Logs
2. Procurar por:
   - `CFO generation error`
   - `Failed to generate CFO response`
3. Verificar se API keys estão configuradas:
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY`

---

### Problema: CORS error

**Causa:** Frontend URL não está na lista de allowed origins

**Solução:**

Backend já permite esses domínios:
- `http://localhost:3078`
- `http://localhost:5173`
- `https://flow-finance-frontend-nine.vercel.app`

Se usar domínio diferente, adicionar variável no backend:

```bash
FRONTEND_URL=https://seu-frontend-customizado.vercel.app
```

---

## 📊 Checklist de Deploy

### Frontend (Vercel)
- [ ] `VITE_API_PROD_URL` configurada
- [ ] `VITE_FIREBASE_API_KEY` configurada
- [ ] `VITE_FIREBASE_PROJECT_ID` configurada
- [ ] `VITE_SENTRY_DSN` configurada (opcional)
- [ ] Redeploy com cache limpo
- [ ] Verificar Network tab - requests vão para backend correto

### Backend (Vercel)
- [ ] `GEMINI_API_KEY` configurada
- [ ] `OPENAI_API_KEY` configurada (pelo menos uma obrigatória)
- [ ] `NODE_ENV=production`
- [ ] `APP_VERSION` configurada (opcional)
- [ ] `FRONTEND_URL` configurada (se usar domínio custom)
- [ ] Redeploy com cache limpo
- [ ] Testar `/health` endpoint
- [ ] Testar `/api/version` endpoint

### Browser
- [ ] Service Worker desregistrado
- [ ] Cache limpo (Clear site data)
- [ ] Hard refresh executado
- [ ] DevTools mostra requests para `flow-finance-backend.vercel.app`

---

## 🎯 Resumo da Solução

### Problema 1: API não resolve ❌
**Causa:** Variável `VITE_API_PROD_URL` não configurada + cache antigo  
**Solução:** ✅ Configurar variável no Vercel + limpar cache

### Problema 2: Express trust proxy ❌
**Causa:** Vercel usa proxy reverso  
**Solução:** ✅ Já implementado - `app.set('trust proxy', true)`

### Problema 3: Chunk Vite quebrado ❌
**Causa:** Service Worker servindo bundle antigo  
**Solução:** ✅ Desregistrar SW + limpar storage + hard refresh

### Problema 4: JSON parse error ❌
**Causa:** JSON.parse sem try-catch + validação fraca  
**Solução:** ✅ Implementado:
- `safeJsonParse()` helper
- `validateJsonMiddleware`
- Erros estruturados

---

## 🚀 Comandos Rápidos

### Configurar variável no Vercel (CLI):

```bash
# Frontend
vercel env add VITE_API_PROD_URL production
# Digite: https://flow-finance-backend.vercel.app

# Backend
vercel env add GEMINI_API_KEY production
vercel env add OPENAI_API_KEY production
vercel env add NODE_ENV production
```

### Redeploy com cache limpo:

```bash
vercel --prod --force
```

---

## 📞 Suporte

Se após seguir todos os passos ainda houver problemas:

1. Verificar logs do backend: Vercel → Backend Project → Runtime Logs
2. Verificar logs do frontend: Browser DevTools → Console
3. Verificar Network tab: Confirmar URL das requests
4. Abrir issue no GitHub com:
   - Screenshot dos logs
   - Screenshot do Network tab
   - Variáveis de ambiente configuradas (SEM valores sensíveis)

---

**Status:** ✅ Código corrigido - Aguardando configuração no Vercel  
**Última atualização:** 2026-03-09  
**Versão:** 0.4.0

