# UI Simplificacao - Ciclo 1

Data: 2026-04-07

## Escopo executado

Etapas iniciadas e aplicadas:
- Etapa 1: auditoria rapida de UI no roteamento principal e barra de navegacao.
- Etapa 2: ocultacao de escopo congelado (Open Finance/Pluggy) da navegacao principal.
- Etapa 3: simplificacao da navegacao principal com foco no nucleo do produto.

## Arquivos alterados

- App.tsx
- src/app/mainNavigation.ts
- tests/unit/main-navigation.test.ts

## Mudancas realizadas

1. Navegacao principal enxugada para foco de produto:
- Inicio
- Transacoes
- Fluxo
- Consultor IA
- Insights
- Ajustes
- AI Lab (somente dev)

2. Itens removidos da barra principal (ainda preservados no codigo):
- Autopilot
- Analytics
- Contas
- Importar
- Open Banking (ja nao estava na barra; manteve-se fora da experiencia principal)

3. Configuracao do menu centralizada em arquivo dedicado:
- `getMainNavigationItems(isDevMode)` para controlar o menu de forma auditavel.

4. Teste unitario novo para garantir o recorte:
- valida que tabs fora do foco atual nao aparecem em modo de producao.
- valida que `aicontrol` aparece somente em modo dev.

## Validacao executada

- `npm run lint` -> aprovado
- `npm test -- tests/unit/main-navigation.test.ts` -> aprovado

## Pendencias para proximas etapas

1. Decidir ponto de acesso secundario para Contas (se necessario) sem voltar para a barra principal.
2. Avaliar se Insights permanece na barra principal ou migra para acesso contextual no dashboard.

## Atualizacao - Etapa 4 (dashboard)

Arquivos alterados nesta etapa:
- components/Dashboard.tsx
- hooks/useNavigationTabs.tsx
- tests/unit/dashboard-metrics.test.ts

Resumo do ajuste:
- Dashboard passou a destacar indicadores de decisao: saldo atual, entradas no mes, saidas no mes, receitas previstas e receitas confirmadas.
- Removido vazamento residual de navegacao Open Finance/Open Banking no wiring do dashboard em `useNavigationTabs`.
- Incluido calculo dedicado de metricas (`calculateDashboardMetrics`) com teste unitario para proteger regressao.

Validacao desta etapa:
- npm test -- tests/unit/dashboard-metrics.test.ts tests/unit/main-navigation.test.ts -> aprovado

## Atualizacao - Etapa 5 e 6 (assistente + microcopy)

Arquivos alterados nesta etapa:
- src/app/assistantCopy.ts
- pages/AICFO.tsx
- components/Assistant.tsx
- tests/unit/assistant-copy.test.ts

Resumo do ajuste:
- Posicionamento visivel do assistente e do Consultor IA ajustado para tom consultivo e orientado a decisao.
- Reducao de linguagem inflada em cabecalhos e descricoes de IA.
- Placeholder e textos de onboarding alinhados com foco em caixa, entradas, saidas e risco.
- Microcopy centralizada em `assistantCopy.ts` para facilitar manutencao e evitar regressao de discurso.

Validacao desta etapa:
- npm run lint -> aprovado
- npm test -- tests/unit/assistant-copy.test.ts tests/unit/dashboard-metrics.test.ts tests/unit/main-navigation.test.ts -> aprovado

## Atualizacao - Etapa 7 (validacao tecnica ampliada)

Validacoes executadas:
- npm run build -> aprovado
- npm run lint -> aprovado
- npm test -- tests/unit/assistant-copy.test.ts tests/unit/dashboard-metrics.test.ts tests/unit/main-navigation.test.ts -> aprovado
- npx playwright test tests/e2e/basic-load.spec.ts tests/e2e/dashboard.spec.ts --project=chromium --workers=1 --reporter=line -> aprovado (1 passed, 3 skipped, 0 failed)

Status da etapa 7:
- Aprovada

Risco residual:
- Cobertura E2E parcial nesta rodada devido a cenarios skipped; manter monitoramento nas proximas execucoes de regressao completa.

