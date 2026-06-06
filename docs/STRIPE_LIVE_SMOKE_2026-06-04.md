# Stripe Live Smoke 2026-06-04

Data: 2026-06-04
Status: documento operacional vivo. Em 2026-06-05 o gate externo de Stripe foi fechado com evidencia real publicada; o runner local continua existindo como pre-check e gerador de artefato, nao como substituto do checkout real no browser.

## Gate canonico

O gate externo continua sendo **Stripe real smoke**, conforme `docs/GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md`.

Este documento descreve o runner local `npm run health:stripe-live-smoke`, que existe para capturar evidencia auditavel do gate sem tocar no backend/runtime.

## Objetivo do runner

- registrar snapshot de ambiente com valores mascarados
- tentar criar `POST /api/saas/stripe/checkout-session` no backend alvo quando houver configuracao suficiente
- escrever artefato rastreavel em `test-results/stripe-live-smoke/`
- falhar com `BLOCK` quando faltar configuracao ou quando a execucao real nao puder ser comprovada

O runner nao deve gerar `PASS` falso. Sem comprovacao real de checkout, webhook, mudanca de plano e portal aberto, o resultado continua bloqueado. O fechamento real do gate pode exigir um passo browser/Playwright entre a criacao da checkout-session e a validacao final do estado do workspace.

## Entradas aceitas

### URL do backend alvo

Ordem de resolucao:

1. `STRIPE_LIVE_SMOKE_BACKEND_URL`
2. `FLOW_LAUNCH_TARGET_URL`
3. `VERCEL_TARGET_URL`

### Credenciais e contexto

- `STRIPE_LIVE_SMOKE_BEARER_TOKEN`
- `STRIPE_LIVE_SMOKE_COOKIE_HEADER`
- `STRIPE_LIVE_SMOKE_WORKSPACE_ID`
- `STRIPE_LIVE_SMOKE_RETURN_URL`

Prioridade de auth no runner:

1. `STRIPE_LIVE_SMOKE_BEARER_TOKEN`
2. `STRIPE_LIVE_SMOKE_COOKIE_HEADER`

Se os dois existirem, o bearer continua mandando para preservar o comportamento atual.

### Ambiente auditado

O runner tambem registra, de forma mascarada, se estes envs existem:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`

Esses valores sao relevantes para diagnostico, mas nao devem aparecer em claro no artefato.

## Como capturar o contexto real do frontend publicado

Use a sessao autenticada do frontend publicado, nao um valor inventado localmente.

### Capturar auth

Preferencia operacional:

1. Abra o frontend publicado no browser.
2. Autentique-se com a conta que vai usar no smoke.
3. Abra o DevTools na aba `Network`.
4. Recarregue a pagina ou execute uma acao autenticada.
5. Abra uma request autenticada e copie o valor do header `Cookie` exatamente como o browser enviou.
6. Defina esse valor em `STRIPE_LIVE_SMOKE_COOKIE_HEADER`, sem o prefixo literal `Cookie:`.

Se o fluxo expuser um access token de forma clara e auditavel, use `STRIPE_LIVE_SMOKE_BEARER_TOKEN` e deixe o cookie header de lado.

### Capturar `active_workspace_id`

No mesmo browser autenticado:

1. Abra o DevTools.
2. Va ate `Application` > `Local Storage` do dominio publicado, ou use o Console.
3. Leia `localStorage.getItem('active_workspace_id')`.
4. Copie o valor retornado para `STRIPE_LIVE_SMOKE_WORKSPACE_ID`.

Nao grave esse valor em claro na doc, no artefato ou em commit. Ele entra apenas no ambiente local de execucao.

## Contrato de execucao

Quando a configuracao minima estiver presente, o runner faz uma tentativa real de checkout contra o backend alvo:

```bash
npm run health:stripe-live-smoke
```

Se o backend responder `503`, o motivo costuma ser configuracao Stripe ausente no alvo. Se responder `200` com `url`, o runner registra a sessao, mas ainda marca `BLOCK` enquanto nao existir prova real dos proximos passos do gate.

## Evidencia operacional mais recente

Execucao observada em `2026-06-04T22:04:08.920Z`:

- backend alvo resolvido: `https://flow-finance-backend.vercel.app`
- returnUrl resolvida: `https://flow-finance-frontend-nine.vercel.app/settings?billing=return`
- segredos Stripe carregados do ambiente local: presentes
- resultado: `BLOCK`
- motivo objetivo: faltaram `STRIPE_LIVE_SMOKE_BEARER_TOKEN` ou `STRIPE_LIVE_SMOKE_COOKIE_HEADER`, e `STRIPE_LIVE_SMOKE_WORKSPACE_ID`
- artefato: `test-results/stripe-live-smoke/2026-06-04T22-04-08-920Z.json`

