# Robustez Operacional do Flow Finance - Documentação

## Visão Geral

Esta documentação descreve as camadas de robustez operacional implementadas na versão 0.9.2 do Flow Finance:

1. **Observabilidade com Sentry** - Monitoramento de integrações externas
2. **Feature Flags com Kill Switches** - Controle rápido de funcionalidades
3. **Validação Anti-Prompt Injection** - Proteção contra ataques ao LLM
4. **Integração Clínica Segura** - Ingestão confiável de eventos externos

---

## Parte 1: Observabilidade com Sentry (IntegrationTelemetry)

### Objetivo
Monitorar falhas, latência, timeouts e degradação de integrações externas (Stripe, Firebase, OpenAI, Clinic Automation, etc).

### Arquivos
- `backend/src/services/observability/IntegrationTelemetry.ts` - Camada central de telemetria
- `backend/src/services/observability/IntegrationMonitor.ts` - Wrappers específicos por integração

###Uso

#### Exemplo 1: Wrapper em serviço de IA
```typescript
import { IntegrationMonitor } from '../observability';

const result = await monitor.executeAICall(
  'openai',
  'ai_chat',
  async () => {
    // Sua chamada ao OpenAI
    return await openai.createChatCompletion({...});
  },
  { userId: 'user-123', tenantId: 'tenant-456', requestId }
);
```

#### Exemplo 2: Registrar fallback
```typescript
telemetry.recordFallback(
  context,
  'Primary provider timeout, switching to secondary',
  'gemini'
);
```

#### Exemplo 3: Registrar degradação
```typescript
telemetry.recordDegradation(
  context,
  'Latência anormalmente alta: avg 5.2s vs threshold 2s',
  'high'
);
```

### Tags Sentry Automáticas
Cada chamada monitora adiciona tags para filtering e alertas:
- `integration`: stripe | firebase | openai | gemini | clinic-automation (etc)
- `operation`: create_transaction | ai_chat | payment_process (etc)
- `provider`: provider específico (ex: "openai", "gemini")
- `source_system`: flow | clinic-automation | internal
- `integration_status`: success | error | timeout | fallback | degraded

### Logs Estruturados
Cada chamada registra em Pino com contexto completo:
```json
{
  "integrationName": "stripe",
  "operation": "payment_process",
  "status": "success",
  "durationMs": 1245,
  "httpStatus": 200,
  "environment": "production",
  "requestId": "req-uuid",
  "userId": "user-...",
  "tenantId": "tenant-uuid",
  "retryCount": 1
}
```

### Alertas Recomendados no Sentry
Configure os seguintes alertas em Issues → Alert Rules:

1. **Error Repetido por Integração**
   - Trigger: >10 eventos em 15 minutos
   - Filtro: `tags.integration:stripe`
   - Ação: Notificar #alerts-stripe no Slack

2. **Timeout Anormal**
   - Trigger: Violação de threshold
   - Filtro: `tags.integration_status:timeout`
   - Ação: Notificar on-call

3. **Fallback Frequente**
   - Trigger: >5 fallbacks em 10 minutos
   - Filtro: `tags.integration_status:fallback`
   - Ação: Investigar provider primário

4. **Webhook Clínica Falhando**
   - Trigger: >3 erros em 5 minutos
   - Filtro: `tags.integration:clinic-automation tags.operation:webhook_ingest`
   - Ação: Notificar time de integração

---

## Parte 2: Feature Flags com Kill Switches (EnhancedFeatureFlagService)

### Objetivo
Controlar funcionalidades com prioridade máxima a kill switches para desativação instantânea sem deploy.

### Arquivos
- `backend/src/services/featureFlags/EnhancedFeatureFlagService.ts` - Serviço avançado
- `backend/src/services/featureFlags/featureFlagService.ts` - Serviço original (compatível)

### Flags Disponíveis

