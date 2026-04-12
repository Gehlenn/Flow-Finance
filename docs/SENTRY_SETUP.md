# Setup do Sentry

## Objetivo

Este guia descreve como fechar a configuração de observabilidade do Flow Finance de forma coerente com o código atual.

## Estado atual do código

O projeto já está preparado para:

- frontend silencioso quando `VITE_SENTRY_DSN` estiver ausente
- backend silencioso quando `SENTRY_DSN` estiver ausente
- propagação de `requestId` e `routeScope` nos contratos de health
- promoção de contexto útil para troubleshooting

O que ainda depende de ambiente:

- preencher DSNs reais
- alinhar versão de release
- validar o deploy alvo com acesso liberado

## Variáveis de ambiente

### Frontend

```env
VITE_SENTRY_DSN=
VITE_APP_VERSION=
```

### Backend

```env
SENTRY_DSN=
APP_VERSION=
```

## Onde configurar

### Local

- raiz do projeto para variáveis `VITE_*`
- `backend/.env` para backend

### Vercel

Preencher no frontend e backend conforme o projeto correspondente.

## O que validar

### Frontend

1. a aplicação sobe sem warning ruidoso quando o DSN estiver ausente
2. erros 5xx ou de rede promovem contexto de observabilidade
3. o comportamento sem DSN continua silencioso e explícito

### Backend

1. `/health` expõe `checks.observability`
2. `/api/health` expõe `observability.sentryConfigured`
3. `/api/version` expõe `requestId` e `routeScope`

## Validação de deploy

Com o preview acessível:

```bash
VERCEL_TARGET_URL=https://seu-preview.vercel.app npm run health:vercel
```

Se o preview estiver protegido por Vercel Authentication, a validação do ambiente alvo fica bloqueada antes da aplicação responder.

## Diretriz operacional

Não marcar observabilidade como “fechada em produção” só porque o código já está preparado. É obrigatório confirmar:

1. DSN configurado
2. versão configurada
3. deploy acessível
4. contrato dos endpoints de saúde validado

## Referências

- [src/config/sentry.ts](E:\app e jogos criados\Flow-Finance\src\config\sentry.ts)
- [backend/src/config/sentry.ts](E:\app e jogos criados\Flow-Finance\backend\src\config\sentry.ts)
- [docs/VERCEL_CONFIG.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_CONFIG.md)
- [docs/VERCEL_DEPLOYMENT.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_DEPLOYMENT.md)
