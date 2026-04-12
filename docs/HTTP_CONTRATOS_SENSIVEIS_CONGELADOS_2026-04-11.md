# Contratos HTTP Sensiveis Congelados - v0.9.x

Data: 2026-04-11

## 1) Objetivo do freeze contratual

Consolidar, de forma auditavel, o status contratual das superficies HTTP sensiveis da linha v0.9.x sem alterar comportamento de endpoint:
- auth
- sync
- finance/metrics
- saas

## 2) Fonte primaria de runtime

- backend/src/docs/openapi.ts

## 3) Fonte de verificacao

- backend/src/docs/openapi.test.ts
- docs/OPENAPI_MULTI_TENANT.yaml (referencia auxiliar)

## 4) Matriz por superficie

### Auth
- Status: congelado
- Fonte principal: backend/src/docs/openapi.ts (paths /api/auth/*)
- Coberto: login, firebase, refresh, validate, logout e oauth start/callback com request/response explicitos no runtime spec
- Observacao operacional: `login` legado continua sujeito ao gate de ambiente e `oauth/google/start` retorna `200` JSON, nao redirect `302`

### Sync
- Status: congelado
- Fonte principal: backend/src/docs/openapi.ts (paths /api/sync/*)
- Coberto: health, push, pull, conflictPolicy e estrutura de conflicts documentados
- Last-mile: nenhum para freeze documental atual

### Finance/Metrics
- Status: congelado (escopo metrics)
- Fonte principal: backend/src/docs/openapi.ts (path /api/finance/metrics)
- Coberto: endpoint de metrics com auth/workspace no runtime spec
- Last-mile: nenhum no escopo metrics; finance/events permanece fora deste freeze

### SaaS
- Status: congelado
- Fonte principal: backend/src/docs/openapi.ts (paths /api/saas/*)
- Coberto: usage, usage/increment, usage/reset, plans, metering, plan, billing-hooks, stripe/webhook, checkout-session e portal-session com request/response explicitos
- Observacao operacional: disponibilidade real de checkout/portal/webhook continua dependente da configuracao Stripe no ambiente, sem reabrir backlog contratual

## 5) Veredito consolidado do P1

Veredito: congelado.

Justificativa objetiva:
- auth, sync, finance/metrics e saas possuem contrato runtime explicito no OpenAPI
- risco remanescente neste eixo e operacional/de ambiente, nao contratual

## 6) Last-mile restante

Nenhum last-mile contratual aberto neste eixo.

Pendencia remanescente:
1. Validar comportamento de `auth` e Stripe em ambiente alvo como monitoramento operacional, nao como freeze de contrato
