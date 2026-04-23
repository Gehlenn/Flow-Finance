# Runbook - Integracao Clinica

## Papel deste documento

Operar a integracao clinica de forma segura, com foco em autenticacao, rate limit, idempotencia, flags e contingencia.

## Endpoints

- `POST /api/integrations/clinic/financial-events`
- `POST /api/integrations/clinic/webhook`
- `GET /api/integrations/clinic/health`

`/api/integrations/clinic/webhook` existe como caminho de compatibilidade. A rota principal atual para eventos financeiros e `/api/integrations/clinic/financial-events`.

## Fluxo resumido

```text
Sistema externo
  -> clinicEdgeLimiter
  -> clinicPayloadLimit
  -> externalIntegrationAuth
  -> clinicIngestAuthenticatedLimiter
  -> validacao de payload
  -> receiveClinicFinancialEvent
  -> feature flags
  -> idempotencia
  -> processamento ou resposta de bloqueio
```

## Variaveis de ambiente

Autenticacao:

```env
FLOW_EXTERNAL_INTEGRATION_KEYS=
FLOW_EXTERNAL_INTEGRATION_BINDINGS=
FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS=
FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS=300
```

Rate limit e payload:

```env
CLINIC_EDGE_RATE_LIMIT_MAX=300
CLINIC_AUTH_RATE_LIMIT_MAX=200
CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES=262144
```

Flags:

```env
FF_CLINIC_INGEST=false
FF_CLINIC_AUTO_POST=false
FF_KILL_CLINIC=false
FF_KILL_AI=false
FF_KILL_STRIPE=false
```

Infra:

```env
REDIS_URL=
TRUST_PROXY=1
```

## Flags principais

- `clinic_automation_ingest_enabled`: habilita ingestao
- `clinic_automation_auto_post_enabled`: habilita lancamento automatico
- `kill_switch_clinic_automation`: derruba ingestao clinica
- `kill_switch_ai`: derruba fluxos de IA
- `kill_switch_stripe_webhooks`: derruba processamento Stripe quando configurado

## Regras de producao

- Redis e obrigatorio para idempotencia distribuida e rate limit robusto
- sem `REDIS_URL`, a operacao deve ser tratada como risco de ambiente
- HMAC deve ser usado quando a origem suportar assinatura
- payloads nao devem conter dados clinicos sensiveis
- `externalEventId` precisa ser estavel para idempotencia

## Health check

```bash
curl -s https://SEU_HOST/api/integrations/clinic/health
```

Validar:

- estado das flags
- readiness basica da integracao
- ausencia de erro 5xx

## Procedimento de incidente

1. identificar sintoma: 401, 403, 429, 5xx, timeout, duplicidade ou payload invalido
2. acionar `FF_KILL_CLINIC=true` se houver risco de ingestao indevida
3. confirmar estabilizacao por pelo menos 15 minutos
4. validar causa raiz: chave, assinatura, timestamp, payload, Redis ou flag
5. aplicar correcao em staging ou ambiente controlado
6. reabilitar gradualmente `FF_CLINIC_INGEST`
7. registrar decisao e evidencia

## Troubleshooting rapido

- 401: chave ausente, chave invalida ou HMAC invalido
- 403: binding `key|workspaceId|sourceSystem` ausente ou incorreto
- 413: payload acima de `CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES`
- 429: limite de borda ou autenticado excedido
- 503: integracao desligada por flag ou kill switch

## Referencias

- [backend/src/routes/clinicIntegration.ts](E:\app e jogos criados\Flow-Finance\backend\src\routes\clinicIntegration.ts)
- [backend/src/controllers/clinicController.ts](E:\app e jogos criados\Flow-Finance\backend\src\controllers\clinicController.ts)
- [backend/src/middleware/externalIntegrationAuth.ts](E:\app e jogos criados\Flow-Finance\backend\src\middleware\externalIntegrationAuth.ts)
- [OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md](./OPERACAO_FLAGS_KILL_SWITCHES_ALERTAS.md)
