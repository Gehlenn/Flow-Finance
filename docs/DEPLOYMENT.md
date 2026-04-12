# Guia Geral de Deploy

## Papel deste documento

Este arquivo e o indice curto de deploy do projeto. Ele aponta para o processo correto e evita que a estrategia operacional fique espalhada.

## Plataforma ativa

O fluxo oficial atual e:

- frontend no Vercel
- backend no Vercel

Links oficiais:

- Frontend principal: https://flow-finance-frontend-nine.vercel.app/
- Backend principal: https://flow-finance-backend.vercel.app/
- Frontend alternativo: https://flow-finance-xi.vercel.app/

## Ordem correta

1. validar localmente
2. publicar preview
3. alinhar variaveis de ambiente
4. validar URL acessivel no ambiente alvo
5. rodar os checks de health e version

## Checks minimos antes do fechamento

```bash
npm run lint
npm run test:coverage:critical
npm run health:runtime
npm run health:runtime:mobile
```

Para o alvo Vercel:

```bash
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

## Criterio de pronto

Um deploy so deve ser tratado como pronto quando:

1. a URL alvo responde a aplicacao real
2. `/health`, `/api/health` e `/api/version` estao validados
3. versao e observabilidade estao configuradas no ambiente
4. o preview nao esta bloqueando a verificacao antes da aplicacao responder

## O que este documento nao deve repetir

- configuracao detalhada de variaveis
- fluxo especifico do Vercel
- status diario do ambiente

Para isso, usar:

- [docs/VERCEL_CONFIG.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_CONFIG.md)
- [docs/VERCEL_DEPLOYMENT.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_DEPLOYMENT.md)
- [docs/DEPLOYMENT_STATUS.md](E:\app e jogos criados\Flow-Finance\docs\DEPLOYMENT_STATUS.md)
