# NEXT STEPS - EXECUCAO ORIENTADA (v0.6.x)

**Data:** 10 de Marco de 2026
**Fase ativa:** v0.6.x - Inteligencia Financeira

## Prioridade Imediata

1. AI Context Builder avancado
- consolidar saldo atual, recorrencias, metas e perfil
- padronizar contrato de entrada para AI engines

2. Financial Pattern Detector
- detectar assinaturas, recorrencias e picos
- gerar saida reutilizavel para autopilot e CFO advisor

3. Financial Timeline
- consolidar income/expenses/balance evolution por janela temporal
- expor para dashboards e ai context

4. Perfis Financeiros automaticos
- classificar usuarios em Saver/Spender/Balanced/Risk Taker
- usar classificacao para personalizar recomendacoes

## Entregaveis Tecnicos Sugeridos

- `src/engines/ai/contextBuilder/advancedContextBuilder.ts`
- `src/engines/finance/patternDetector.ts`
- `src/engines/finance/financialTimeline.ts`
- `src/engines/ai/financialProfileClassifier.ts`
- testes unitarios dedicados para cada modulo

## Criterios de aceite da fase 0.6.x

- contexto de IA enriquecido e testado
- padroes financeiros detectados com regras claras
- timeline utilizada por pelo menos 2 modulos (dashboard + IA)
- classificacao de perfil ativa no fluxo de recomendacao
- build e testes verdes no fim de cada incremento
