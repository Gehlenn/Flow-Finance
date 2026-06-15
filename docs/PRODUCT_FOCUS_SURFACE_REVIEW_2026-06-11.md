# Product Focus Surface Review - 2026-06-11

## Papel deste documento

Este documento revisa a superficie principal ativa do Flow Finance contra a tese do produto:

- fluxo de caixa para empresas de servico
- caixa real
- previsto vs realizado
- recebiveis em risco
- proxima acao da semana

Ele nao mede conversao nem retencao real.
Ele mede aderencia de superficie.

## Veredito rapido

Status geral: ALINHADO APOS CORRECAO DE LABELS

Leitura brutal:

- login, dashboard, pricing e AI CFO estao alinhados ao core com boa consistencia
- a navegacao principal saiu da linguagem generica e ficou mais explicitamente financeira
- o produto nao parece mais super-app financeiro aberto
- o risco residual de foco nesta superficie principal caiu para baixo

## Evidencia revisada

- `src/app/mainNavigation.ts`
- `components/Login.tsx`
- `components/Dashboard.tsx`
- `pages/Pricing.tsx`
- `pages/AICFO.tsx`

## O que esta alinhado

### 1. Login

Evidencia:

- `components/Login.tsx`

Leitura:

- a tese aparece cedo e em texto explicito
- o produto e descrito como fluxo de caixa para empresas de servico
- a promessa principal fala de caixa real, previsto e recebiveis antes da decisao da semana

Julgamento:

- alinhado ao core

### 2. Dashboard

Evidencia:

- `components/Dashboard.tsx`

Leitura:

- o painel principal separa saldo atual, entradas, saidas e proximo recebivel
- o bloco de atencao coloca risco, pendencia e proxima acao no centro
- o zero-state e a ativacao guiada continuam ancorados em saldo, entrada, saida e recebivel
- o painel deixa claro que recebivel pendente nao e caixa disponivel

Julgamento:

- fortemente alinhado ao core

### 3. Pricing

Evidencia:

- `pages/Pricing.tsx`

Leitura:

- o Free esta posicionado como validacao do fluxo de caixa operacional
- o Pro aprofunda revisao semanal, historico, risco e operacoes separadas
- nao ha promessa de feature lateral vazia como exportacao inexistente

Julgamento:

- alinhado ao core

### 4. AI CFO

Evidencia:

- `pages/AICFO.tsx`

Leitura:

- perguntas rapidas estao centradas em caixa, risco, vencimento e corte
- o disclaimer consultivo esta visivel
- o contexto rapido mostra saldo, 7 dias e 30 dias
- a base da resposta, confianca e fallback estao visiveis

Julgamento:

- alinhado ao core

## O que desviava antes da correcao

### 1. Navegacao principal ainda usa rotulos genericos em excesso

Evidencia:

- `src/app/mainNavigation.ts`

Trechos relevantes:

- secao `cash`: `Visao geral`, `Insights`, `Ajustes`
- secao `operation`: `Transacoes`, `Importar`, `Contas`, `Metas`
- secao `revenue`: `Fluxo`, `Analises`
- secao `ai`: `Consultor`, `Tarefas`, `Workspace`, `Auditoria`

Leitura:

- a estrutura esta muito melhor do que antes, porque dev tools ja estao condicionados e o core financeiro domina mais a frente principal
- mesmo assim, varios labels continuam amplos demais:
  - `Insights`
  - `Ajustes`
  - `Metas`
  - `Analises`
  - `Tarefas`
- esses nomes nao deixam claro, por si so, que o produto existe para leitura semanal de caixa

Correcao aplicada em `src/app/mainNavigation.ts`:

- `Visao geral` -> `Resumo`
- `Insights` -> `Sinais do caixa`
- `Ajustes` -> `Conta e plano`
- `Metas` -> `Metas de caixa`
- `Fluxo` -> `Previsto vs realizado`
- `Analises` -> `Historico de receita`
- `Consultor` -> `Consultor de caixa`
- `Tarefas` -> `Plano de acao`

Validacao:

- `npx vitest run tests/unit/main-navigation.test.ts tests/unit/app-shell-navigation.test.tsx`
- `npx playwright test tests/e2e/performance.spec.ts tests/e2e/runtime-console-health.spec.ts --project=chromium --workers=1`

Julgamento:

- fechado neste recorte de superficie principal

Severidade:

- P2

### 2. Secao "IA" ainda mistura consultoria com superficie de apoio

Evidencia:

- `src/app/mainNavigation.ts`

Leitura:

- `Consultor` esta coerente
- `Tarefas` dentro de `IA` empurra a percepcao para assistente generico
- `Workspace` e `Auditoria` continuam protegidos por papel, o que reduz risco para usuario comum
- o problema principal nao e permissao; e linguagem

Julgamento:

- risco moderado de diluicao de tese

Severidade:

- P2

## O que nao encontrei como problema relevante agora

- promessa central de Open Banking como eixo do MVP
- promessa central de OCR como eixo do MVP
- retorno da narrativa de "CFO autonomo" como headline principal
- volta de promessa Pro sem backend real comprovado
- dashboard voltando a tratar previsto como caixa disponivel

## Decisao sobre R3

Status: CLOSED

Motivo:

- a superficie principal revisada agora repete a tese de caixa semanal com menos ambiguidade
- a navegacao central deixou de usar os labels mais genericos que sustentavam a critica residual
- nao apareceu retorno de narrativa central de Open Banking, OCR ou assistente financeiro amplo

## Correcao recomendada

Sem mudar a tese nem inventar telas novas:

1. manter futuros labels da navegacao presos ao core financeiro
2. manter `Consultor de caixa` como frente principal da IA
3. nao reintroduzir labels genericos sem justificativa de produto

## Criterio de fechamento

R3 fechou porque:

- a navegacao principal deixou de usar linguagem generica para as telas centrais mais visiveis
- a secao de IA deixou de sugerir assistente amplo no label principal
- a leitura da superficie principal agora repete com mais clareza a tese de caixa semanal para empresas de servico
