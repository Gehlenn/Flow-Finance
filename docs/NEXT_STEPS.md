# NEXT STEPS - EXECUCAO ORIENTADA (v0.6.x)

**Data:** 10 de Marco de 2026
**Fase ativa:** v0.6.x - Inteligencia Financeira

## Prioridade Imediata

1. Consolidacao da fase 0.6.x
- validar consumo do advanced context builder nos modulos de produto
- estabilizar contratos entre orquestrador, CFO e Autopilot

Status: concluido em 17/03/2026
- inteligencia de produto consolidada via `productFinancialIntelligence` com sinais acionaveis
- contratos de erro/backend estabilizados com `requestId` e `routeScope`

2. Exposicao em produto
- levar cashflow prediction e money map para Dashboard, Insights e fluxos assistidos
- transformar dados de debug em UI de produto quando fizer sentido

Status: concluido em 17/03/2026
- Dashboard exibe `Sinais priorizados` derivados de contexto financeiro real
- badge de `Picos semanais` e direcao de forecast incorporados ao fluxo de decisao

3. Aprendizado e memoria
- refinar persistencia de SPENDING_PATTERN e recorrencias
- adicionar sinais de confianca e expiracao para distribuicao por categoria

Status: concluido em 17/03/2026
- memoria recebeu API de feedback explicito (positivo/negativo)
- decaimento contextual aplicado por `contextDecayMultiplier`
- metadados de feedback e confianca estendidos para governanca de memoria

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

## Execucao imediata (17/03/2026)

1. Staging deploy validado com novo preflight
- status: pendente de execucao manual no GitHub Actions (workflow_dispatch)
- criterio de pronto: evidencia de run em `staging` com preflight, target validado e deploy efetivo

2. Pluggy E2E estabilizado contra estados variaveis de UI
- status: concluido
- evidencia: fluxo atualizado para `Conectar Banco` ou `Adicionar banco` sem falso-negativo por estado visual

3. Loop de feedback de IA habilitado no Dashboard
- status: concluido
- evidencia: botoes `util/nao util` conectados a `recordMemoryFeedback`

4. Propagacao de requestId no frontend para troubleshooting
- status: concluido
- evidencia: `ApiRequestError` + mensagens Pluggy com `requestId` quando disponivel

5. Release/docs atualizados
- status: concluido
- evidencia: changelog atualizado com pacote `0.6.8`
