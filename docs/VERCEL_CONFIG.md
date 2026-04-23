# Configuracao do Vercel

## Papel deste documento

Este documento define a configuracao minima de ambiente para que o Flow Finance seja validado com honestidade no Vercel.

Ele responde a duas perguntas:

1. quais variaveis precisam existir
2. que condicoes tornam o ambiente realmente verificavel

## Links oficiais atuais

- Frontend principal: https://flow-finance-frontend-nine.vercel.app/
- Backend principal: https://flow-finance-backend.vercel.app/
- Frontend alternativo: https://flow-finance-xi.vercel.app/

## Objetivo da configuracao correta

Garantir que:

- frontend e backend estejam apontando para os destinos corretos
- versionamento esteja exposto
- observabilidade minima esteja preparada
- a validacao externa nao seja confundida com um deploy apenas publicado

## Variaveis criticas do frontend

```env
VITE_API_PROD_URL=https://flow-finance-backend.vercel.app/
VITE_APP_VERSION=
VITE_SENTRY_DSN=  # preferencial no frontend
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
```

## Variaveis criticas do backend

```env
APP_VERSION=
SENTRY_DSN=
OPENAI_API_KEY=
GEMINI_API_KEY=
FRONTEND_URL=https://flow-finance-frontend-nine.vercel.app/
```

## Regras praticas

### URLs

- o frontend deve apontar para o backend oficial
- o backend deve permitir retorno para o frontend oficial
- nao usar dominios historicos, placeholders ou hosts nao resolviveis

### Versao

Sem `VITE_APP_VERSION` e `APP_VERSION`, a validacao de `/api/version` fica incompleta.

### Observabilidade

Sem DSN configurado, a trilha de observabilidade fica parcialmente aberta. No frontend, priorize `VITE_SENTRY_DSN`; `SENTRY_DSN` segue obrigatorio no backend e funciona como fallback legado do frontend no build. O bootstrap silencioso evita ruido, mas nao substitui configuracao real de ambiente.

### Acesso ao preview

Se a URL estiver protegida por Vercel Authentication antes da aplicacao responder, ela nao serve como evidencia automatizada de health.

## Checklist operacional

- [ ] `VITE_API_PROD_URL` apontando para o backend correto
- [ ] `FRONTEND_URL` alinhado ao frontend oficial
- [ ] `VITE_APP_VERSION` preenchido
- [ ] `APP_VERSION` preenchido
- [ ] `VITE_SENTRY_DSN` preenchido no frontend quando aplicavel
- [ ] `SENTRY_DSN` preenchido no backend quando aplicavel
- [ ] fallback legado via `SENTRY_DSN` no frontend usado apenas quando necessario
- [ ] preview ou URL compartilhada acessivel para verificacao

## Referencias relacionadas

- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [OPERATIONS_README.md](./OPERATIONS_README.md)

