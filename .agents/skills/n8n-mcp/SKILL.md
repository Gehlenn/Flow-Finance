# n8n-MCP - Flow Finance Automação

## Descrição
Skill para integração com n8n (workflow orchestration). Viabiliza automação com consultório, eventos financeiros, webhooks e sincronização de dados.

## Quando Usar
- Integração com sistema externo de consultório (agenda, pacientes, cobrança)
- Sincronização de receitas e despesas
- Webhooks em-time de eventos (pagamento recebido, lembrete)
- Automação de lembretes de cobrança
- Fluxos de E2E entre consultório e Flow Finance

## Caso de Uso: Clínica Odontológica

**Modelo de Cobrança (Modelo A):**
- Sistema do consultório = fonte de verdade operacional
- Flow recebia reflexos financeiros via webhooks

**Eventos Suportados:**
```json
{
  "event_type": "payment_received",
  "patient_id": "ext_patient_123",
  "amount": 150.00,
  "currency": "BRL",
  "date": "2026-04-09",
  "description": "Limpeza e selante"
}

{
  "event_type": "receivable_reminder_updated",
  "patient_id": "ext_patient_123",
  "amount_pending": 300.00,
  "due_date": "2026-04-15"
}

{
  "event_type": "receivable_cleared",
  "patient_id": "ext_patient_123"
}
```

## Integração com Flow Finance

### Webhook Endpoint
```
POST /api/webhooks/external-events
Headers:
  X-Webhook-Key: [secret]
  Content-Type: application/json

Body: evento JSON (payment_received, receivable_*, etc)
```

### Fluxo
1. n8n orquestra evento do consultório
2. Envia POST para Flow webhook
3. Flow processa (cria receita, atualiza lembrete, etc)
4. Persiste em Firestore

### Modelo de Dados (Flow)
```typescript
interface ExternalEvent {
  id: string
  type: 'payment_received' | 'receivable_reminder_updated' | 'receivable_cleared'
  externalPatientId: string  // técnico, não sensível
  amount: number
  currency: string
  description: string
  timestamp: Date
  processed: boolean
}
```

## Configuração Necessária

### Variáveis de Ambiente
```env
EXTERNAL_WEBHOOK_SECRET=your-secret-key
N8N_WEBHOOK_URL=https://flow-finance.vercel.app/api/webhooks/external-events
N8N_API_KEY=from-n8n-instance
```

### Firestore Rules (segurança)
- ✅ Eventos externos validados por API key
- ✅ Sem dados clínicos sensíveis armazenados
- ✅ Apenas reflexos financeiros persistem

## Status
- 🟡 Planejado para v1.0 (pós-simplificação v0.9)
- 🟡 Aguarda validação de clínica piloto
- 🟡 Docs de contrato de webhook a finalizar

---
**Repositório:** https://github.com/leonardsellem/n8n-mcp  
**Referência:** [AGENTS.md](../../AGENTS.md) | [Product Plan](../../obsidian-vault/Flow/Product%20Plan.md)