| Flag | Default | Ambiente | Uso |
|------|---------|----------|-----|
| `ai_chat_enabled` | true | prod/staging/dev | Chat conversacional |
| `ai_deep_analysis_enabled` | true | prod/staging/dev | Análise financeira profunda |
| `ai_provider_fallback_enabled` | true | prod/staging/dev | Fallback automático (OpenAI→Gemini) |
| `clinic_automation_ingest_enabled` | false | staging/prod | Receber eventos clínica |
| `clinic_automation_auto_post_enabled` | false | staging/prod | Postar dados clínica automaticamente |
| `external_integrations_observability_enabled` | true | prod/staging/dev | Monitoramento Sentry |
| `open_finance_enabled` | false | prod/staging/dev | Pluggy (caro) |
| `stripe_payments_enabled` | true | prod/staging/dev | Processamento Stripe |

### Uso

#### Exemplo 1: Avaliar flag
```typescript
import { createDefaultEnhancedFeatureFlagService } from '../featureFlags/EnhancedFeatureFlagService';

const featureFlags = createDefaultEnhancedFeatureFlagService();

const context = {
  environment: 'production',
  userId: 'user-123',
  tenantId: 'tenant-456',
  role: 'admin'
};

const result = featureFlags.isEnabled('ai_chat_enabled', context);

if (result.enabled) {
  // Executar feature
} else {
  logger.info(`Feature disabled: ${result.reason}`);
  // reason: 'kill_switch_active' | 'disabled' | 'environment_blocked' | etc.
}
```

#### Exemplo 2: Ativar Kill Switch (emergência)
```typescript
featureFlags.activateKillSwitch(
  'clinic_automation_ingest_enabled',
  'admin-ops@flow.com',
  'Incidente: webhook clínica gerando duplicatas massivas',
  'production'
);

// Log automático estruturado
// Sentry alert automático
// Sem necessidade de deploy
```

#### Exemplo 3: Rollout Progressivo
```typescript
featureFlags.setRolloutPercentage(
  'clinic_automation_ingest_enabled',
  25, // 25% dos usuários
  'tech-lead@flow.com'
);
```

### Prioridades de Avaliação

Kill switches são avaliados em ordem e retornam imediatamente:

1. **Kill Switch Ativo** (`forceDisabled=true`) → `reason: 'kill_switch_active'`
2. **Flag Desabilitada** (`enabled=false`) → `reason: 'disabled'`
3. **Ambiente Bloqueado** → `reason: 'environment_blocked'`
4. **Role Bloqueado** → `reason: 'role_blocked'`
5. **Tenant Bloqueado** → `reason: 'tenant_blocked'`
6. **Rollout Bloqueado** → `reason: 'rollout_blocked'` (percentual)
7. **Habilitada** → `reason: 'enabled'`

### Auditoria de Kill Switches

Toda ativação de kill switch é registrada:

```typescript
const auditLog = featureFlags.getKillSwitchAuditLog();

// Retorna array de:
[{
  flagName: 'clinic_automation_ingest_enabled',
  action: 'activated',
  changedBy: 'admin@flow.com',
  timestamp: '2026-04-05T10:30:00Z',
  environment: 'production',
  reason: 'Incidente: duplicatas'
}]
```

### Endpoints Admin (Exemplo)

Para integrar com painel admin:

```typescript
// GET /admin/api/features
// Listar todas as flags
const allFlags = featureFlags.getAllFlags();

// POST /admin/api/features/:flagName/kill-switch
// Ativar kill switch
featureFlags.activateKillSwitch(flagName, userId, reason);

// POST /admin/api/features/:flagName/kill-switch/release
// Desativar kill switch
featureFlags.deactivateKillSwitch(flagName, userId, reason);

// GET /admin/api/features/audit
// Listar histórico de ativações
const history = featureFlags.getKillSwitchAuditLog();
```

---

## Parte 3: Validação Anti-Prompt Injection

### Objetivo
Defender contra tentativas de prompt injection antes de enviar texto ao LLM.

### Arquivo
- `backend/src/services/ai/PromptInjectionGuard.ts`

### Camadas de Defesa

1. **Normalização Unicode segura** - NFKC, remove null bytes
2. **Pattern Matching** - Detecta padrões conhecidos de injection
3. **Termos Suspeitos** - Keywords banidas
4. **Detecção de Encoding** - Base64, hex, Unicode escapes
5. **Estruturas Maliciosas** - JSON eval, prototype pollution
6. **Contexto Financeiro** - Misuse de operações

