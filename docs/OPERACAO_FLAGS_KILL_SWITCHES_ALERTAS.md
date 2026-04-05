# Operacao de Flags, Kill Switches e Alertas

## Objetivo
Guia operacional para reduzir risco de regressao e falhas em producao nas integracoes externas do Flow Finance.

## Escopo
- Feature flags de backend
- Kill switches de contingencia
- Alertas de observabilidade (Sentry + logs)
- Rotas de integracao clinica

## Flags Criticas

### clinic_automation_ingest_enabled
- Funcao: habilita/desabilita ingestao de eventos da clinica.
- Efeito quando false: rota clinica responde sem processar evento.
- Uso recomendado: desligar durante incidentes de payload ou erro em cascata.

### kill_switch_clinic_automation
- Funcao: corte imediato do fluxo clinico sem deploy.
- Uso recomendado: incidentes de seguranca, replay suspeito, erro sistêmico.

### kill_switch_ai
- Funcao: corte das features de IA em caso de comportamento indevido, anomalia de custos ou indisponibilidade.

## Procedimento de Contingencia (Runbook)
1. Identificar incidente via alertas (401/429/5xx, timeout, fallback excessivo).
2. Ativar kill switch correspondente.
3. Confirmar estabilizacao por 15 minutos.
4. Validar causa raiz (assinatura, payload, dependencias externas, idempotencia).
5. Aplicar fix e validar em staging.
6. Reabilitar gradualmente por feature flag.
7. Registrar incidente e decisao operacional.

## Alertas Recomendados

### Integracao Clinica
- Alerta 1: pico de 401 em `/api/integrations/clinic/financial-events`
- Alerta 2: pico de 429 no endpoint clinico
- Alerta 3: erro repetido `integration=clinic-automation`
- Alerta 4: aumento de mensagens de duplicidade acima do baseline

### IA
- Alerta 1: aumento de bloqueios por prompt injection
- Alerta 2: fallback OpenAI -> Gemini acima do baseline
- Alerta 3: latencia P95 acima de threshold

## Assinatura e Anti-Replay (Clinica)
- Header obrigatorio: `x-integration-key`
- Header obrigatorio (quando HMAC ativo): `x-integration-signature`
- Header obrigatorio (quando HMAC ativo): `x-integration-timestamp`
- Formato de assinatura: `sha256=<hex>`
- Mensagem assinada: `${timestamp}.${rawBody}`
- Janela anti-replay: `FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS` (default: 300s)

## Operacao por Ambiente

### Development/Test
- Pode usar fallback em memoria para idempotencia quando Redis nao estiver configurado.

### Production
- Redis obrigatorio para idempotencia da rota clinica.
- Sem `REDIS_URL`: fluxo clinico deve falhar fechado.

## Checklist de Liberacao
- Flag inicial em producao definida conforme plano de rollout.
- Alertas ativos no Sentry para clinica e IA.
- Runbook de contingencia validado pela equipe.
- Testes de integracao da rota clinica passando.
- Lint e cobertura critica aprovados.

## Referencias
- backend/src/middleware/externalIntegrationAuth.ts
- backend/src/routes/clinicIntegration.ts
- backend/src/controllers/clinicController.ts
- backend/src/services/featureFlags/EnhancedFeatureFlagService.ts
- docs/ROBUSTNESS_OPERATIONAL_v0.9.2.md
