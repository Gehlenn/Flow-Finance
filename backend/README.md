# Backend do Flow Finance

## Papel do backend

O backend do Flow Finance concentra os fluxos que não devem depender do cliente:

- autenticação e sessão quando exigido
- proxies e rotas de IA
- billing e webhooks
- integrações operacionais
- contratos de health e version
- observabilidade

## Stack

- Node.js
- Express
- TypeScript

## Responsabilidades principais

### Autenticação

- emissão e validação de token
- bootstrap de sessão para fluxos suportados
- suporte ao fluxo local de desenvolvimento quando explicitamente permitido

### IA

- mediação das chamadas sensíveis para provedores
- proteção de credenciais fora do frontend

### Billing

- criação de checkout session
- criação de portal session
- processamento de webhook Stripe
- atualização de plano por workspace

### Observabilidade

- `GET /health`
- `GET /api/health`
- `GET /api/version`

Com contrato atual de rastreabilidade:

- `requestId`
- `routeScope`
- estado de observabilidade quando aplicável

## Setup local

### Pré-requisitos

- Node.js `18+`
- npm `8+`
- arquivo `backend/.env` preenchido conforme o contexto da tarefa

### Instalação

```bash
cd backend
npm install
```

### Execução em desenvolvimento

```bash
npm run dev
```

### Execução em produção local

```bash
npm run build
npm start
```

## Variáveis importantes

Exemplo mínimo:

```env
NODE_ENV=development
JWT_SECRET=
FRONTEND_URL=http://localhost:5173
OPENAI_API_KEY=
GEMINI_API_KEY=
APP_VERSION=
SENTRY_DSN=
```

## Persistência e drivers

O backend suporta modos diferentes para partes do sistema, dependendo do recurso:

- memória para desenvolvimento rápido
- Firebase para persistência operacional
- PostgreSQL em áreas específicas quando habilitado

Não assumir que todo ambiente precisa usar todos os drivers ao mesmo tempo. O modo ativo deve ser confirmado pela configuração real.

## Billing Stripe sandbox

O núcleo de billing Stripe já foi validado localmente em sandbox.

Fluxo validado:

1. criação de checkout
2. execução do checkout
3. webhook com `200`
4. mudança de plano para `pro`
5. persistência de `billingCustomerId`
6. abertura do portal do cliente

Configuração típica:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
ALLOW_MOCK_BILLING_UPDATES=false
```

Listener local:

```bash
stripe login
stripe listen --forward-to http://localhost:3001/api/saas/stripe/webhook
```

## Open Finance

Status atual:

- capacidade preservada no código
- uso em standby estratégico quando o custo operacional não for justificável

Antes de reativar:

- confirmar viabilidade econômica
- confirmar flags e credenciais reais
- executar validação específica do fluxo

## Endpoints de saúde

### `/health`

Uso:

- health principal
- visão consolidada de checks internos

### `/api/health`

Uso:

- probe estável de API
- confirmação simples do estado da aplicação

### `/api/version`

Uso:

- confirmação de versão e contexto do runtime

## Checks recomendados

No contexto do repositório principal:

```bash
npm run lint
npx vitest run backend/tests/unit/sentry-config.test.ts
npx vitest run --config vitest.backend-integration.config.ts backend/tests/integration/health.integration.test.ts
```

## Situação atual

O backend já está com:

- contrato de observabilidade implementado
- Sentry silencioso quando não configurado
- suporte ao billing Stripe sandbox validado localmente

O que ainda não está fechado:

- prova final no ambiente alvo do Vercel quando o preview estiver protegido por autenticação
- alinhamento total de variáveis de ambiente de observabilidade e versão

## Referências

- [README.md](E:\app e jogos criados\Flow-Finance\README.md)
- [docs/ARCHITECTURE.md](E:\app e jogos criados\Flow-Finance\docs\ARCHITECTURE.md)
- [docs/VERCEL_CONFIG.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_CONFIG.md)
- [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](E:\app e jogos criados\Flow-Finance\docs\EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
