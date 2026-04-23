# Guia de Setup

## Papel deste documento

Este é o guia canônico de setup do Flow Finance. Ele cobre a preparação local, a ordem correta de validação e os pontos mínimos para envolver Firebase, Stripe e Vercel sem depender de memória de sessão.

## Links oficiais atuais

- Frontend principal: https://flow-finance-frontend-nine.vercel.app/
- Backend principal: https://flow-finance-backend.vercel.app/
- Frontend alternativo: https://flow-finance-xi.vercel.app/

## Pre-requisitos

- Node.js `18+`
- npm `8+`
- Vercel CLI quando houver necessidade de deploy
- Stripe CLI quando houver validação real de billing sandbox
- acesso às credenciais corretas quando a tarefa exigir Firebase, Stripe, Sentry ou providers de IA

## Ordem correta

1. instalar dependências do frontend e backend
2. preencher variáveis locais mínimas
3. subir frontend e backend
4. rodar checks críticos
5. só depois envolver deploy no Vercel

## Instalar dependencias

Raiz:

```bash
npm ci
```

Backend:

```bash
cd backend
npm ci
```

## Variaveis locais mais relevantes

### Frontend

```env
VITE_API_DEV_URL=http://localhost:3001
VITE_API_PROD_URL=https://flow-finance-backend.vercel.app/
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_SENTRY_DSN=
VITE_APP_VERSION=
```

### Backend

```env
OPENAI_API_KEY=
GEMINI_API_KEY=
JWT_SECRET=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
SENTRY_DSN=
APP_VERSION=
```

## Rodar localmente

Frontend:

```bash
npm run dev
```

Backend:

```bash
cd backend
npm run dev
```

## Checks recomendados

```bash
npm run lint
npm run test:coverage:critical
npm run health:runtime
npm run health:runtime:mobile
```

## Quando envolver Firebase

Use Firebase real apenas quando o fluxo depender disso.

Regras práticas:

- não assumir que ausência de Firebase local é bug do produto
- preencher frontend e backend com o mesmo projeto correto
- validar se a tarefa realmente precisa da trilha completa de auth Firebase

## Quando envolver Stripe sandbox

Para billing real em sandbox:

```bash
stripe login
stripe listen --forward-to http://localhost:3001/api/saas/stripe/webhook
```

Objetivos mínimos da validação:

- checkout
- webhook
- mudanca de plano
- `billingCustomerId`
- portal

## Quando envolver Vercel

Login e vinculo:

```bash
vercel login
vercel link
```

Validação do alvo acessível:

```bash
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

Sem URL acessível, não declarar fechamento do ambiente-alvo.

## Regras operacionais

- preview protegido por Vercel Authentication não serve como evidência automatizada de health
- sem DSN e versão configurados, observabilidade e versionamento ficam incompletos no destino
- a documentação principal do projeto deve permanecer em PT-BR
- toda mudança estrutural relevante deve ser refletida no repositório e no vault

## Leitura complementar

- [COMECE_AQUI.md](./COMECE_AQUI.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
