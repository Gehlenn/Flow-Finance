# Flow Finance - copy and positioning review

Data: 2026-06-30
Status: IMPLEMENTED / VALIDATED OFFLINE

## Escopo

Esta revisao fecha a Step 10 do backlog offline: reduzir linguagem generica de fintech/IA e reforcar Flow Finance como SaaS de fluxo de caixa para empresas de servico.

O objetivo nao foi criar nova feature. Foi alinhar copy visivel ao nucleo do MVP: caixa, previsto vs realizado, recebiveis, proximos vencimentos, revisao semanal, operacao separada e IA consultiva como apoio de decisao.

## Implementado

- `pages/Pricing.tsx`: headline mudou para `Free e Pro para controle de caixa`; o texto deixou de falar em `super-app financeiro` dentro da propria UI.
- `src/app/monetizationPlan.ts`: pacote Pro passou a vender `Revisao semanal de caixa ilimitada`, historico para comparar previsto vs realizado e workspaces separados, em vez de vender IA como eixo principal.
- `pages/AICFO.tsx`: lembretes, paywall, diagnosticos e mensagens de falha trocaram `CFO`/`IA` por `consultor de caixa`, `revisao semanal de caixa` e `diagnostico do caixa`.
- `components/Dashboard.tsx`: CTA de leitura deixou de falar `insights completos` e passou a falar `leitura completa da semana` / `sinais essenciais do caixa`.
- `components/CashFlow.tsx`: fallback e estrategia passaram de `IA sem resposta completa` / `proximo passo financeiro` para `diagnostico de caixa incompleto` / `proxima decisao de caixa`.
- `pages/ImportTransactions.tsx`: importacao passou de `classificacao automatica por IA` e `Insights atualizam automaticamente` para categorizacao assistida, revisao antes de confirmar no caixa e sinais do caixa atualizados.
- `components/Settings.tsx`: suporte deixou de aparecer como `Guia com IA` e virou `Revisao de caixa`, ancorado em caixa, recebiveis e proxima decisao.
- `components/AIInput.tsx`: avisos de rascunho trocaram `a IA detectou/leu/processou` por linguagem de rascunho operacional e revisao antes de salvar.
- `components/TransactionList.tsx`: sugestao e aprendizado de categoria deixaram de vender `IA treinada` e passaram a falar em categoria sugerida/aprendizado salvo.
- `src/app/mainNavigation.ts`: secao principal `IA` virou `Decisao`, mantendo `Lab IA` apenas como item dev-only.
- `scripts/capture-visual-regression.mjs`: ready/click selectors foram atualizados para as novas labels de `Free e Pro para controle de caixa` e `Revisao de caixa`.

## Documentado

- GPT-5.5 ficou com orquestracao/revisao.
- Subagente GPT-5.4-mini fez inventario read-only de strings com maior risco de drift.
- A fronteira permanece: copy mais focada nao prova diferenciacao de mercado, compreensao por usuario, conversao, retencao ou disposicao a pagar.

## Inferido

- A linguagem agora puxa menos para app financeiro generico e menos para produto vendido por IA.
- O produto deve ficar mais facil de escanear como ferramenta de decisao semanal de caixa, mas isso ainda precisa de uso real.

## SEM EVIDENCIA SUFICIENTE

- Diferenciacao percebida por usuarios reais.
- Aumento de ativacao, retencao, conversao ou disposicao a pagar.
- Reducao de churn, CAC ou tempo de suporte.
- Confianca real nas respostas consultivas.

## Validacao offline

Comandos executados:

```bash
npx vitest run tests/unit/monetization-plan.test.ts tests/unit/pricing-upgrade-checkout.test.tsx tests/unit/aicfo-plan-render.test.tsx tests/unit/cashflow-clarity.test.tsx tests/unit/dashboard-quick-actions.test.tsx tests/unit/import-transactions-session.test.tsx tests/unit/settings-workspace-admin.test.tsx tests/unit/ai-input.test.tsx tests/unit/transaction-list-edit-category.test.tsx tests/unit/transaction-list-suggestion-diagnostic.test.tsx tests/unit/transaction-list-category-learning-diagnostic.test.tsx tests/unit/main-navigation.test.ts tests/unit/app-shell-navigation.test.tsx tests/unit/app-dev-tools-composition.test.tsx --exclude .tmp/** --pool=forks --maxWorkers=1
node --check scripts/capture-visual-regression.mjs
npm run type-check:app
npm run build
node scripts/capture-visual-regression.mjs --tabs=dashboard,flow,import,cfo,settings --surfaces=pricing --viewports=desktop,mobile
npm run docs:check-links
npm run docs:check-mojibake
npm run audit:claims
npm run audit:evidence
```

Resultado:

- Unit: `PASS`, `14` arquivos, `78` testes.
- Script check: `PASS`.
- Type-check: `PASS`.
- Build: `PASS`.
- Visual: `test-results/visual-regression/2026-06-30T14-01-50-977Z/manifest.json`, `PASS`, `12` screenshots, `consoleIssues=0`, `pageErrors=0`.
- Docs links: `PASS`.
- Mojibake check: `PASS`.
- Claims guard: `test-results/audit-claims/2026-06-30T14-07-10-765Z/report.json`, `PASS`, `78` docs escaneados, `0` violacoes.
- Evidence package: `test-results/audit-evidence/2026-06-30T14-07-22-229Z/report.json`, `BLOCK` somente por `Habit proof` e `Cohort state`.

Validacao complementar da rodada de P1 UI + copy/pricing:

- Focused unit: `PASS`, `7` arquivos, `42` testes.
- Visual complementar: `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`, `PASS`, `18` screenshots.
- Claims guard final desta sessao: `test-results/audit-claims/2026-06-30T14-06-40-670Z/report.json`, `PASS`, `78` docs escaneados, `0` violacoes.
- Evidence package final desta sessao: `test-results/audit-evidence/2026-06-30T14-06-49-207Z/report.json`, `BLOCK` somente por `Habit proof` e `Cohort state`.

## Veredito

Step 10 fica fechada como alinhamento offline de copy e posicionamento. O produto ficou menos generico e menos dependente de promessa de IA, mas a diferenciacao comercial continua `SEM EVIDENCIA SUFICIENTE` ate haver sessao real, feedback e dados de comportamento.
