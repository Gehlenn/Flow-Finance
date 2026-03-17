# NEXT STEPS - EXECUCAO ORIENTADA (v0.6.x)

**Data:** 10 de Marco de 2026
**Fase ativa:** v0.6.x - Inteligencia Financeira

## Prioridade Imediata

1. Consolidacao da fase 0.6.x
- validar consumo do advanced context builder nos modulos de produto
- estabilizar contratos entre orquestrador, CFO e Autopilot

2. Exposicao em produto
- levar cashflow prediction e money map para Dashboard, Insights e fluxos assistidos
- transformar dados de debug em UI de produto quando fizer sentido

3. Aprendizado e memoria
- refinar persistencia de SPENDING_PATTERN e recorrencias
- adicionar sinais de confianca e expiracao para distribuicao por categoria

4. Cobertura de integracao
- adicionar testes para advancedContextBuilder e viewers internos
- ampliar cenarios de previsao e dominancia por categoria

Status: concluido em 17/03/2026
- testes adicionados para `advancedContextBuilder`
- testes de integracao adicionados para viewers internos do painel de IA
- cenarios de previsao e dominancia por categoria ampliados e validados

5. Open Finance em standby estrategico
- manter codigo, testes e infraestrutura preservados para reativacao futura
- nao priorizar Pluggy ou Stripe enquanto custo operacional permanecer inviavel
- reavaliar somente quando receita do produto justificar o custo mensal

Status: concluido em 17/03/2026
- gate ativo em `/api/banking` via `DISABLE_OPEN_FINANCE=true`
- infraestrutura Pluggy/Stripe preservada no codigo para reativacao futura
- documentacao operacional e estrategia economica alinhadas para standby

## Entregaveis Tecnicos Sugeridos

- `src/engines/ai/contextBuilder/advancedContextBuilder.ts`
- `src/engines/finance/patternDetector/financialPatternDetector.ts`
- `src/engines/finance/financialTimeline.ts`
- `src/engines/ai/financialProfileClassifier.ts`
- `src/engines/finance/cashflowPrediction/`
- `src/engines/finance/moneyMap/`
- testes unitarios dedicados para cada modulo

## Criterios de aceite da fase 0.6.x

- contexto de IA enriquecido e testado
- padroes financeiros detectados com regras claras
- timeline utilizada por pelo menos 2 modulos (dashboard + IA)
- classificacao de perfil ativa no fluxo de recomendacao
- previsao de saldo em 7/30/90 dias disponivel para engines internos
- money map disponivel para memoria, debug panel e alertas
- build e testes verdes no fim de cada incremento
