# 🔧 Guia de Configuração do Sentry - Flow Finance v0.9.6

**Objetivo**: ativar observabilidade avançada (crash reporting, session replay, performance monitoring).

---

## Passo 1: Criar/Acessar Projeto Sentry

### 1.1 Se você ainda não tem conta
- Visite: https://sentry.io/signup/
- Crie conta (gratuito começa com 5K events/mês)
- Confirme o e-mail

### 1.2 Se já tem conta
- Vá para: https://sentry.io/auth/login/
- Faça login

---

## Passo 2: Criar Dois Projetos Sentry

Você precisa de **dois DSNs**: um para backend e outro para frontend (plataformas diferentes).

### 2.1 Projeto Backend (Node.js)
```
Dashboard Sentry → Projects → Create Project
  Platform: Node.js
  Name: flow-finance-backend
  Alert rule: Default
  [Create Project]
```

Após criar, você verá:
```
DSN: https://YOUR_KEY@YOUR_ID.ingest.sentry.io/YOUR_PROJECT_ID
```
**Copie esse DSN inteiro** — será `SENTRY_DSN` para backend.

### 2.2 Projeto Frontend (React)
```
Dashboard Sentry → Projects → Create Project
  Platform: React
  Name: flow-finance-frontend
  Alert rule: Default
  [Create Project]
```

Após criar, você verá:
```
DSN: https://YOUR_KEY@YOUR_ID.ingest.sentry.io/YOUR_FRONTEND_PROJECT_ID
```
**Copie esse DSN inteiro** — será `VITE_SENTRY_DSN` para frontend.

---

## Passo 3: Configurar em Produção (Vercel)

Depois de ter os dois DSNs, execute estes comandos:

### 3.1 Backend (flow-finance-backend)
```bash
# Linkar projeto
npx vercel link --yes --project flow-finance-backend

# Adicionar SENTRY_DSN
npx vercel env add SENTRY_DSN production --value "https://YOUR_KEY@YOUR_ID.ingest.sentry.io/YOUR_PROJECT_ID" --yes --force

# Redeploy
npx vercel --prod --yes
```

### 3.2 Frontend (flow-finance-frontend)
```bash
# Linkar projeto
npx vercel link --yes --project flow-finance-frontend

# Adicionar VITE_SENTRY_DSN
npx vercel env add VITE_SENTRY_DSN production --value "https://YOUR_KEY@YOUR_ID.ingest.sentry.io/YOUR_FRONTEND_PROJECT_ID" --yes --force

# Redeploy
npx vercel --prod --yes
```

---

## Passo 4: Validar Após Deploy

```bash
# Testar health check
VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app npm run health:vercel

# Você deve ver:
# "observability": { "sentryConfigured": true }  ← mudou de false!
```

---

## ✅ Checklist Sentry Setup

- [ ] Conta Sentry criada
- [ ] Projeto Backend criado
- [ ] Projeto Frontend criado
- [ ] DSN Backend copiado
- [ ] DSN Frontend copiado
- [ ] Backend SENTRY_DSN configurado em Vercel
- [ ] Frontend VITE_SENTRY_DSN configurado em Vercel
- [ ] Backend redeployado
- [ ] Frontend redeployado
- [ ] Health check muestra sentryConfigured: true

---

## 💡 O Que Sentry Monitora Após Setup

| Métrica | O que é | Valor |
|---------|---------|-------|
| **Crashes** | Exceções não capturadas no código | Alertas em tempo real |
| **Session Replay** | Gravação de que o usuário fez antes do erro | Debug facilitado |
| **Performance** | Rastreamento de requisições lentas | Otimização |
| **Release Tracking** | Qual versão causou o problema | Correlação com deploys |
| **Error Grouping** | Agrupa erros similares | Priorização |

---

## 📝 Próximos Passos

1. Crie os projetos Sentry (5 minutos)
2. Copie os DSNs
3. Execute os comandos `npx vercel env add`
4. Redeploy backend + frontend
5. Validar com `npm run health:vercel`

**Pronto?** Vou executar o setup completo assim que você fornecer os DSNs.

---

**Tempo total esperado**: 15-20 minutos (criar projetos + configurar + redeploy)