### Uso

```typescript
import { validatePromptInput, getSafeBlockedResponse, processUserInputSafely } 
  from '../services/ai/PromptInjectionGuard';

// Opção 1: Validação simples
const result = validatePromptInput(userInput);

if (result.level === 'block') {
  // Bloqueado: alto risco
  res.json({ error: getSafeBlockedResponse() });
} else if (result.level === 'review') {
  // Review: suspeito, log para análise manual
  logger.warn({ riskScore: result.riskScore }, 'Input flagged for review');
} else {
  // Allow: seguro, prosseguir
  await llm.chat(result.sanitizedInput);
}

// Opção 2: Integração com LLM
const safe = await processUserInputSafely(userInput);
if (!safe.approved) {
  return { error: getSafeBlockedResponse() };
}
await llm.chat(safe.input);
```

### Resultados Possíveis

```typescript
interface PromptGuardResult {
  level: 'allow' | 'review' | 'block';
  reasons: string[]; // Detalhes do que foi detectado
  sanitizedInput: string; // Input depois de normalização
  riskScore: number; // 0-100
}
```

### Risk Score

- **0-19**: Allow (seguro)
- **20-39**: Review (suspeito, investigar manualmente)
- **40+**: Block (perigoso, rejeitar)

### Resposta Bloqueada Padrão

```typescript
getSafeBlockedResponse()
// Retorna: "Posso ajudar apenas com temas financeiros e uso do Flow Finance. 
//           Reformule sua pergunta dentro desse contexto."
```

### Logs e Alertas

Cada detecção é registrada em log estruturado:

```json
{
  "level": "warn",
  "riskScore": 45,
  "reasons": ["pattern_detected:ignore_previous_instructions", "suspicious_term:system_prompt"],
  "userId": "user-anon-...xxx",
  "requestId": "req-uuid"
}
```

Bloqueios são enviados para Sentry como warnings:
- Tags: `security:prompt_injection`, `level:warning`

---

## Parte 4: Integração Clínica Segura

### Objetivo
Receber eventos (receitas, despesas, lembretes) da automação da clínica com segurança, idempotência e observabilidade.

### Arquivos
- `backend/src/validation/clinicAutomation.schema.ts` - Schemas Zod
- `backend/src/services/clinic/ClinicAutomationService.ts` - Processamento
- `backend/src/services/clinic/IdempotentEventStore.ts` - Rastreamento
- `backend/src/api/integrations/clinicRoutes.ts` - Endpoints HTTP

### Endpoints

```
POST /api/integrations/clinic/webhook
GET /api/integrations/clinic/health
```

### Tipos de Eventos

1. **payment_received** - Pagamento recebido
2. **expense_recorded** - Despesa registrada
3. **receivable_reminder_created** - Lembrete de cobrança criado
4. **receivable_reminder_updated** - Lembrete atualizado
5. **receivable_reminder_cleared** - Lembrete quitado

### Requisição

```json
{
  "auth": {
    "sourceSystem": "clinic-automation",
    "requestId": "uuid-unico",
    "hmacSignature": "HMAC-SHA256(payload, shared_secret)",
    "timestamp": "2026-04-05T10:30:00Z"
  },
  "data": {
    "type": "payment_received",
    "externalEventId": "clinic-event-123",
    "externalPatientId": "patient-456",
    "amount": 500.00,
    "currency": "BRL",
    "date": "2026-04-05T10:00:00Z",
    "paymentMethod": "pix",
    "description": "Consulta preparatória"
  }
}
```

### Segurança

#### 1. Autenticação (HMAC-SHA256)
```bash
Signature = HMAC-SHA256(payload_json, CLINIC_WEBHOOK_SECRET)
Header: x-webhook-signature: <hex>
```

#### 2. Idempotência
- Chave: `sourceSystem + externalEventId`
- TTL: 30 dias (suficiente para audit)
- Mesmo evento reprocessado → resposta idempotente sem duplicação

