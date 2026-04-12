# EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12

Data: 2026-04-12  
Escopo: validacao operacional real do billing Stripe sandbox no Flow Finance  
Status final: APROVADO

## Objetivo

Validar o fluxo real de billing Stripe sandbox no nucleo operacional do produto, cobrindo:

- checkout real
- webhook assinado
- promocao do workspace para `pro`
- persistencia de `billingCustomerId`
- abertura do Stripe Billing Portal

## Veredito

A validacao foi concluida com sucesso no eixo operacional principal.

O fluxo `checkout -> webhook -> mudanca de plano -> vinculacao de customer -> portal` ficou provado com evidencias objetivas no backend, no Stripe e na persistencia local do workspace.

## Escopo efetivamente validado

Foi validado com sucesso:

- criacao de sessao Stripe Checkout pelo backend
- abertura real do Checkout hospedado pelo Stripe
- processamento de eventos Stripe no webhook local com resposta `200`
- sincronizacao de assinatura para o workspace correto
- mudanca de plano de `free` para `pro`
- persistencia de `billingCustomerId`
- criacao e abertura de sessao do Stripe Billing Portal

## Ambiente utilizado

- Backend local em `http://127.0.0.1:3001`
- Frontend local em `http://127.0.0.1:5173`
- Stripe CLI instalado e autenticado
- `stripe listen` ativo com `--forward-to http://localhost:3001/api/saas/stripe/webhook`
- Backend configurado com:
  - `ALLOW_MOCK_BILLING_UPDATES=false`
  - `STRIPE_SECRET_KEY` preenchido
  - `STRIPE_PRICE_PRO_MONTHLY` preenchido
  - `STRIPE_WEBHOOK_SECRET` preenchido
  - `SAAS_PRO_MONTHLY_PRICE_CENTS=2990`

## Workspace validado

- owner: `owner-stripe-local`
- workspace: `Workspace Stripe Sandbox`
- workspaceId: `91ef0449-ee97-4535-8be6-3d194cb400fb`

## Evidencias objetivas

### 1. Estado inicial do billing

Antes do checkout, o endpoint `/api/saas/plans` respondeu com estado coerente para billing real ainda nao ativado no workspace:

- `currentPlan: free`
- `stripeConfigured: true`
- `billingProvider: stripe`
- `stripePortalEnabled: false`

Isso confirmou que o ambiente estava em modo Stripe real e que o workspace ainda nao possuia customer vinculado.

### 2. Checkout real aberto

O backend retornou uma sessao valida de Stripe Checkout com `url` utilizavel.

O checkout hospedado abriu de fato e a compra foi processada em sandbox.

### 3. Webhook Stripe processado

O `stripe listen` registrou os eventos centrais do fluxo, todos entregues ao backend com sucesso:

```text
checkout.session.completed -> 200
customer.subscription.created -> 200
invoice.paid -> 200
charge.succeeded -> 200
```

Trecho representativo do listener:

```text
2026-04-12 06:34:45 --> checkout.session.completed [evt_...]
2026-04-12 06:34:45 <-- [200] POST http://localhost:3001/api/saas/stripe/webhook [evt_...]
2026-04-12 06:34:45 --> customer.subscription.created [evt_...]
2026-04-12 06:34:45 <-- [200] POST http://localhost:3001/api/saas/stripe/webhook [evt_...]
```

### 4. Mudanca de plano e vinculacao de customer

A persistencia do workspace confirmou:

- `plan: pro`
- `billingCustomerId: cus_UJyMfmxw2QwvF6`
- `subscription.provider: stripe`
- `subscription.status: active`
- `subscription.providerPriceId: price_1TLKGnRpdpJteINQvBsRlkZe`

E o endpoint `/api/saas/plans` confirmou o estado final:

- `currentPlan: pro`
- `stripePortalEnabled: true`
- `hasBillingCustomer: true`

### 5. Abertura do Billing Portal

A sessao de portal foi criada e aberta com sucesso.

Evidencia capturada:

- `title: Faturamento de Area restrita de New business`
- exibicao da assinatura `Flow Finance Pro`
- valor `R$ 29,90 por mes`
- metodo `Visa •••• 4242`
- status de fatura `Paga`

## Comandos-chave executados

```bash
npm run dev
npm --prefix backend run dev
stripe listen --forward-to http://localhost:3001/api/saas/stripe/webhook
```

Validacoes operacionais adicionais foram executadas via chamadas HTTP autenticadas ao backend (`/api/auth/login`, `/api/workspace`, `/api/saas/plans`, `/api/saas/stripe/checkout-session`, `/api/saas/stripe/portal-session`) e automacao Playwright para evidencias do checkout/portal.

## Arquivos alterados

- `backend/.env` (preparacao de ambiente Stripe sandbox)
- `backend/data/workspaces.json` (mudanca de estado operacional apos webhook)
- `docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md` (este registro)

Nenhuma alteracao de codigo de producao foi necessaria para fechar a evidenciacao operacional.

## Risco residual (fora do nucleo Stripe)

Existe lacuna de validacao visual estrita em `Ajustes -> Workspace Admin` no frontend local quando `VITE_FIREBASE_*` nao esta configurado.

Isso nao invalida o resultado operacional de billing Stripe, pois o fluxo principal foi comprovado no backend + Stripe + persistencia.

## Criterio de sucesso: checklist final

- checkout abriu: OK
- checkout concluiu: OK
- webhook processou: OK
- workspace virou pro: OK
- billingCustomerId ficou vinculado: OK
- portal abriu: OK

## Conclusao

Validacao operacional real do Stripe sandbox: **APROVADA**.
