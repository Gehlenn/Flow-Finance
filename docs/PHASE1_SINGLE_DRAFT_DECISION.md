# Fase 1 - Decisao Single-Draft no Intake

## Objetivo
Consolidar o intake de transacoes em um contrato canonico unico (`TransactionDraft`) antes de qualquer persistencia.

## Decisao de produto (Fase 1)
- Fluxo de texto/imagem permanece em modo `single-draft` por intencao.
- Quando a IA retornar multiplas transacoes, o fluxo trata como ambiguo.
- Apenas a primeira transacao e considerada na Fase 1.
- Em caso ambiguo, a UI deve exibir aviso explicito e forcar revisao antes de salvar.
- Nao implementar `multi-draft` nesta fase.

## Contrato canonico
- Modelo unico: `src/domain/transactionDraft.ts`
- Conversao por origem: `src/domain/intakeNormalizer.ts`
- Conversao final para persistencia: `draftToTransaction`

## Origens cobertas no draft unificado
- Manual: `normalizeManual`
- Texto IA: `normalizeFromAIText`
- Scanner IA: `normalizeFromAIImage`
- Importacao de arquivo: `normalizeFromFileImport`
- Integracao externa: `normalizeFromIntegration`

## Regras de roteamento
- `confidenceLevel = high`: pode salvar direto (exceto ambiguidade de multiplas transacoes).
- `confidenceLevel = medium|low`: abre painel de revisao.
- Ambiguidade de multiplas transacoes: sempre abrir revisao.

## Decisoes de escopo do contrato (Fase 1)
- `occurredAt` para texto/imagem/manual segue `now` por padrao.
- `occurredAt` de arquivo/integracao usa data de origem quando disponivel.
- Campos de recorrencia (`recurring`, `recurrenceType`, `recurrenceInterval`) continuam fora do draft unificado nesta fase.
- `fieldConfidences` deve refletir apenas campos com variabilidade real de extração.

## Guardrails
- Nenhuma chamada de IA no frontend deve acessar provider externo diretamente.
- Frontend usa somente endpoints backend (`/api/ai/*`).
- Fluxo manual deve funcionar sem dependencia da IA.