#### 3. Feature Flag
```
clinic_automation_ingest_enabled
```
- Padrão: FALSE (habilitado após testes)
- Kill switch disponível para desativar imediatamente

#### 4. Observabilidade
- Todas as chamadas via `IntegrationMonitor.executeClinicWebhookCall()`
- Tags: `integration:clinic-automation`, `operation:webhook_ingest`, `source_system:clinic-automation`
- Logs estruturados com rastreamento completo

### Exemplo: Enviar Evento da Clínica

```bash
curl -X POST https://api.flow-finance.com/api/integrations/clinic/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: <HMAC>" \
  -H "x-request-id: <uuid>" \
  -d '{
    "auth": {
      "sourceSystem": "clinic-automation",
      "requestId": "uuid",
      "hmacSignature": "...",
      "timestamp": "2026-04-05T10:30:00Z"
    },
    "data": {
      "type": "payment_received",
      "externalEventId": "payment-9876",
      "externalPatientId": "pat-123",
      "amount": 750.00,
      "currency": "BRL",
      "date": "2026-04-05T10:00:00Z",
      "paymentMethod": "transfer",
      "description": "Procedimento cirúrgico"
    }
  }'
```

### Resposta de Sucesso

```json
{
  "success": true,
  "receivedEventId": "flow-internal-uuid",
  "externalEventId": "payment-9876",
  "processedAt": "2026-04-05T10:30:00Z",
  "idempotencyKey": "sha256-hash",
  "message": "Event processed successfully"
}
```

### Resposta de Erro

```json
{
  "success": false,
  "receivedEventId": "flow-internal-uuid",
  "externalEventId": "payment-9876",
  "processedAt": "2026-04-05T10:30:00Z",
  "idempotencyKey": "sha256-hash",
  "message": "Clinic automation ingest is disabled (kill_switch_active)"
}
```

### Health Check

```bash
GET /api/integrations/clinic/health
```

Retorna status de dependências (Redis, feature flags, etc).

---

## Testes

### Rodar Testes

```bash
npm test -- integration-telemetry.test.ts
npm test -- enhanced-feature-flags.test.ts
npm test -- prompt-injection-guard.test.ts
npm test -- clinic-automation-service.test.ts
```

### Cobertura

Meta mínima: **98% de cobertura** nos fluxos críticos.

Locais de teste:
- `backend/tests/unit/integration-telemetry.test.ts`
- `backend/tests/unit/enhanced-feature-flags.test.ts`
- `backend/tests/unit/prompt-injection-guard.test.ts`
- `backend/tests/unit/clinic-automation-service.test.ts`

---

## Operação do Painel Admin (Futuro)

Criar endpoints para dashboard admin:

```typescript
// GET /admin/api/integrations/status
// Status em tempo real de todas as integrações

// GET /admin/api/features
// Listar flags

// POST /admin/api/features/:name/kill-switch
// Ativar kill switch

// POST /admin/api/features/:name/kill-switch/release
// Desativar kill switch

// GET /admin/api/audit/kill-switches
// Histórico de ativações
```

---

## Logs de Referência

### Integração Sucesso
```
integration_event integration_name=stripe operation=payment_process status=success durationMs=1245 httpStatus=200
```

### Kill Switch Ativado
```
kill_switch_activated flagName=clinic_automation_ingest_enabled reason="Incidente: duplicatas" changedBy=admin@flow.com
```

### Prompt Injection Bloqueado
```
prompt_injection_blocked riskScore=52 reasons=["pattern_detected:ignore_previous_instructions"] userId=user-anon-xxx
```

### Webhook Clínica Processado
```
clinic_webhook externalEventId=payment-9876 type=payment_received success=true durationMs=234
```

---

## Próximos Passos

1. ✅ Implementação base de telemetria, flags, injection guard, clinic integration
2. ⏳ Integrar rotas clinic em `backend/src/index.ts`
3. ⏳ Testar com simulador de webhook
4. ⏳ Monitorar alertas Sentry por 1-2 weeks
5. ⏳ Habilitar clinic_automation_ingest em staging
6. ⏳ Habilitar em produção após sucesso em staging
7. ⏳ Criar painel admin para gerenciar flags

