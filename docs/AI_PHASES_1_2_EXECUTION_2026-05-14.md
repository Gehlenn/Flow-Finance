# IA - Fases TÃ©cnicas 1 e 2 (2026-05-14)

## Escopo
Este plano detalha a execucao das entregas 1 e 2 da trilha de IA:
- Entrega 1: conversa persistente do CFO por workspace
- Entrega 2: resposta auditavel e explicavel

## Fase 1 - Persistencia da conversa do CFO (implementada)

### Objetivo
Garantir continuidade de conversa por usuario e workspace no assistente consultivo.

### Arquivos criados
- src/ai/cfoConversationStore.ts
- tests/unit/ai-cfo-conversation-store.test.ts

### Arquivos alterados
- pages/AICFO.tsx

### Mudancas tecnicas
- Store local workspace-scoped para conversas do CFO.
- Load automatico da conversa ao abrir o AICFO.
- Save automatico a cada mudanca de mensagens.
- Clear de conversa sincronizado com storage.
- Limite de mensagens persistidas para evitar crescimento infinito.
- Resiliencia para storage corrompido com fallback seguro + logWarn.

### Contrato de dados
- Mensagem persistida: id, role, text, timestamp, intent opcional, diagnostic opcional.
- Chave de storage: base + workspace ativo + userId.

### Testes da fase
- Persistencia por usuario/workspace.
- Clear seletivo por usuario.
- Fallback quando storage estiver invalido.

## Fase 2 - Resposta auditavel e explicavel (proxima)

### Objetivo
Mostrar ao usuario por que a IA respondeu daquela forma, usando fatos objetivos do contexto.

### Arquivos-alvo (exatos)
- src/ai/aiCFO.ts
- pages/AICFO.tsx
- src/app/productFinancialIntelligence.ts
- tests/unit/ai-cfo-context.test.ts
- tests/unit/ai-cfo-observability.test.ts

### Entregas tecnicas da fase
1. Ampliar contrato de resposta do CFO com bloco explicativo:
- reasons_used (array)
- evidence (snapshot de sinais usados)
- confidence_band por resposta

2. Renderizar bloco de explicabilidade na UI do AICFO:
- "Base da resposta"
- "Sinais usados"
- "Nivel de confianca desta resposta"

3. Ajustar testes:
- validar presenca/shape de dados de explicabilidade
- validar fallback sem quebrar contrato

### Criterio de pronto
- Toda resposta do CFO possui trilha minima de evidencia quando houver base suficiente.
- Fallback continua seguro quando nao houver base.
- Testes unitarios relevantes passam e lint verde.

## Ordem de execucao recomendada
1. Finalizar validacao da Fase 1 no pipeline local.
2. Implementar contrato de explicabilidade em src/ai/aiCFO.ts.
3. Expor explicabilidade em pages/AICFO.tsx.
4. Cobrir com testes unitarios e regressao.
5. Consolidar no relatorio de validacao de UI/IA.


## Status de execucao (atualizado)
- Fase 1: concluida e validada (persistencia de conversa por workspace/usuario).
- Fase 2: implementada no nucleo e UI do CFO com contrato de explicabilidade (reasons_used, evidence, confidence_band).
- Validacao: lint + testes unitarios focados da trilha CFO.