Leitura correta: o bloqueio atual nao e mais "segredo Stripe ausente"; o bloqueio passou a ser contexto real de autenticacao/workspace para provar o checkout live ponta a ponta. O runner agora aceita bearer ou cookie autenticado do frontend publicado, mas continua em `BLOCK` ate existir prova real do fluxo inteiro.

Execucao publicada aprofundada em `2026-06-05`:

- signup real no frontend publicado chegou ate a shell autenticada
- o browser mostrou falha de preflight para `POST /api/auth/firebase` e `GET /api/health` porque o backend nao aceitava o header `sentry-trace`
- a sessao Firebase capturada no frontend permitiu teste server-side direto contra o backend alvo:
  - `POST /api/auth/firebase` => `200`
  - `GET /api/workspace` => `200` com lista vazia para o usuario novo
  - `POST /api/workspace` => `500`
- leitura tecnica correta: o gate Stripe deixou de estar bloqueado por "como obter auth" e passou a estar bloqueado por dois bugs de runtime publicado:
  1. CORS sem `sentry-trace`/`baggage`
  2. provisioning de workspace derrubado por persistencia legada em escrita local
- fixes locais adicionados com cobertura:
  - `backend/src/config/cors.ts`
  - `backend/src/config/cors.test.ts`
  - `backend/tests/unit/cors-preflight.test.ts`
  - `backend/src/services/admin/workspaceStore.ts`
  - `backend/src/services/admin/workspaceStoreHelpers.ts`
  - `backend/tests/unit/workspace-store-observability.test.ts`

Leitura operacional correta agora: o gate continua `BLOCK`, mas por um motivo mais estreito e verificavel. O proximo passo obrigatorio nao era inventar credencial; era fazer deploy desses fixes e rerodar o smoke real.

Execucao apos deploy em `2026-06-05T02:27:29.531Z`:

- backend oficial revalidado em `https://flow-finance-backend.vercel.app`
- `POST /api/auth/firebase` => `200`
- `GET /api/workspace` => `200`
- `POST /api/workspace` => `201`
- `POST /api/saas/stripe/checkout-session` => `200`
- checkout URL real do Stripe recebida
- artefato: `test-results/stripe-live-smoke/2026-06-05T02-27-29-531Z.json`

Leitura correta do novo estado:

- o bug de CORS publicado foi fechado
- o bug de provisioning de workspace publicado foi fechado
- o gate Stripe continua aberto apenas porque o runner ainda nao comprova:
  1. webhook receipt
  2. workspace plan change
  3. portal open

Resumo honesto: o bloqueio deixou de ser tecnico de auth/provisioning e passou a ser estritamente de evidencia ponta a ponta de billing.

Execucao aprofundada em `2026-06-05T03:xxZ`:

