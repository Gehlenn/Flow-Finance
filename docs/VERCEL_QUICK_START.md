# Vercel - Inicio Rapido

## Papel deste documento

Este e o checklist mais curto para operar o projeto no Vercel sem reler o guia completo.

## Links oficiais atuais

- Frontend principal: https://flow-finance-frontend-nine.vercel.app/
- Backend principal: https://flow-finance-backend.vercel.app/
- Frontend alternativo: https://flow-finance-xi.vercel.app/

## Passos

1. `vercel login`
2. `vercel link`
3. preencher variaveis criticas
4. publicar preview
5. rodar `npm run health:vercel` contra URL acessivel

## Comandos

```bash
vercel login
vercel link
npm run deploy:preview
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

## Sinal de bloqueio

Se houver `blockedByVercelAuth=true` ou `401` antes da aplicacao responder, o problema atual e acesso ao preview, nao prova de falha da aplicacao.

## Referencias

- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
