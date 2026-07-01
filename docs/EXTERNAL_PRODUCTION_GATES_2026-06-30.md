# Flow Finance - external production gates

Data: 2026-06-30
Status: HEADERS, SCRIPT CSP AND FIRESTORE PASS / STRIPE BLOCK REMAINS

## Escopo

Este documento registra a continuacao do backlog offline depois de UI, copy e pricing: Stripe/env publicado, headers publicados e Firestore emulator.

O objetivo nao e declarar producao pronta. E separar:

- implementado e validado offline;
- publicado e verificado;
- bloqueado por credencial, deploy, ambiente local ou uso real ausente.

## Stripe e billing

Status: OFFLINE COHERENCE PASS / PUBLISHED STRIPE BLOCK

Implementado:

- `backend/src/services/saas/billingService.ts` agora usa `4900` centavos como fallback de Pro quando `SAAS_PRO_MONTHLY_PRICE_CENTS` nao existe.
- `backend/.env.example` e `.env.example` documentam `SAAS_PRO_MONTHLY_PRICE_CENTS=4900`.
- `backend/.env.example` e `.env.example` listam variaveis do smoke test sem valores secretos.
- `backend/README.md` documenta que checkout real ainda depende de `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_MONTHLY` e `STRIPE_WEBHOOK_SECRET`.
- `tests/unit/billing-service.test.ts` cobre o fallback de `4900`.
- `tests/unit/monetization-plan.test.ts` trava que `backend/.env.example` segue alinhado ao preco Pro visivel.

Validado:

- `npx vitest run tests/unit/billing-service.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, `1` arquivo, `10` testes.
- `npx vitest run tests/unit/billing-service.test.ts tests/unit/monetization-plan.test.ts tests/unit/firestore-rules.static.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, `3` arquivos, `26` testes.
- `npm --prefix backend run type-check`: `PASS`.
- `npm run security:scan-secrets`: `PASS`.

Bloqueado:

- `npm run health:stripe-live-smoke`: `BLOCK`, artefato `test-results/stripe-live-smoke/2026-06-30T22-15-34-658Z.json`.
- Razao: faltam `STRIPE_LIVE_SMOKE_BACKEND_URL` ou alias, `STRIPE_LIVE_SMOKE_RETURN_URL`, auth bearer/cookie e `STRIPE_LIVE_SMOKE_WORKSPACE_ID`.
- `npm run health:launch-gates`: `BLOCK` porque `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_WEBHOOK_SECRET` e o smoke publicado ainda nao estao evidenciados no ambiente desta maquina.

SEM EVIDENCIA SUFICIENTE:

- Price ID real de Stripe alinhado a `R$ 49,00/mes`.
- Webhook publicado recebendo eventos reais.
- Portal real abrindo para customer correto.
- Customer por workspace consistente.
- Mudanca real de plano apos pagamento.

## Headers publicados

Status: BACKEND AND FRONTEND PUBLISHED PASS

Implementado:

- `scripts/check-published-headers.mjs` verifica headers publicados do backend e frontend, grava artefatos em `test-results/published-headers/`, e bloqueia regressao se o frontend voltar a permitir `'unsafe-inline'` ou `https://esm.sh` em `script-src`.
- `package.json` expoe `npm run health:published-headers`.
- `.vercelignore` exclui artefatos locais de upload para o Vercel.
- `vercel.json` usa `rewrites` em vez de `routes` legado, permitindo que os headers de alto nivel sejam aplicados ao SPA root.
- `index.html` nao usa mais importmap inline nem bootstrap inline; o bootstrap de service worker foi movido para `public/flow-bootstrap.js`.
- `vercel.json` agora publica `script-src 'self'` no frontend, sem `'unsafe-inline'` e sem `https://esm.sh`.

Validado:

- `npm run health:vercel`: `PASS`; backend oficial acessivel com `/health`, `/api/health` e `/api/version` em `200`, e `GET /` em `404` esperado para API-only.
- `npm run health:published-headers`: `PASS`, artefato `test-results/published-headers/2026-06-30T22-39-12-012Z.json`.
- `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers`: `PASS`, artefato `test-results/published-headers/2026-06-30T22-39-12-189Z.json`.
- `npm run health:published-headers`: `PASS`, artefato `test-results/published-headers/2026-07-01T12-47-26-231Z.json`, incluindo ausencia de violacoes em `script-src` no frontend oficial.
- `PUBLISHED_FRONTEND_URL=https://flow-finance-xi.vercel.app npm run health:published-headers`: `PASS`, artefato `test-results/published-headers/2026-07-01T12-48-04-023Z.json`, incluindo ausencia de violacoes em `script-src` no frontend alternativo.
- Backend publicado: `PASS` para `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `X-Request-Id`.
- Frontend oficial publicado: `PASS` para `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`; CSP de script publicada como `script-src 'self'`.
- Frontend alternativo publicado: `PASS` para os mesmos headers e para `script-src 'self'`.

Publicado:

- `flow-finance-frontend-nine.vercel.app` foi promovido no deploy `dpl_3YmbPgVcFhxv8HnmsMx6cFEPRDSi`.
- `flow-finance-xi.vercel.app` foi promovido no deploy `dpl_5qgv5j99TUAGBMbUncPavkvnAwU8`.
- `flow-finance-frontend-nine.vercel.app` recebeu script CSP estrita no deploy `dpl_YZc7iFsJtcBp3AX9Vky3N2eitwfV`.
- `flow-finance-xi.vercel.app` recebeu script CSP estrita no deploy `dpl_6r3DVKQsgVUVgQFBsFykko8W3oXu`.

SEM EVIDENCIA SUFICIENTE:

- CSP de estilo sem `unsafe-inline`; ha estilos runtime/React e componentes com estilos injetados que exigem migracao separada antes de remover essa permissao.

## Firestore emulator

Status: STATIC PASS / EMULATOR PASS

Implementado:

- `tests/unit/firestore-rules.static.test.ts` valida `firestore.rules`, `firebase.json` e `vitest.firestore.config.ts`.
- `scripts/run-firestore-rules.mjs` agora detecta um JDK 21 portatil em `.tmp/jdk21/` quando `JAVA_HOME` global nao aponta para Java 21+.

Validado:

- `npx vitest run tests/unit/firestore-rules.static.test.ts tests/unit/monetization-plan.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, `2` arquivos, `16` testes.
- `npx vitest run tests/unit/billing-service.test.ts tests/unit/monetization-plan.test.ts tests/unit/firestore-rules.static.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, `3` arquivos, `26` testes.
- `npm run test:firestore:rules`: `PASS`, `3` arquivos Firestore, `16` testes, usando `JAVA_HOME=E:\app e jogos criados\Flow-Finance\.tmp\jdk21\jdk-21.0.11+10`.

SEM EVIDENCIA SUFICIENTE:

- Comportamento real de regras em ambiente publicado.

## Veredito

O recorte externo avancou, mas nao fecha producao.

Fechado offline:

- fallback de billing Pro alinhado ao preco visivel;
- env examples sem placeholders secretos;
- testes estaticos de Firestore/config;
- runner de headers publicados com artefato;
- backend publicado saudavel e com headers;
- frontends oficial e alternativo publicados com headers.
- frontends oficial e alternativo publicados com `script-src 'self'`, sem script inline ou dependencia de `esm.sh` na CSP.

Ainda bloqueia:

- Stripe real sem credenciais/env/smoke publicado;
- habit proof e cohort state continuam fora deste recorte e ainda bloqueiam evidencia comercial.
