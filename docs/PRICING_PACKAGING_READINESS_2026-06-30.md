# Flow Finance - pricing and packaging readiness

Data: 2026-06-30
Status: IMPLEMENTED / VALIDATED OFFLINE

## Escopo

Esta revisao fecha a Step 9 do backlog offline: preparar pricing, packaging e upgrade prompts sem criar novo fluxo de billing real, sem mudar assinatura ativa e sem afirmar prova comercial.

O eixo do packaging continua sendo Flow Finance como SaaS de fluxo de caixa para empresas de servico: caixa, previsto vs realizado, recebiveis, vencimentos, revisao semanal, operacao separada por workspace e IA consultiva para clareza de decisao.

## Implementado

- `src/app/monetizationPlan.ts` agora centraliza o contrato Free/Pro com `PLAN_PACKAGING`, `getPlanPackaging`, `getPlanFeatureMessages`, `getUpgradePromptBullets`, `formatMonthlyPriceBRL`, `formatAnnualPriceBRL` e `getPackagingEvidenceBoundary`.
- `pages/Pricing.tsx` usa o contrato central para headline, job-to-be-done, features, preco mensal/anual de referencia e fronteira de evidencia.
- `components/UpgradePromptCard.tsx`, `pages/AICFO.tsx` e `pages/Insights.tsx` usam bullets e preco vindos do contrato central, reduzindo copy divergente entre superficies.
- `components/Settings.tsx` deixou de vender exportacao de relatorios como Pro porque o backend real ainda nao gera exportacao de relatorio financeiro.
- `src/saas/billingClient.ts` deixou de retornar `plans: []` no fallback/demo local e agora expoe catalogo Free/Pro coerente com `monetizationPlan` e `src/saas/policyEngine.ts`.
- `tests/unit/monetization-plan.test.ts`, `tests/unit/pricing-upgrade-checkout.test.tsx` e `tests/unit/billing-client.test.ts` cobrem o contrato de packaging, upgrade prompts e catalogo local de billing.

## Documentado

- Free: `R$ 0`, foco em validar a rotina semanal de caixa, com registro de entradas, saidas, recebiveis, vencimentos, dashboard, transacoes e lembretes essenciais.
- Pro: `R$ 49,00/mes`, status comercial de validacao, foco em revisao recorrente de caixa, historico, comparativos, risco recorrente, contexto estendido da IA e multiplos workspaces.
- Pro anual: `R$ 490,00/ano` apenas como referencia comercial ate existir price ID anual dedicado no ambiente.
- Exportacao de relatorios/PDF fica fora do pacote vendavel nesta fase porque a geracao real ainda nao esta implementada.

## Inferido

- O packaging esta mais alinhado ao motivo de compra provavel: reduzir incerteza semanal de caixa em empresas de servico.
- A reducao de promessas genericas deve diminuir risco de parecer super-app financeiro, mas isso ainda depende de teste real de compreensao e disposicao a pagar.

## SEM EVIDENCIA SUFICIENTE

- Disposicao real a pagar.
- Conversao paga real.
- Churn, CAC, LTV, NPS ou payback.
- Elasticidade de preco.
- Preferencia do usuario entre Free, Pro mensal e Pro anual.
- Efeito do novo packaging em ativacao, retencao ou receita.

## Risco operacional ainda aberto

O frontend e o fallback local agora usam `R$ 49,00/mes`. O backend tambem ficou alinhado ao mesmo fallback: quando `SAAS_PRO_MONTHLY_PRICE_CENTS` nao existe, o catalogo Pro cai para `4900` centavos.

Para checkout real, o ambiente publicado ainda precisa ter estes envs presentes e coerentes com o price ID do Stripe:

- `SAAS_PRO_MONTHLY_PRICE_CENTS=4900`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`

Nao ha evidencia nesta revisao de que Stripe publicado, price ID real, webhook, portal ou customer por workspace estejam alinhados ao novo packaging.

## Validacao offline

Comandos executados:

```bash
npx vitest run tests/unit/monetization-plan.test.ts tests/unit/pricing-upgrade-checkout.test.tsx tests/unit/aicfo-plan-render.test.tsx tests/unit/insights-plan-render.test.tsx tests/unit/settings-workspace-admin.test.tsx tests/unit/workspace-admin-page.test.tsx tests/unit/billing-client.test.ts --exclude .tmp/** --pool=forks --maxWorkers=1
npm run type-check:app
npm run build
node scripts/capture-visual-regression.mjs --surfaces=pricing --viewports=desktop,mobile
npm run audit:claims
npm run audit:evidence
```

Resultado:

- Unit: `PASS`, `7` arquivos, `47` testes.
- Type-check: `PASS`.
- Build: `PASS`.
- Visual: `test-results/visual-regression/2026-06-30T05-19-34-432Z/manifest.json`, `PASS`, `14` screenshots, incluindo `/pricing` desktop/mobile, `consoleIssues=0`, `pageErrors=0`.
- Claims guard: `test-results/audit-claims/2026-06-30T05-20-03-016Z/report.json`, `PASS`, `77` docs escaneados, `0` violacoes.
- Evidence package: `test-results/audit-evidence/2026-06-30T05-20-07-092Z/report.json`, `BLOCK` somente por `Habit proof` e `Cohort state`.

## Atualizacao de copy e recaptura

Ainda em 2026-06-30, o packaging recebeu uma passada adicional de linguagem para ficar menos generico e mais ligado ao uso recorrente real: revisao semanal de caixa, historico, previsto vs realizado, recebiveis, proximas saidas e workspaces por operacao/cliente de servico.

Arquivos afetados:

- `src/app/monetizationPlan.ts`
- `pages/Pricing.tsx`
- `components/UpgradePromptCard.tsx`

Validacao adicional:

- `npx vitest run tests/unit/transaction-list-edit-category.test.tsx tests/unit/transaction-list-states.test.tsx tests/unit/settings-workspace-admin.test.tsx tests/unit/monetization-plan.test.ts tests/unit/pricing-upgrade-checkout.test.tsx tests/unit/insights-plan-render.test.tsx tests/unit/cashflow-clarity.test.tsx --exclude .tmp/** --pool=forks --maxWorkers=1`: `PASS`, `7` arquivos, `42` testes.
- `npm run type-check:app`: `PASS`.
- `npm run build`: `PASS`.
- `npm run visual:regression -- --tabs=history,flow,settings --surfaces=transaction-edit-modal,cashflow-share-modal,cashflow-strategy-modal,settings-support,insights-empty,pricing --viewports=desktop,mobile`: `test-results/visual-regression/2026-06-30T14-00-58-813Z/manifest.json`, `PASS`, `18` screenshots.
- `npm run audit:claims`: `test-results/audit-claims/2026-06-30T14-00-35-269Z/report.json`, `PASS`, `0` violacoes.
- `npm run audit:evidence`: `test-results/audit-evidence/2026-06-30T14-01-39-628Z/report.json`, `BLOCK` somente por `Habit proof` e `Cohort state`.

## Veredito

Step 9 fica fechada como readiness offline de packaging. O produto tem um contrato Free/Pro mais coerente e testado, mas continua sem prova comercial real. Para producao com checkout, o proximo gate nao e copy; e verificacao publicada de Stripe, envs, price IDs, webhook e portal.
