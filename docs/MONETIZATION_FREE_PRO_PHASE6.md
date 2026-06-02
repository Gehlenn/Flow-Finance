# Flow Finance - Monetizacao Free + Pro (S8)

## Objetivo

Fechar um paywall simples, audivel e comercializavel sem bloquear o core do produto.

## Regra comercial vigente

### Free
- 1 workspace
- 20 consultas do Consultor IA por mes
- exportacao de relatorios bloqueada
- core financeiro liberado: lancamentos, dashboard, transacoes e lembretes

### Pro
- Consultor IA ilimitado
- multiplos workspaces
- exportacao de relatorios em PDF
- mantem acesso aos recursos premium ja existentes do app

## Preco desta fase

- Free: R$ 0
- Pro mensal: R$ 49,00
- Pro anual de referencia: R$ 490,00

Observacao: o wiring de checkout implementado nesta fase usa o fluxo mensal do Stripe ja existente no backend. O anual fica documentado como referencia comercial ate haver price ID dedicado no ambiente.

## Gating implementado em codigo

### AICFO
- o plano Free pode usar o Consultor IA normalmente ate a consulta 20 do mes
- a consulta 21 e bloqueada na UI
- quando o limite e atingido, o app mostra `UpgradePromptCard` inline com CTA para Stripe Checkout
- a contagem tenta sincronizar com o uso mensal do workspace; se a leitura falhar, cai para contagem local da conversa com diagnostico visivel

### Settings
- mostra plano atual do workspace
- mostra a regra operacional do plano ativo
- exibe CTA de upgrade para workspaces Free
- exibe CTA de portal para workspaces Pro quando o customer Stripe ja existe
- quando Stripe nao esta configurado no ambiente, o estado fica explicito

### Pricing
- `pages/Pricing.tsx` foi criado com comparativo Free vs Pro e CTA de checkout
- no shell atual do app, a pagina ainda nao esta roteada porque a sessao S8 nao tem ownership sobre `App`/`hooks`

## Wiring tecnico

- `src/app/monetizationPlan.ts`
  - `FREE_LIMITS`
  - `PRO_FEATURES`
  - `withinFreeLimit`
  - preco atualizado para R$ 49 / R$ 490
- `components/UpgradePromptCard.tsx`
  - CTA real para `POST /api/saas/stripe/checkout-session`
- `pages/AICFO.tsx`
  - leitura de uso mensal
  - incremento de `aiQueries`
  - bloqueio da 21a consulta Free
- `components/Settings.tsx`
  - resumo do plano
  - upgrade/portal via Stripe
- `pages/Pricing.tsx`
  - superficie dedicada de pricing

## Dependencias externas ainda necessarias

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`
- webhook apontando para `https://flow-finance-backend.vercel.app/api/saas/stripe/webhook`
- customer Stripe valido por workspace para liberar o portal

## Referencias

- `docs/PLANO_ACAO_AUDITORIA_2026-05-15.md`
- `docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md`
