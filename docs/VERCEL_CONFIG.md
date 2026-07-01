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
- o projeto backend no Vercel esteja com `root directory = backend/`
- o dominio backend nao resolva para o shell do frontend

## Variaveis criticas do frontend

```env
VITE_API_PROD_URL=https://flow-finance-backend.vercel.app/
VITE_APP_VERSION=
VITE_SENTRY_DSN=
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

## Revalidacao atual

- Em `2026-05-25`, o frontend principal responde `200`.
- Em `2026-05-25`, o backend oficial responde:
  - `GET /` -> `404` esperado para backend API-only
  - `GET /health` -> `200`
  - `GET /api/health` -> `200`
  - `GET /api/version` -> `200` com `version = 0.9.7`
- O mismatch anterior de versao publicada foi resolvido em `2026-05-25` com redeploy do backend oficial e override persistido de `APP_VERSION`.
- Em `2026-05-25`, o Vercel listou como provisionados em producao: `VITE_APP_VERSION`, `VITE_SENTRY_DSN`, `APP_VERSION` e `SENTRY_DSN`.

## Headers publicados

Validacao viva em `2026-07-01`:

- backend oficial em `/health` e `/` expoe `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `X-Request-Id`
- frontend oficial em `/` expoe `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`; CSP esta em `script-src 'self'` e `style-src 'self' https://fonts.googleapis.com` no deploy `dpl_3aMx98ErwTseg6TDbhRJgYnsMdFs`
- frontend alternativo `https://flow-finance-xi.vercel.app/` expoe os mesmos headers e CSP no deploy `dpl_FjwvsZVfZDKESRS38rt7g2Hr5ZQo`
- o runner de evidencia para este recorte e `npm run health:published-headers`; para o alias alternativo use `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers`
- observacao: `script-src` nao permite mais `unsafe-inline` nem `https://esm.sh`; `style-src` tambem nao permite mais `unsafe-inline` no frontend publicado
- inventario local: `npm run health:csp-readiness` passou com `scriptBlockers: []` e `styleBlockers: []`; o artefato atual e `test-results/csp-readiness/2026-07-01T18-03-23-764Z.json`

## Regras praticas

### URLs

- o frontend deve apontar para o backend oficial
- o backend deve permitir retorno para o frontend oficial
- nao usar dominios historicos, placeholders ou hosts nao resolviveis

### Versao

Sem `VITE_APP_VERSION` e `APP_VERSION`, a validacao de `/api/version` fica incompleta. Na revalidacao atual, ambos ja aparecem provisionados em producao.

### Observabilidade

Sem DSN configurado, a trilha de observabilidade fica parcialmente aberta. Na revalidacao atual, `VITE_SENTRY_DSN` e `SENTRY_DSN` ja aparecem provisionados em producao; o que segue pendente e a evidencia final de uso e acesso quando necessario. No frontend, priorize `VITE_SENTRY_DSN`; `SENTRY_DSN` segue obrigatorio no backend e funciona como fallback legado do frontend no build.

### Acesso ao preview

Se a URL estiver protegida por Vercel Authentication antes da aplicacao responder, ela nao serve como evidencia automatizada de health.

### Root directory do backend

O backend precisa ser publicado como projeto Vercel separado, com raiz em `backend/` e entrypoint serverless em `backend/api/index.ts`.

Se o dominio backend responder HTML na raiz e `404` em `/health`, `/api/health` e `/api/version`, o problema mais provavel e alias/projeto apontando para a aplicacao errada, nao falha do contrato no codigo.

### Troubleshooting rapido

1. Conferir se o projeto do backend no painel do Vercel aponta para o diretorio `backend/`.
2. Conferir se o dominio `flow-finance-backend.vercel.app` nao foi movido para o projeto do frontend por engano.
3. Se o contrato de health/version regredir, conferir `APP_VERSION` antes do proximo redeploy.
4. Reexecutar `npm run health:vercel` depois de qualquer alteracao de deploy ou ambiente.

## Checklist operacional

- [ ] `VITE_API_PROD_URL` apontando para o backend correto
- [ ] `FRONTEND_URL` alinhado ao frontend oficial
- [x] `VITE_APP_VERSION` preenchido
- [x] `APP_VERSION` alinhado com o backend oficial (`0.9.7` em 2026-05-25)
- [x] `VITE_SENTRY_DSN` preenchido no frontend quando aplicavel
- [x] `SENTRY_DSN` preenchido no backend quando aplicavel
- [ ] preview ou URL compartilhada acessivel para verificacao
- [ ] `GET /api/version` respondendo a versao esperada do repo atual

## Referencias relacionadas

- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [VERCEL_RECOVERY_CHECKLIST.md](./VERCEL_RECOVERY_CHECKLIST.md)
- [OPERATIONS_README.md](./OPERATIONS_README.md)