## Atualizacao - Etapa 8 (documentacao consolidada)

### Componentes e arquivos alterados no ciclo

- App.tsx
- src/app/mainNavigation.ts
- components/Dashboard.tsx
- hooks/useNavigationTabs.tsx
- src/app/assistantCopy.ts
- pages/AICFO.tsx
- components/Assistant.tsx
- tests/unit/main-navigation.test.ts
- tests/unit/dashboard-metrics.test.ts
- tests/unit/assistant-copy.test.ts

### Itens removidos ou escondidos da experiencia principal

- Open Finance/Pluggy fora da navegacao principal e sem destaque no dashboard.
- Autopilot fora da barra principal.
- Analytics fora da barra principal.
- Contas fora da barra principal.
- Importar fora da barra principal.

### Itens congelados, mas preservados no codigo

- pages/OpenBanking.tsx
- components/OpenFinance.tsx
- pages/Autopilot.tsx
- components/AdvancedAnalytics.tsx
- pages/Accounts.tsx
- pages/ImportTransactions.tsx

Observacao:
- O objetivo neste ciclo foi retirar competicao visual e de navegacao, nao apagar capacidade futura reutilizavel.

### Impacto funcional do ciclo

- Navegacao principal agora comunica com mais clareza o nucleo do produto.
- Dashboard prioriza leitura de caixa e decisao de curto prazo.
- Assistente e Consultor IA passaram a comunicar apoio consultivo, sem promessa exagerada.
- O recorte atual reduz ruido sem romper o codigo legado congelado.
- Insights saiu da barra principal e passou a ter acesso contextual pelo Dashboard.
- Contas passou a ter acesso secundario contextual pelo Dashboard, sem voltar a competir na navegacao principal.

### Backlog recomendado para o proximo ciclo

1. Definir acesso secundario para Contas sem recolocar a area na barra principal.
2. Revisar telas de Goals, Import e Scanner para verificar se a linguagem e a hierarquia seguem o novo posicionamento.
3. Avaliar consolidacao de copy em outras areas para manter tom consultivo uniforme.
4. Rodar regressao E2E mais ampla quando o ambiente estiver preparado para reduzir a parcela de cenarios skipped.

## Atualizacao - Ciclo seguinte (navegacao contextual)

Arquivos alterados nesta etapa:
- src/app/mainNavigation.ts
- components/Dashboard.tsx
- hooks/useNavigationTabs.tsx
- tests/unit/main-navigation.test.ts
- tests/unit/dashboard-quick-actions.test.tsx

Resumo do ajuste:
- Insights removido da barra principal.
- Dashboard ganhou bloco de acoes rapidas com entrada contextual para Insights e Contas.
- Mantida a estrategia de reduzir competicao visual na navegacao principal.

Validacao desta etapa:
- npm run lint -> aprovado
- npm test -- tests/unit/main-navigation.test.ts tests/unit/dashboard-quick-actions.test.tsx tests/unit/dashboard-metrics.test.ts tests/unit/assistant-copy.test.ts -> aprovado

## Atualizacao - Revisao de telas secundarias

Arquivos alterados nesta etapa:
- src/app/secondaryFlowsCopy.ts
- pages/Goals.tsx
- pages/ImportTransactions.tsx
- pages/ReceiptScanner.tsx
- tests/unit/secondary-flows-copy.test.ts

Resumo do ajuste:
- Goals recebeu copy mais ligada a planejamento e suporte ao caixa.
- Import recebeu copy mais operacional, com enfase em revisao antes de salvar.
- Scanner recebeu copy menos promocional e mais orientada a extracao com confirmacao humana.
- As mensagens passaram a ficar centralizadas em `secondaryFlowsCopy.ts`.

Validacao desta etapa:
- npm run lint -> aprovado
- npm test -- tests/unit/secondary-flows-copy.test.ts tests/unit/assistant-copy.test.ts tests/unit/dashboard-quick-actions.test.tsx tests/unit/dashboard-metrics.test.ts tests/unit/main-navigation.test.ts -> aprovado

