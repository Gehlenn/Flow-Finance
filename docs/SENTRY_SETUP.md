# Setup do Sentry

## Objetivo

Fechar a observabilidade de producao com um unico major do SDK Sentry e sem dependencia legada de `@sentry/tracing@7`.

## Estado vivo em 2026-05-25

- o backend oficial `flow-finance-backend` ja foi revalidado em `0.9.7`
- `VITE_APP_VERSION`, `VITE_SENTRY_DSN`, `APP_VERSION` e `SENTRY_DSN` ja aparecem provisionados em producao no Vercel
- esta nota serve como guia de setup e regressao para novos ambientes ou drift futuro, nao como sinal de pendencia no deploy atual

## Estado do codigo

O setup atual fica assim:

- frontend usa `@sentry/react@10` com `browserTracingIntegration()`
- backend usa `@sentry/node@10` com `nodeProfilingIntegration()`
- ausencia de DSN nao derruba bootstrap, mas fica visivel em producao
- contratos de `/health`, `/api/health` e `/api/version` continuam sendo a checagem minima de ambiente

## Variaveis de ambiente

### Frontend

```env
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=development
VITE_APP_VERSION=
```

Notas:

- `VITE_SENTRY_DSN` e obrigatorio para observabilidade real do frontend em producao.
- se o frontend cair no fallback legado `SENTRY_DSN`, o bootstrap ainda sobe, mas registra warning proposital: `[Sentry] DSN ausente em producao`
- `VITE_SENTRY_ENVIRONMENT` e opcional; sem ele o frontend usa `import.meta.env.MODE`

### Backend

```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
APP_VERSION=
```

Notas:

- `SENTRY_ENVIRONMENT=production` deve existir no projeto backend em producao
- sem `SENTRY_DSN`, o backend segue respondendo, mas registra warning em runtime quando `NODE_ENV=production`

## Onde configurar

### Local

- raiz do projeto para variaveis `VITE_*`
- `backend/.env` para backend

### Vercel

Projetos atuais:

- `flow-finance` (frontend)
- `flow-finance-backend` (backend)

Checklist minimo de producao:

- frontend: `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_APP_VERSION`
- backend: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `APP_VERSION`

Na producao atual do Flow Finance, esses campos ja estao provisionados; mantenha esta lista como contrato de regressao e setup de novos ambientes.

## Validacao

### Dependencias

```bash
rtk rg "@sentry/tracing" package.json package-lock.json backend/package.json
```

Esperado: zero ocorrencias.

### Deploy alvo

```bash
rtk npm run health:vercel
```

O check valida:

1. `/health`
2. `/api/health`
3. `/api/version`

Se o target estiver protegido por Vercel Authentication, a validacao externa fica bloqueada antes da aplicacao responder.

### Evidencia real no Sentry

O ideal e provar um evento real chegando no painel. Opcoes:

1. disparar um endpoint/controlador de teste explicitamente provisionado para isso
2. usar Sentry CLI, dashboard ou plugin com acesso ao projeto correto

Sem uma dessas duas coisas, o status honesto e: codigo e ambiente preparados, mas evidencia de evento real ainda bloqueada.

### Validacao operacional minima sem painel

Quando nao houver acesso ao dashboard do Sentry, o menor corte seguro e:

1. confirmar que o backend oficial responde em producao com `observability.sentryConfigured=true`
2. puxar temporariamente o `SENTRY_DSN` de `flow-finance-backend` via `vercel env pull`
3. disparar um evento sintetico one-off contra o endpoint `/api/<project>/store/`
4. exigir `HTTP 200` e corpo com o mesmo `eventId` enviado

Isso nao valida uma tela especifica do app, mas valida ingestao real no projeto Sentry configurado em producao sem expor endpoint novo no backend.

Exemplo de evidencia objetiva esperada:

```json
{
  "status": 200,
  "eventId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "responseBody": "{\"id\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}"
}
```

Se for necessario provar tambem o caminho da aplicacao sem painel Sentry, use uma rota ja instrumentada e segura para gerar telemetria controlada. Hoje existe um caminho de baixo risco:

- `POST /api/integrations/clinic/webhook` sem credencial retorna `401 Invalid integration key`
- o middleware `backend/src/middleware/clinicAudit.ts` chama `Sentry.captureMessage('Clinic webhook: invalid authentication', 'warning')`

Sem acesso ao painel, essa segunda parte fica apenas inferida pelo codigo + resposta HTTP. A prova conclusiva continua sendo o `eventId` aceito pelo proprio ingest endpoint do projeto.

## Diretriz operacional

Nao marcar observabilidade como fechada em um novo ambiente apenas porque o SDK inicializa. O minimo aceitavel e confirmar:

1. DSN presente no frontend e backend
2. environment e release presentes
3. target Vercel acessivel
4. health contracts validos
5. evento real observado no painel, quando houver credencial ou mecanismo de teste

## Referencias

- [src/config/sentry.ts](../src/config/sentry.ts)
- [backend/src/config/sentry.ts](../backend/src/config/sentry.ts)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
