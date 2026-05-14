# Checklist de recuperação do Vercel

Este checklist existe para o caso em que o domínio backend passa a responder HTML na raiz e `404` nas rotas de saúde. Nessa situação, o problema mais provável não é o contrato do Express, e sim o projeto/alias do Vercel apontando para o lugar errado.

## Sintoma esperado

- `https://flow-finance-backend.vercel.app/` responde `200` com HTML
- `/health`, `/api/health` e `/api/version` retornam `404`
- `npm run health:vercel` classifica o alvo como shell do frontend apontado no lugar do backend API-only

## O que verificar no Vercel

1. O projeto do backend está separado do frontend.
2. O `root directory` do projeto backend é `backend/`.
3. O entrypoint serverless do backend continua sendo `backend/api/index.ts`.
4. O domínio `flow-finance-backend.vercel.app` está apontando para o projeto backend, não para o projeto frontend.
5. Nenhum alias do backend foi reaproveitado pelo projeto do frontend.
6. As variáveis de ambiente de backend continuam corretas:
   - `APP_VERSION`
   - `SENTRY_DSN`
   - `FRONTEND_URL`
   - credenciais reais do runtime, quando aplicável

## Revalidação local

Depois de corrigir o projeto:

```bash
VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app/ npm run health:vercel
```

Resultado desejado:

- `/health` responde `200`
- `/api/health` responde `200`
- `/api/version` responde `200`
- a raiz não deve parecer o shell do frontend

## Referências

- [docs/DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [docs/ROADMAP.md](./ROADMAP.md)
- [docs/VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