## Atualizacao - Regressao E2E ampliada

Validacoes executadas:
- npx playwright test --project=chromium --workers=1 --reporter=line -> aprovado (6 passed, 0 failed, 11 skipped)
- npx playwright test tests/e2e/runtime-console-health.spec.ts --project="Mobile Chrome" --project="Mobile Safari" --workers=1 --reporter=line -> aprovado (2 passed, 0 failed, 0 skipped)

Leitura do resultado:
- Nenhuma suite falhou na regressao ampla.
- A cobertura mobile basica de runtime/console passou sem erro.
- A principal lacuna continua sendo a quantidade de cenarios skipped em fluxos autenticados, billing, transacoes com fixture e Open Banking.

Principais causas dos skips:
- dependencia de shell autenticado
- dependencia de backend/fixtures
- Open Finance desativado por decisao de produto
- precondicoes de billing/admin nao atendidas no ambiente atual

Risco residual atualizado:
- Moderado para release em fluxos autenticados e de negocio mais amplos, nao por falha observada, mas por cobertura E2E ainda parcial.

### Status final do ciclo

- Etapa 1: concluida
- Etapa 2: concluida
- Etapa 3: concluida
- Etapa 4: concluida
- Etapa 5: concluida
- Etapa 6: concluida
- Etapa 7: concluida
- Etapa 8: concluida

Conclusao:
- O ciclo entregou simplificacao real da experiencia principal, alinhada ao foco atual do produto: caixa, transacoes, leitura financeira e apoio consultivo.

## Atualizacao - Hardening E2E (shell autenticado)

Arquivos alterados nesta etapa:
- hooks/useAuthAndWorkspace.ts

Resumo do ajuste:
- Bootstrap E2E passou a usar contexto local sintetico de workspace no hook de auth/workspace, sem depender de hidratacao via Firestore durante o carregamento inicial.
- A deteccao de bootstrap E2E foi estabilizada com memoizacao para evitar reexecucao desnecessaria do efeito de autenticacao a cada render.
- O listener de mudanca de workspace deixou de forcar refresh remoto em modo E2E, reduzindo risco de loops de render e desmontagem de elementos durante interacoes de teste.

Validacao desta etapa:
- npm run lint -> aprovado
- npx vitest run tests/unit/workspace-session.test.ts -> aprovado (4 passed, 0 failed)
- npx playwright test tests/e2e/dashboard.spec.ts tests/e2e/transactions.spec.ts tests/e2e/insights-aicfo.spec.ts tests/e2e/transaction-edit-category.spec.ts --project=chromium --workers=1 -> aprovado (6 passed, 0 failed, 2 skipped)

Risco residual atualizado:
- Baixo para o recorte validado (shell autenticado + dashboard/transacoes/insights).
- Ainda existe cobertura parcial em outros fluxos com precondicoes de fixture, billing e Open Banking desativado por direcao de produto.

## Atualizacao - Reducao de skips E2E (chromium)

Arquivos alterados nesta etapa:
- tests/e2e/dashboard.spec.ts
- tests/e2e/billing.spec.ts
- tests/e2e/transaction-edit-category.spec.ts

Resumo do ajuste:
- Teste de shell em viewport compacto deixou de depender de projeto mobile dedicado.
- Billing passou a usar bootstrap autenticado padrao e waits explicitos, removendo skip condicional por fixture local.
- Fluxo de edicao de categoria ganhou fallback controlado para skip apenas quando historico segue vazio mesmo apos tentativa de criacao manual.

Validacao desta etapa:
- npm run lint -> aprovado
- npx playwright test --project=chromium --workers=1 --reporter=line -> aprovado (15 passed, 0 failed, 2 skipped)

Skips residuais (chromium):
1. Edição de Categoria - TransactionList > Usuário edita categoria de uma transação e recebe feedback visual (fixture-dependent)
2. Open Banking - Pluggy Connect > deve validar connect-token e abrir a área de conexão do Pluggy (backend-dependent e escopo congelado)
