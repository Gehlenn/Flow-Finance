# Runbook - Business Integration

## Papel deste documento

Operar integracoes externas que enviam transacoes e lembretes financeiros leves para o Flow Finance.

## Endpoints

- `POST /api/integrations/transactions`
- `POST /api/integrations/reminders`

## Variaveis de ambiente

```env
FLOW_EXTERNAL_INTEGRATION_KEYS=key_live_ops
FLOW_EXTERNAL_INTEGRATION_BINDINGS=key_live_ops|ws_123|erp_ops
FLOW_EXTERNAL_INTEGRATION_HMAC_SECRETS=secret_v1
FLOW_EXTERNAL_INTEGRATION_MAX_SKEW_SECONDS=300
```

## Autenticacao

Headers:

- `x-integration-key`: obrigatorio
- `x-integration-timestamp`: obrigatorio quando HMAC estiver habilitado
- `x-integration-signature`: obrigatorio quando HMAC estiver habilitado
- `Idempotency-Key`: opcional para compatibilidade com retries

Assinatura:

```text
sha256=<hex(hmac_sha256(secret, "<timestamp>.<rawBody>"))>
```

## Contrato de transacao

Use `/api/integrations/transactions` para:

- `income`
- `expense`
- `receivable`
- `payable`

Regras:

- `income` e `expense` devem ser enviados como `status=confirmed`
- `receivable` e `payable` com `pending` ou `overdue` devem incluir `dueAt`
- `receivable` e `payable` pendentes sao materializados como lembretes
- nao enviar CPF, telefone, email ou dados clinicos sensiveis

## Contrato de lembrete

Use `/api/integrations/reminders` para lembretes financeiros sem materializacao previa como transacao.

Regras:

- `workspaceId`, `sourceSystem` e `externalRecordId` devem identificar a origem
- `externalRecordId` precisa ser estavel entre retries
- `Idempotency-Key` nao substitui a idempotencia logica por origem

## Exemplo minimo sem HMAC

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
    "description": "Servico confirmado e pago",
    "status": "confirmed"
  }'
```

## Resposta esperada

```json
{
  "ok": true,
  "workspaceId": "ws_123",
  "sourceSystem": "erp_ops",
  "externalRecordId": "txn_2026_04_10_0001",
  "action": "created"
}
```

## Erros comuns

- `400 validation_error`
- `401 unauthorized`
- `403 forbidden`
- `503 integration_unavailable`

## Troubleshooting

1. `x-integration-key` existe em `FLOW_EXTERNAL_INTEGRATION_KEYS`?
2. O par `key|workspaceId|sourceSystem` existe em `FLOW_EXTERNAL_INTEGRATION_BINDINGS`?
3. Se HMAC estiver ativo, o timestamp esta dentro da janela?
4. A assinatura foi gerada com o mesmo `rawBody` enviado?
5. Payload respeita enums e campos obrigatorios?

## Referencias

- [OPENAPI_MULTI_TENANT.yaml](./OPENAPI_MULTI_TENANT.yaml)
- [backend/src/docs/openapi.ts](E:\app e jogos criados\Flow-Finance\backend\src\docs\openapi.ts)
