# Security Review v0.9.2 - Integracao Clinica

## Resumo executivo
A integracao clinica esta com base boa (HMAC com timestamp, schema validation e feature flags com kill switch), mas ainda ha riscos operacionais e de seguranca que podem impactar disponibilidade e idempotencia em ambiente multi-instancia. O principal risco atual e deduplicacao nao atomica no armazenamento de idempotencia.

## Escopo
- Endpoint: POST /api/integrations/clinic/financial-events
- Middleware de autenticacao externa
- Servico de automacao clinica e idempotencia
- Limites e configuracoes de runtime do backend

## Visao objetiva da arquitetura atual
- Entrada HTTP no Express com validacao de payload via Zod.
- Autenticacao por chave de integracao + assinatura HMAC com janela temporal.
- Controle operacional via feature flags e kill switch.
- Idempotencia persistida em Redis com TTL.
- Observabilidade por logs estruturados + telemetria/monitoramento.

## Achados por severidade

### [FF-SEC-001] High - Idempotencia com janela de corrida (race condition)
- Local:
  - backend/src/services/clinic/IdempotentEventStore.ts:54
  - backend/src/services/clinic/IdempotentEventStore.ts:64
  - backend/src/services/clinic/IdempotentEventStore.ts:85
- Evidencia:
  - Fluxo atual faz leitura e depois escrita (get -> setEx) sem operacao atomica.
- Impacto:
  - Requisicoes concorrentes com mesmo externalEventId podem ser processadas em duplicidade antes da gravacao final.
- Recomendacao:
  - Trocar para gravacao atomica no Redis (SET key value NX EX ttl ou script Lua) para garantir deduplicacao sob concorrencia.
- Mitigacao de curto prazo:
  - Registrar alerta de duplicidade por externalEventId em janela curta e acionar kill switch clinico se taxa subir.

### [FF-SEC-002] Medium - Rate limit da rota clinica usa store em memoria local
- Local:
  - backend/src/routes/clinicIntegration.ts:14
  - backend/src/middleware/rateLimitByUser.ts:17
- Evidencia:
  - O rate limiter usa Map em memoria do processo.
- Impacto:
  - Em horizontal scaling (multi-pod/instancia), atacante pode distribuir carga e bypassar limite efetivo global.
- Recomendacao:
  - Migrar limiter da rota clinica para backend Redis (chave por origem + janela) com contagem centralizada.

### [FF-SEC-003] Medium - Ordem de middlewares favorece custo de autenticacao antes do throttle dedicado
- Local:
  - backend/src/routes/clinicIntegration.ts:50
  - backend/src/routes/clinicIntegration.ts:51
- Evidencia:
  - externalIntegrationAuth executa antes de clinicIngestLimiter.
- Impacto:
  - Sob rajada maliciosa, ha custo desnecessario de parsing/verificacao antes de bloquear por taxa.
- Recomendacao:
  - Aplicar um limiter de borda antes da autenticacao (por IP/origem) e manter um segundo limiter autenticado apos auth.

### [FF-SEC-004] Medium - externalEventId sem restricao de formato e tamanho
- Local:
  - backend/src/validation/clinicAutomation.schema.ts:39
  - backend/src/validation/clinicAutomation.schema.ts:61
  - backend/src/validation/clinicAutomation.schema.ts:82
  - backend/src/validation/clinicAutomation.schema.ts:102
  - backend/src/validation/clinicAutomation.schema.ts:120
- Evidencia:
  - Campos externalEventId estao como z.string() sem limite de tamanho/padrao.
- Impacto:
  - Aumenta risco de payload com IDs gigantes, chaves de Redis extensas e degradacao de recursos.
- Recomendacao:
  - Restringir para UUID/ULID ou regex tecnica com maximo de tamanho (ex.: 64-128 chars).

### [FF-SEC-005] Low - trust proxy fixo em 1 exige validacao de topologia real
- Local:
  - backend/src/index.ts:59
- Evidencia:
  - Configuracao fixa app.set('trust proxy', 1).
- Impacto:
  - Em topologia divergente, pode haver leitura incorreta de IP/protocolo e impactar trilhas de auditoria/rate limit.
- Recomendacao:
  - Tornar configuravel por ambiente e validar com infraestrutura (gateway/reverse proxy).

## Pontos positivos ja implementados
- Autenticacao HMAC com timestamp e comparacao timing-safe.
  - backend/src/middleware/externalIntegrationAuth.ts:42
- Validacao de contrato por schema discriminado (eventos permitidos).
  - backend/src/validation/clinicAutomation.schema.ts:133
- Kill switch/feature flags para contingencia operacional.
  - backend/src/config/featureFlags.ts

## Quick wins (alto impacto, baixo esforco)
1. Aplicar validacao de externalEventId com maximo de tamanho e padrao tecnico.
2. Reordenar middlewares para throttle de borda antes de auth.
3. Criar alerta de duplicidade por externalEventId em 5 minutos.
4. Reduzir limite de body apenas na rota clinica (ex.: 256KB-1MB) mantendo limite global atual em outras rotas.

## Checklist objetivo de producao (integracao clinica)
1. Chaves de integracao e segredos HMAC rotacionados e versionados.
2. Janela de timestamp revisada (max skew) e monitorada.
3. Idempotencia atomica via Redis NX/EX habilitada.
4. Rate limit centralizado em Redis para rota clinica.
5. Limite de payload especifico da rota clinica configurado.
6. Kill switch clinico testado em ambiente de staging.
7. Alertas configurados para: 401, 429, duplicidade, latencia p95/p99, erro 5xx.
8. Dashboard com taxa de ingestao por tipo de evento e por tenant.
9. Runbook de incidente validado (rollback operacional sem deploy).
10. Teste de replay e burst executado antes de liberar mudancas.

## Roadmap incremental (3 versoes)
- v0.9.2:
  - Idempotencia atomica
  - Validacao forte de externalEventId
  - Reordem de middleware com limiter de borda
- v0.9.3:
  - Rate limit distribuido em Redis
  - Limite de payload por rota clinica
  - Alarmes e SLOs de ingestao
- v0.9.4:
  - Testes de resiliencia (burst/replay/falha parcial)
  - Hardening de observabilidade para auditoria multi-tenant
  - Simulacao de contingencia com kill switch em janela de pico

## Arquivos a alterar na fase de fix (sugestao)
- backend/src/services/clinic/IdempotentEventStore.ts
- backend/src/routes/clinicIntegration.ts
- backend/src/validation/clinicAutomation.schema.ts
- backend/src/index.ts
- backend/tests/unit/clinic-automation-service.test.ts
- backend/tests/integration/clinic-integration.integration.test.ts
