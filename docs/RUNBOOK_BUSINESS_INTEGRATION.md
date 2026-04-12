# Runbook — Business Integration v1

## Objetivo

Operar integrações externas que enviam dados leves para o Flow Finance via:

- POST /api/integrations/transactions
- POST /api/integrations/reminders

## Pré-requisitos

Configurar no backend:

```env
FLOW_EXTERNAL_INTEGRATION_KEYS=key_live_ops
FLOW_EXTERNAL_INTEGRATION_BINDINGS=key_live_ops|ws_123|erp_ops

# opcional, recomendado em produção
FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS=secret_v1
FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS=300
```

## Contrato de autenticação

Headers:

- x-integration-key: obrigatório
- x-integration-timestamp: obrigatório quando HMAC estiver habilitado
- x-integration-signature: obrigatório quando HMAC estiver habilitado
- Idempotency-Key: opcional (compatibilidade para retry do cliente)

Formato de assinatura:

- `sha256=<hex(hmac_sha256(secret, "<timestamp>.<rawBody>"))>`

## Exemplo 1 — Enviar transação (sem HMAC)

```bash
curl -X POST "https://SEU_HOST/api/integrations/transactions" \
  -H "Content-Type: application/json" \
  -H "x-integration-key: key_live_ops" \
  -H "Idempotency-Key: idem-txn-0001" \
  -d '{
    "workspaceId": "ws_123",
    "sourceSystem": "erp_ops",
    "externalRecordId": "txn_2026_04_10_0001",
    "type": "income",
    "amount": 250.00,
    "currency": "BRL",
    "occurredAt": "2026-04-10T14:30:00-03:00",
    "description": "Serviço confirmado e pago",
    "status": "confirmed"
  }'
```

## Exemplo 2 — Enviar lembrete (com HMAC)

### Gerar assinatura no PowerShell

```powershell
$secret = "secret_v1"
$timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$body = '{"workspaceId":"ws_123","sourceSystem":"erp_ops","externalRecordId":"rem_2026_04_10_0007","title":"Pagar fornecedor as 15h","remindAt":"2026-04-10T15:00:00-03:00","kind":"financial","status":"active","priority":"high"}'
$message = "$timestamp.$body"

$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($message))
$hex = -join ($hash | ForEach-Object { $_.ToString("x2") })
$signature = "sha256=$hex"

$headers = @{
  "Content-Type" = "application/json"
  "x-integration-key" = "key_live_ops"
  "x-integration-timestamp" = "$timestamp"
  "x-integration-signature" = $signature
  "Idempotency-Key" = "idem-rem-0007"
}

Invoke-RestMethod -Method Post -Uri "https://SEU_HOST/api/integrations/reminders" -Headers $headers -Body $body
```

## Regras importantes do contrato

- Idempotência lógica principal: sourceSystem + externalRecordId.
- `Idempotency-Key` é apenas cabeçalho de compatibilidade contratual para retries do cliente.
- Não enviar CPF, e-mail, telefone ou dados clínicos sensíveis.
- `income` e `expense` devem ser enviados como `status=confirmed`.
- `receivable`/`payable` com `pending` ou `overdue` devem incluir `dueAt`.
- `receivable`/`payable` com `pending` ou `overdue` são materializados como `reminders`.

## Respostas esperadas

Sucesso:

```json
{
  "ok": true,
  "workspaceId": "ws_123",
  "sourceSystem": "erp_ops",
  "externalRecordId": "txn_2026_04_10_0001",
  "action": "created"
}
```

Erros mais comuns:

- 400 validation_error
- 401 unauthorized
- 403 forbidden
- 503 integration_unavailable

## Checklist de troubleshooting

1. x-integration-key existe em FLOW_EXTERNAL_INTEGRATION_KEYS?
2. O par key|workspaceId|sourceSystem existe em FLOW_EXTERNAL_INTEGRATION_BINDINGS?
3. Se HMAC estiver ativo, timestamp está dentro da janela?
4. Assinatura foi gerada com rawBody idêntico ao enviado?
5. Payload respeita enums e campos obrigatórios?
