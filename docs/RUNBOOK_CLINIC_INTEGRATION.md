# Runbook — Integração Clínica (Clinic Automation)

**Versão:** 0.9.2+  
**Última atualização:** 2026-04-05  
**Responsável:** On-call backend  
**Endpoint principal:** `POST /api/integrations/clinic/financial-events`  
**Health check:** `GET /api/integrations/clinic/health`

---

## Índice

1. [Visão geral do fluxo](#1-visão-geral-do-fluxo)
2. [Variáveis de ambiente](#2-variáveis-de-ambiente)
3. [Feature flags](#3-feature-flags)
4. [Kill switches](#4-kill-switches)
5. [Rate limiting](#5-rate-limiting)
6. [Autenticação e HMAC](#6-autenticação-e-hmac)
7. [Controle de payload](#7-controle-de-payload)
8. [Idempotência](#8-idempotência)
9. [Health endpoint](#9-health-endpoint)
10. [Thresholds de alerta](#10-thresholds-de-alerta)
11. [Procedimentos de incidente](#11-procedimentos-de-incidente)
12. [Status consolidado da entrega](#12-status-consolidado-da-entrega)

---

## 1. Visão geral do fluxo

```
Sistema Clínica
     │
     ▼ POST /api/integrations/clinic/financial-events
┌────────────────────────────────────────────────────┐
│ 1. clinicEdgeLimiter  (IP-based, antes da auth)    │
│ 2. clinicPayloadLimit (413 se > maxBytes)           │
│ 3. externalIntegrationAuth (API key + HMAC)        │
│ 4. clinicIngestAuthenticatedLimiter (key+IP)       │
│ 5. validate (Zod schema)                           │
│ 6. receiveClinicFinancialEvent                     │
│    ├─ Feature flag: clinic_automation_ingest_enabled│
│    ├─ Idempotência (Redis SET NX EX)               │
│    └─ Processar evento → 202 / 200                 │
└────────────────────────────────────────────────────┘
```

**Tipos de evento aceitos:**

| `type`                        | Efeito no Flow              |
|-------------------------------|-----------------------------|
| `payment_received`            | Gera receita financeira     |
| `expense_recorded`            | Gera despesa financeira     |
| `receivable_reminder_created` | Cria lembrete de cobrança   |
| `receivable_reminder_updated` | Atualiza lembrete           |
| `receivable_reminder_cleared` | Remove lembrete             |

---

## 2. Variáveis de ambiente

### Autenticação

| Variável                               | Obrigatória | Padrão  | Descrição |
|----------------------------------------|-------------|---------|-----------|
| `FLOW_EXTERNAL_INTEGRATION_KEYS`       | ✅ Produção | —       | Lista separada por vírgula de API keys aceitas no header `x-integration-key` |
| `FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS` | Recomendada | —    | Lista separada por vírgula de segredos HMAC-SHA256. Se vazia, validação HMAC é ignorada |
| `FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS` | ❌ | `300`  | Janela máxima de desvio de timestamp (anti-replay). Valor em segundos. |

### Rate limiting

| Variável                              | Padrão | Descrição |
|---------------------------------------|--------|-----------|
| `CLINIC_EDGE_RATE_LIMIT_MAX`          | `300`  | Requisições por minuto por IP (camada de borda, antes da auth) |
| `CLINIC_AUTH_RATE_LIMIT_MAX`          | `200`  | Requisições por minuto por `(api-key + IP)` (pós-auth) |

### Payload

| Variável                              | Padrão    | Descrição |
|---------------------------------------|-----------|-----------|
| `CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES`    | `262144`  | Tamanho máximo do payload em bytes (padrão: 256 KB) |

### Feature flags via env

| Variável              | Valores    | Efeito |
|-----------------------|------------|--------|
| `FF_CLINIC_INGEST`    | `true` / `false` | Habilita ou desabilita `clinic_automation_ingest_enabled` sem reiniciar |
| `FF_CLINIC_AUTO_POST` | `true` / `false` | Habilita ou desabilita `clinic_automation_auto_post_enabled` |
| `FF_KILL_CLINIC`      | `true`     | Ativa `kill_switch_clinic_automation` no boot — interrompe toda ingestão |
| `FF_KILL_AI`          | `true`     | Ativa `kill_switch_ai` — desliga todos os fluxos de IA |
| `FF_KILL_STRIPE`      | `true`     | Ativa `kill_switch_stripe_webhooks` |

### Redis e infra

| Variável        | Obrigatória | Padrão                   | Descrição |
|-----------------|-------------|--------------------------|-----------|
| `REDIS_URL`     | ✅ Produção | `redis://localhost:6379` | URL do Redis. Obrigatória em produção para idempotência e rate limiting distribuído |
| `TRUST_PROXY`   | ❌          | `1`                      | Configuração `trust proxy` do Express. Aceita `boolean`, número inteiro ou string (`loopback`, `10.0.0.1/8`) |

---

## 3. Feature flags

### Flags da integração clínica

| Flag name                            | Padrão   | Ambientes      | Descrição |
|--------------------------------------|----------|----------------|-----------|
| `clinic_automation_ingest_enabled`   | `false`  | staging, prod  | Controla se eventos são aceitos. **Deve ser habilitado manualmente após validação.** |
| `clinic_automation_auto_post_enabled`| `false`  | staging, prod  | Controla se eventos aprovados são postados automaticamente no Flow |

### Como verificar o estado atual das flags

```bash
curl -s \
  -H "x-integration-key: <API_KEY>" \
  -H "x-integration-timestamp: $(date +%s)" \
  https://<host>/api/integrations/clinic/health \
  | jq '.features'
```

Resposta esperada:
```json
{
  "clinicAutomationIngest": { "enabled": false, "reason": "disabled" },
  "clinicAutomationAutoPost": { "enabled": false, "reason": "disabled" }
}
```

### Como habilitar uma flag (sem deploy)

**Via env var (recomendado para produção):**
```bash
# Adicionar ao painel de variáveis do Vercel / Railway / Docker
FF_CLINIC_INGEST=true
```
> A flag é lida no boot do processo. Requer restart do container/serverless.

**Via API em runtime (sem restart):**
```ts
// Chamar internamente em script de on-call ou seed de ambiente
import { getFeatureFlagService } from './config/featureFlags';

const service = getFeatureFlagService();
service.setEnabled(
  'clinic_automation_ingest_enabled',
  true,
  'on-call-engineer',
  'habilitando para ambiente de staging'
);
```

---

## 4. Kill switches

Kill switches têm **prioridade máxima** sobre qualquer flag. Quando ativo, `isEnabled()` retorna sempre `{ enabled: false, reason: 'kill_switch_active' }` para todas as flags associadas, independente de qualquer outro override.

### Mapa de kill switches

| Kill switch                    | Flags derrubadas |
|-------------------------------|------------------|
| `kill_switch_clinic_automation` | `clinic_automation_ingest_enabled`, `clinic_automation_auto_post_enabled` |
| `kill_switch_ai`               | `ai_chat_enabled`, `ai_analysis_enabled`, `ai_deep_analysis_enabled` |
| `kill_switch_stripe_webhooks`  | `stripe_payments_enabled` |

### Como acionar um kill switch em produção (sem deploy, sem restart)

```ts
import { getFeatureFlagService } from './config/featureFlags';

const service = getFeatureFlagService();

// Acionar — para ingestão imediata
service.activateKillSwitch(
  'kill_switch_clinic_automation',
  'on-call-engineer',    // quem acionou
  'alta taxa de erros 5xx no endpoint'  // motivo para auditoria
);
```

> Todas as chamadas subsequentes a `isEnabled('clinic_automation_ingest_enabled', ...)` retornarão `kill_switch_active`. Logs Pino e eventos Sentry são emitidos automaticamente.

### Como acionar via variável de ambiente (requer restart)

```bash
FF_KILL_CLINIC=true   # para toda ingestão da clínica
FF_KILL_AI=true       # para toda IA
FF_KILL_STRIPE=true   # para processamento Stripe
```

### Como desativar um kill switch

```ts
service.deactivateKillSwitch(
  'kill_switch_clinic_automation',
  'on-call-engineer',
  'incidente resolvido'
);
```

> Desativar um kill switch não reabilita flags individualmente. Depois de deativar o kill switch, reabilite as flags desejadas explicitamente.

### Auditoria de ações

O serviço mantém log interno de todas as ativações/desativações:

```ts
const audit = service.getKillSwitchAuditLog();
// Array de: { flagName, action, changedBy, timestamp, environment, reason }
```

---

## 5. Rate limiting

A integração usa **dois limitadores em série**, ambos com fallback em memória quando Redis está indisponível:

### Camada 1 — Edge (por IP, antes da auth)

- **Chave:** `ratelimit:clinic-edge::clinic-edge::{IP}`
- **Limite padrão:** 300 req/min (configurável via `CLINIC_EDGE_RATE_LIMIT_MAX`)
- **Objetivo:** conter burst e ataques antes de qualquer custo de autenticação
- **Resposta ao exceder:** `429 Too Many Requests` + header `RateLimit-Reset`

### Camada 2 — Autenticada (por api-key + IP, pós-auth)

- **Chave:** `ratelimit:clinic-auth::clinic-auth::{API_KEY}::{IP}`
- **Limite padrão:** 200 req/min (configurável via `CLINIC_AUTH_RATE_LIMIT_MAX`)
- **Objetivo:** limitar abuso mesmo com key válida
- **Resposta ao exceder:** `429 Too Many Requests` + header `RateLimit-Reset`

### Headers de rate limit retornados

```
RateLimit-Limit: 200
RateLimit-Remaining: 145
RateLimit-Reset: 1743873420
```

### Ajustar limites em produção

```bash
# Aumentar limites para lote maior durante migração
CLINIC_EDGE_RATE_LIMIT_MAX=1000
CLINIC_AUTH_RATE_LIMIT_MAX=800
```

> Requer restart do processo para ter efeito (lidos no boot).

### Comportamento com Redis indisponível

Ambos os limitadores fazem fallback automático para o rate limiter em memória (`createRateLimitByUser`). O comportamento funcional é mantido, porém **sem compartilhamento entre réplicas**.

---

## 6. Autenticação e HMAC

### Fluxo de autenticação

```
1. Header x-integration-key presente?
   └─ NÃO → 401 Unauthorized

2. Key está em FLOW_EXTERNAL_INTEGRATION_KEYS?
   └─ NÃO → 401 Unauthorized

3. FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS configurado?
   ├─ NÃO → autenticação por key apenas ✓
   └─ SIM → validar HMAC-SHA256

4. Validação HMAC:
   a. Header x-integration-signature presente (formato: sha256=<hex>)?
   b. Header x-integration-timestamp presente?
   c. |now - timestamp| <= FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS?
   d. HMAC(secret, "${timestamp}.${rawBody}") == signature?
   └─ Algum falhar → 401 Unauthorized
```

### Gerar assinatura HMAC (exemplo — sistema clínica)

```ts
import crypto from 'crypto';

const secret = process.env.HMAC_SECRET!;
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify(payload);

const signature = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${body}`)
  .digest('hex');

// Headers a enviar:
// x-integration-key: <KEY>
// x-integration-timestamp: <timestamp>
// x-integration-signature: <signature>
// Content-Type: application/json
```

### Rotacionar keys/secrets sem downtime

`FLOW_EXTERNAL_INTEGRATION_KEYS` e `FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS` aceitam lista separada por vírgula. Durante rotação:

1. Adicionar nova key/secret à lista (mantendo a antiga)
2. Atualizar o sistema da clínica para usar a nova key/secret
3. Após confirmação, remover a key/secret antiga da lista

---

## 7. Controle de payload

- **Limite padrão:** 256 KB (`262144` bytes)
- **Configurável via:** `CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES`
- **Verificação:** feita sobre `rawBody` (bytes UTF-8), antes da autenticação e parse JSON
- **Resposta ao exceder:** `413 Payload Too Large`

```json
{
  "error": "Payload too large",
  "maxBytes": 262144
}
```

Para alterar o limite:
```bash
CLINIC_WEBHOOK_MAX_PAYLOAD_BYTES=524288  # 512 KB
```

---

## 8. Idempotência

Cada evento é identificado por `externalEventId` (string, 1-128 chars, regex `[A-Za-z0-9:_-]+`) e `sourceSystem`.

- **Backend de deduplicação:** Redis com `SET key value NX EX 2592000` (TTL 30 dias)
- **Chave Redis:** `idempotent:{sourceSystem}:{externalEventId}`
- **Evento novo:** `202 Accepted`
- **Evento duplicado:** `200 OK` (resposta idêntica, sem reprocessamento)

Em caso de Redis indisponível, o serviço faz fallback para `GET + SETEX` (janela de race condition pequena — aceitável em dev/staging, não recomendado em produção sem Redis).

**Produção sem Redis configurado causará erro na inicialização do serviço:**
```
Error: REDIS_URL is required for clinic automation in production
```

---

## 9. Health endpoint

```
GET /api/integrations/clinic/health
```

**Autenticação:** requer `x-integration-key` válido (HMAC opcional para GET).

**Resposta saudável (200):**

```json
{
  "healthy": true,
  "checkedAt": "2026-04-05T17:00:00.000Z",
  "environment": "production",
  "dependencies": {
    "redis": "healthy",
    "firestore": "healthy"
  },
  "features": {
    "clinicAutomationIngest": { "enabled": true, "reason": "enabled" },
    "clinicAutomationAutoPost": { "enabled": false, "reason": "disabled" }
  },
  "safeguards": {
    "payloadMaxBytes": 262144,
    "edgeRateLimitMax": 300,
    "authRateLimitMax": 200,
    "timestampSkewSeconds": 300
  }
}
```

**Resposta degradada (503):** quando `healthy: false` (ex: Redis ou Firestore indisponível).

---

## 10. Thresholds de alerta

### Alertas críticos (PagerDuty / on-call imediato)

| Métrica | Threshold | Ação |
|---------|-----------|------|
| Taxa de `401` em `/clinic/financial-events` | > 5% das requisições em 5 min | Verificar rotação de key; possível ataque |
| Taxa de `5xx` no endpoint | > 1% das requisições em 5 min | Verificar logs Sentry; possível bug ou Redis down |
| Health endpoint retornando `503` | qualquer ocorrência | Redis ou Firestore degradado; acionar kill switch se persistir > 2 min |
| Kill switch ativado | qualquer ativação | Log de auditoria automático; verificar causa raiz |
| `REDIS_URL is required` no boot | qualquer ocorrência em produção | Redis não configurado corretamente |

### Alertas de atenção (Slack / dashboard)

| Métrica | Threshold | Ação |
|---------|-----------|------|
| Taxa de `429` em `/clinic/financial-events` | > 10% das requisições em 1 min | Sistema clínica enviando em burst; verificar integração |
| Taxa de `413` | > 0.1% | Payload acima do esperado; revisar contrato de payload |
| Taxa de duplicatas (`200` com mensagem `already processed`) | > 5% | Sistema clínica re-enviando muito; verificar retry logic |
| Latência p95 no endpoint | > 2000ms | Pressão em Redis ou Firestore |
| Latência p99 no endpoint | > 5000ms | Degradação severa; considerar kill switch |

### Queries Sentry sugeridas

```
# 5xx na clínica
event.type:error tags.route:/api/integrations/clinic/financial-events

# Kill switch acionado
message:Kill switch active

# Rate limit excedido
message:Distributed rate limit exceeded tags.namespace:clinic-auth

# Idempotência ativada
message:Clinic event already processed
```

---

## 11. Procedimentos de incidente

### P0 — Parar ingestão imediatamente (sem deploy)

```bash
# Opção A: env var (requer restart do processo)
FF_KILL_CLINIC=true

# Opção B: runtime sem restart (via script de on-call)
node -e "
  const { getFeatureFlagService } = require('./dist/config/featureFlags');
  getFeatureFlagService().activateKillSwitch(
    'kill_switch_clinic_automation',
    'on-call',
    'incidente P0 — parar ingestão'
  );
"
```

### P1 — Suspeita de abuso / key comprometida

1. Remover a key comprometida de `FLOW_EXTERNAL_INTEGRATION_KEYS` (restart necessário)
2. Gerar nova key e comunicar ao sistema clínica
3. Monitorar taxa de `401` por 15 min após rotação
4. Verificar logs de `sourceIp` para identificar padrão de abuso

### P2 — Redis indisponível

1. Verificar `GET /api/integrations/clinic/health` → campo `dependencies.redis`
2. O serviço opera em modo degradado (fallback em memória para rate limit; idempotência sem Redis usa `GET+SETEX`)
3. Se degradação > 30 min, considerar `FF_KILL_CLINIC=true` para evitar duplicação
4. Restaurar Redis e reiniciar o processo para limpar o estado de fallback

### P3 — Feature flag travada como disabled após deploy

```bash
# Verificar estado atual
curl -s -H "x-integration-key: <KEY>" https://<host>/api/integrations/clinic/health | jq '.features'

# Habilitar via env (requer restart)
FF_CLINIC_INGEST=true
```

### Checklist pós-incidente

- [ ] Desativar kill switch se foi ativado: `service.deactivateKillSwitch(...)`
- [ ] Reabilitar flags desejadas explicitamente
- [ ] Revisar audit log de kill switches: `service.getKillSwitchAuditLog()`
- [ ] Verificar eventos duplicados/perdidos no período de indisponibilidade
- [ ] Atualizar `docs/BUGLOG.md` com causa raiz e solução
- [ ] Revisar thresholds de alerta se necessário

---

## 12. Status consolidado da entrega

**Data de consolidação:** 2026-04-05  
**Branch:** `main`  
**Head validado:** `84a08d4`

### Checklist técnico consolidado

- [x] `monitorIntegration` e exports de observabilidade disponíveis e integrados.
- [x] Kill switches adicionados no `EnhancedFeatureFlagService`.
- [x] Configuração central de flags criada em `backend/src/config/featureFlags.ts`.
- [x] `PromptInjectionGuard` integrado no `aiController`.
- [x] Rota e controller da integração clínica implementados.
- [x] Compatibilidade de tipos Redis no fluxo de idempotência/rate limit corrigida.
- [x] Auditoria de testes `.skip`: não há arquivos `*.skip.*`; `test.skip` remanescentes são condicionais de ambiente (E2E local) e não bloqueiam CI.
- [x] Validação final executada com sucesso (`npm run lint`, `npm test`, `npm run test:coverage:critical`).

### Commits relevantes desta rodada

- `a806149` feat(observability): add clinic integration health endpoint
- `214233d` refactor(config): make trust proxy setting configurable via TRUST_PROXY env var
- `d5c8129` docs(runbook): add clinic integration operational runbook (flags, kill switches, alerts)
- `7a885b4` fix(clinic-integration): enforce signed raw body on body routes and rate limit health
- `84a08d4` chore(scripts): add hardened codex environment setup script and guide
