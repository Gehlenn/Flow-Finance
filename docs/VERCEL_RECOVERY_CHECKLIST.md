# Checklist de recuperaÃ§Ã£o do Vercel

Este checklist existe para o caso em que o domÃ­nio backend passa a responder HTML na raiz e `404` nas rotas de saÃºde. Nessa situaÃ§Ã£o, o problema mais provÃ¡vel nÃ£o Ã© o contrato do Express, e sim o projeto/alias do Vercel apontando para o lugar errado.

## Estado vivo em 2026-05-25

- o backend oficial ja foi revalidado em `0.9.7`
- o contrato publico atual responde `200` em `/health` e `/api/health`, e `0.9.7` em `/api/version`
- use esta pagina apenas para regressao futura ou para um novo desalinhamento de alias/projeto


## Sintoma esperado

- `https://flow-finance-backend.vercel.app/` responde `200` com HTML
- `/health`, `/api/health` e `/api/version` retornam `404`
- `npm run health:vercel` classifica o alvo como shell do frontend apontado no lugar do backend API-only

## O que verificar no Vercel

1. O projeto do backend estÃ¡ separado do frontend.
2. O `root directory` do projeto backend Ã© `backend/`.
3. O entrypoint serverless do backend continua sendo `backend/api/index.ts`.
4. O domÃ­nio `flow-finance-backend.vercel.app` estÃ¡ apontando para o projeto backend, nÃ£o para o projeto frontend.
5. Nenhum alias do backend foi reaproveitado pelo projeto do frontend.
6. As variÃ¡veis de ambiente de backend continuam corretas:
   - `APP_VERSION`
   - `SENTRY_DSN`
   - `FRONTEND_URL`
   - credenciais reais do runtime, quando aplicÃ¡vel

## RevalidaÃ§Ã£o local

Depois de corrigir o projeto:

```bash
VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app/ npm run health:vercel
```

Resultado desejado:

- `/health` responde `200`
- `/api/health` responde `200`
- `/api/version` responde `200`
- a raiz nÃ£o deve parecer o shell do frontend

## ReferÃªncias

- [docs/DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [docs/ROADMAP.md](./ROADMAP.md)
- [docs/VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