- um checkout Stripe real foi concluido com sucesso no modo teste e redirecionou para uma URL valida do frontend publicado (`/?tab=workspaceadmin&billing=return&billing=success`), sem novo `404`
- o retorno ainda caiu na shell geral porque a SPA publicada ainda nao interpreta `tab=workspaceadmin`; o fix local foi aplicado em `hooks/useNavigationTabs.tsx`, `src/saas/billingReturnUrl.ts`, `components/Settings.tsx`, `pages/WorkspaceAdmin.tsx`, `pages/Pricing.tsx` e `components/UpgradePromptCard.tsx`, mas ainda nao foi deployado
- a sessao Stripe real ficou `paid` e a assinatura ficou `active` no Stripe
- a conta Stripe de teste estava com webhook incorreto apontando para `https://flow-finance-backend.vercel.app/api/stripe/webhook`, enquanto o backend implementado escuta `POST /api/saas/stripe/webhook`
- um novo endpoint correto foi criado:
  - id: `we_1Teo25RpdpJteINQp5DWbO81`
  - url: `https://flow-finance-backend.vercel.app/api/saas/stripe/webhook`
  - eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`
- o secret do novo endpoint foi alinhado com o backend oficial e os eventos reais `checkout.session.completed` e `customer.subscription.created` foram reprocessados com resposta `200`
- mesmo assim, o runtime publicado continuou sem persistencia duravel de workspace:
  - `GET /api/workspace` voltou `[]` apos reauth
  - um workspace criado e usado no checkout em uma chamada posterior voltou `404 Workspace nao encontrado`

Leitura operacional correta agora:

- o bloqueio do Stripe nao e mais somente webhook path/secret
- o bloqueio restante passou a ser a reconciliacao workspace <-> Stripe no runtime publicado
- a trilha apontou a causa real: `billingCustomerId` estava sendo salvo por caminho sincrono no checkout e a criacao da checkout-session nao enviava `subscription_data[metadata][workspaceId]`, entao o evento `customer.subscription.created` nao conseguia religar a assinatura ao workspace no backend publicado

Fechamento publicado em `2026-06-05T16:xxZ`:

- o backend oficial foi redeployado com:
  - persistencia assincrona de `billingCustomerId` em `backend/src/services/saas/stripeService.ts`
  - metadata duplicada para `subscription_data[metadata][userId]` e `subscription_data[metadata][workspaceId]`
  - `await` explicito no caminho de webhook em `backend/src/routes/saas.ts`
- a saude publicada continuou verde:
  - `/health` => `200`
  - `/api/health` => `200`
  - `/api/version` => `200`
  - todos com `workspacePersistence.mode=firebase` e `durable=true`
- um checkout Stripe real publicado foi criado, pago na pagina hosted do Stripe com cartao de teste e redirecionado com sucesso para:
  - `https://flow-finance-frontend-nine.vercel.app/?billing=return&tab=workspaceadmin&billing=success`
- a API do Stripe confirmou para a sessao real:
  - `status=complete`
  - `payment_status=paid`
  - `customer` real criado
  - `subscription` real criada
- a API do Stripe tambem confirmou eventos reais com `pending_webhooks=0`:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `invoice.payment_succeeded`
- o backend publicado confirmou para o mesmo workspace:
  - `GET /api/saas/plans` => `currentPlan=pro`
  - `hasBillingCustomer=true`
  - `stripePortalEnabled=true`
  - `POST /api/saas/stripe/portal-session` => `200` com URL real do portal

Leitura operacional correta agora:

- o gate externo **Stripe real smoke** esta `CLOSED / EVIDENCED`
- o runner `scripts/check-stripe-live-smoke.mjs` continua util para detectar precondicoes e gerar artefato, mas nao substitui o passo real de completar o checkout quando a prova exigida inclui webhook, mudanca de plano e portal aberto

## Artefato gerado

Saida principal:

- `test-results/stripe-live-smoke/<timestamp>.json`

Saida humana auxiliar:

- `test-results/stripe-live-smoke/<timestamp>.md`

O artefato inclui:

- timestamp
- snapshot de envs presentes/ausentes com mascara
- backend alvo resolvido
- steps executados
- resposta do checkout, quando houver
- razao objetiva do `BLOCK`

## Melhorias adicionadas ao runner

O runner `scripts/check-stripe-live-smoke.mjs` agora tambem inspeciona a configuracao do webhook Stripe quando `STRIPE_SECRET_KEY` estiver disponivel.

Ele valida:

- URL esperada do endpoint: `/api/saas/stripe/webhook`
- existencia de endpoint correspondente na conta Stripe
- eventos minimos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`

Exemplo de evidencia:

- `test-results/stripe-live-smoke/2026-06-05T03-17-03-871Z.json`
- passo `check_webhook_endpoint_config` => `PASS`

## Criterio de leitura

- `BLOCK` significa que o gate continua aberto.
- `SEM EVIDENCIA SUFICIENTE` e o texto usado para explicar a falta de prova real quando a configuracao existe, mas a evidenciacao ainda nao fechou o fluxo.
- `PASS` so e aceitavel com comprovacao real do fluxo inteiro; este runner foi desenhado para nao inventar esse resultado.

## Nomenclatura

Use sempre:

- gate: `Stripe real smoke`
- runner: `Stripe live smoke runner`
- saida: `test-results/stripe-live-smoke/`

Evite nomes paralelos para o mesmo gate, para nao fragmentar a trilha de auditoria.
