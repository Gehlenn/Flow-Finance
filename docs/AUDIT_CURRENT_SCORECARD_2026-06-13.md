# Flow Finance - current audit scorecard

Data: 2026-06-13
Modo: comparacao contra a auditoria pre-mortem completa.
Escopo: SaaS de fluxo de caixa para empresas de servico, conectado a operacao real.

## Veredito executivo atual

O Flow Finance nao esta mais bloqueado por P0/P1 tecnico conhecido dentro da trilha auditada.

Os P1 resolviveis por codigo/teste foram fechados, os gates publicados de billing, bootstrap, activation/retention tecnico, scale readiness e event-store foram revalidados, e `R1`, `R2`, `R3` e `R4` estao fechados como frentes tecnicas/publicadas; isso nao prova retencao comercial ampla.

O risco residual nao e mais "o produto nao funciona". O risco residual e "o produto funciona, mas ainda nao provou habito real ao longo do tempo".

Estado brutal:

- Eu liberaria piloto privado controlado.
- Eu ainda nao chamaria de SaaS pronto para escala comercial ampla.
- Eu nao usaria a palavra "retencao provada" fora do sentido tecnico do gate publicado.
- `SEM EVIDENCIA SUFICIENTE` para churn, LTV, CAC, receita recorrente real, uso recorrente multi-semana, NPS, conversao paga e cohort retention ampla.

## Evidencia-base usada

Implementado e provado:

- Auditoria original: `docs/AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md`
- Plano pos-auditoria: `docs/POST_AUDIT_EXECUTION_PLAN_2026-06-11.md`
- Status de deploy: `docs/DEPLOYMENT_STATUS.md`
- Operacao viva: `docs/OPERATIONS_README.md`
- Gate activation/retention: `docs/ACTIVATION_RETENTION_EVIDENCE_2026-06-04.md`
- Programa de habito: `docs/HABIT_PROOF_PROGRAM_2026-06-13.md`
- Claims guard: `docs/CLAIMS_GUARD_2026-06-15.md`; `scripts/check-audit-claims.mjs`; `test-results/audit-claims/2026-06-15T16-13-28-811Z/report.json`
- R1 final: `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`
- R2 final: `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json`
- Habit proof atual: `test-results/habit-proof-evidence/2026-06-15T12-59-02-724Z/report.json`
- Pacote consolidado atual: `test-results/audit-evidence/2026-06-15T16-13-36-386Z/report.json`

## Resumo das notas

| Area | Nota original | Nota atual | Confianca | Status atual |
| --- | ---: | ---: | --- | --- |
| 1. Produto e proposta de valor | 7 | 8 | Alta | Fechado com ressalva de habito |
| 2. Foco do MVP | 6 | 8 | Alta | Fechado |
| 3. UX/UI web | 6 | 8 | Media | Fechado com regressao visual local |
| 4. UX/UI mobile | 6 | 8 | Media | Fechado com regressao visual local |
| 5. Onboarding e ativacao | 5 | 8 | Alta | Fechado |
| 6. Retencao e habito | 5 | 6 | Alta | Aberto como risco de produto |
| 7. IA consultiva / AI CFO | 6 | 8 | Media | Fechado com monitoramento de uso real |
| 8. Dashboard e fluxo financeiro | 7 | 8 | Alta | Fechado localmente com primeiro viewport decisivo |
| 9. Arquitetura frontend | 6 | 8 | Media | Fechado para piloto com shell e runtime mitigados |
| 10. Arquitetura backend | 7 | 8 | Alta | Fechado com ressalva operacional |
| 11. Firebase, dados e seguranca | 6 | 8 | Alta | Fechado com monitoramento |
| 12. Performance e escala | 7 | 8 | Media | Fechado como gate publicado |
| 13. Observabilidade e operacao | 7 | 8 | Alta | Fechado com ressalva de SLO historico |
| 14. Monetizacao, pricing e assinatura | 6 | 8 | Alta | Fechado para piloto |
| 15. Mercado, concorrencia e diferenciacao | 6 | 7 | Media | Parcialmente fechado |
| 16. Risco de parecer generico | 5 | 8 | Alta | Fechado tecnicamente |
| 17. Prontidao para producao | 7 | 8 | Alta | Piloto privado pronto |

Media simples original: `6.2/10`.
Media simples atual: `7.8/10`.

Leitura correta da media: nao e prova de negocio. E melhora da prontidao tecnica e operacional auditada.

## Scorecard por area

### 1. Produto e proposta de valor

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `components/Dashboard.tsx`; `docs/AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md`; `docs/PRODUCT_FOCUS_SURFACE_REVIEW_2026-06-11.md`; `docs/HABIT_PROOF_PROGRAM_2026-06-13.md`
- Principal problema atual: proposta ficou clara para piloto, mas ainda nao ha prova de que empresas retornam semanalmente por valor percebido.
- Impacto comercial: bom para vender piloto; ainda fraco para promessa de escala.
- Impacto tecnico: core esta concentrado em caixa, mas precisa manter disciplina contra expansao lateral.
- Risco se ignorar: confundir clareza de produto com retencao real.
- Correcao recomendada: manter a narrativa "revisao semanal de caixa para servicos" e medir repeticao real.
- Esforco estimado: baixo a medio.
- Prioridade: P1.

### 2. Foco do MVP

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `docs/POST_AUDIT_EXECUTION_PLAN_2026-06-11.md`; `docs/PRODUCT_FOCUS_SURFACE_REVIEW_2026-06-11.md`; `src/app/mainNavigation.ts`
- Principal problema atual: foco tecnico fechado, mas ainda precisa vigilancia para nao reabrir features laterais.
- Impacto comercial: melhora o pitch e reduz confusao.
- Impacto tecnico: reduz regressao em areas nao-core.
- Risco se ignorar: voltar a parecer super-app financeiro.
- Correcao recomendada: qualquer nova tela deve provar relacao direta com caixa, previsto vs realizado, transacoes uteis ou decisao semanal.
- Esforco estimado: baixo.
- Prioridade: P1.

### 3. UX/UI web

- Nota atual: 8/10
- Confianca: media
- Evidencia usada: `components/Dashboard.tsx`; `components/Login.tsx`; `src/app/visualSystem.ts`; `scripts/capture-visual-regression.mjs`; `test-results/visual-regression/2026-06-14T07-47-08-463Z/manifest.json`; `test-results/ui-login-operational-desktop-2026-06-14-v1.png`; `tests/e2e/runtime-console-health.spec.ts`; `docs/DEPLOYMENT_STATUS.md`
- Principal problema atual: experiencia auditada esta utilizavel e tem regressao visual local; ainda faltam evidencias de comportamento real repetido no browser por usuarios externos.
- Impacto comercial: web esta suficiente para piloto, mas nao prova ativacao em volume.
- Impacto tecnico: runtime publicado esta mais estavel, com menos ruido de `429`.
- Risco se ignorar: achar que runtime verde equivale a UX validada por uso real.
- Correcao recomendada: manter screenshots/runtime checks em cada deploy sensivel e comparar com eventos de uso real.
- Esforco estimado: medio.
- Prioridade: P2.

### 4. UX/UI mobile

- Nota atual: 8/10
- Confianca: media
- Evidencia usada: `components/Dashboard.tsx`; `components/Login.tsx`; `App.tsx`; `pages/AICFO.tsx`; `src/styles/tailwind.css`; `test-results/visual-regression/2026-06-14T07-47-08-463Z/manifest.json`; `test-results/ui-login-operational-mobile-2026-06-14-v1.png`; `npm run health:runtime:mobile`; `docs/AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md`
- Principal problema atual: mobile foi corrigido para o gate tecnico e regressao visual local; ainda nao ha uso recorrente mobile real.
- Impacto comercial: piloto em empresas pequenas depende bastante de mobile.
- Impacto tecnico: precisa manter primeiro viewport preso a caixa, risco e acao.
- Risco se ignorar: mobile virar web comprimido em ciclos futuros.
- Correcao recomendada: cada mudanca no dashboard deve passar por runtime mobile e revisao do primeiro viewport.
- Esforco estimado: medio.
- Prioridade: P2.

### 5. Onboarding e ativacao

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `components/Dashboard.tsx`; `src/app/productAnalytics.ts`; `src/app/productAnalyticsContract.ts`; `scripts/export-activation-retention-events.mjs`; `scripts/check-activation-retention-evidence.mjs`; `test-results/activation-retention-export/2026-06-12T20-44-52-284Z/report.json`; `test-results/activation-retention-evidence/2026-06-12T20-44-53-217Z-events/report.json`
- Principal problema atual: ativacao tecnica fechada e agora tem evento explicito de base financeira completa, mas ainda nao ha volume suficiente para taxa de ativacao.
- Impacto comercial: primeiro valor e demonstravel; conversao ampla segue sem evidencia.
- Impacto tecnico: eventos de ativacao agora existem e sao exportaveis.
- Risco se ignorar: extrapolar de uma coorte para funil inteiro.
- Correcao recomendada: manter o runner e criar cortes por origem de lead quando houver usuarios reais.
- Esforco estimado: baixo a medio.
- Prioridade: P1.

### 6. Retencao e habito

- Nota atual: 6/10
- Confianca: alta
- Evidencia usada: `docs/HABIT_PROOF_PROGRAM_2026-06-13.md`; `docs/AUDIT_EVIDENCE_OPERATING_GUIDE_2026-06-15.md`; `scripts/check-habit-proof-evidence.mjs`; `scripts/summarize-cohort-state.mjs`; `scripts/generate-audit-evidence-report.mjs`; `test-results/habit-proof-evidence/2026-06-15T12-59-02-724Z/report.json`; `test-results/cohort-state/2026-06-15T15-42-19-354Z/report.json`; `test-results/audit-evidence/2026-06-15T15-43-09-876Z/report.json`
- Principal problema atual: gate tecnico de `R1` fechou, o runner longitudinal agora exige ativacao qualificada e ha estado de coorte por workspace, mas habito ainda retorna `BLOCK`.
- Impacto comercial: este e o maior risco real restante; sem habito, o produto vira ferramenta eventual.
- Impacto tecnico: o mecanismo de medicao ficou mais honesto ao exigir dashboard util ou base financeira completa antes de contar habito; o pacote consolidado reduz interpretacao manual, mas faltam semanas reais.
- Risco se ignorar: vender "retencao" sem base, gerando decisao comercial falsa.
- Correcao recomendada: acumular exports publicados reais em semanas diferentes ate atingir `2` semanas, `7` dias e `1` coorte no minimo, sempre depois de ativacao qualificada.
- Esforco estimado: medio por depender de tempo/uso real.
- Prioridade: P1.

### 7. IA consultiva / AI CFO

- Nota atual: 8/10
- Confianca: media
- Evidencia usada: `backend/src/controllers/aiController.ts`; `backend/src/services/ai/AISecurityGuard.ts`; `pages/AICFO.tsx`; `services/geminiService.ts`; `src/ai/cfoEvaluation.ts`; `src/app/productAnalytics.ts`; `scripts/check-ai-quality-evidence.mjs`; `tests/unit/aicfo-plan-render.test.tsx`; `tests/unit/app-shell-demo-status-spacing.test.tsx`; `tests/unit/ai-cfo-evaluation.test.ts`; `tests/unit/ai-quality-evidence.test.ts`; `tests/health/ai-cfo-evaluation.health.test.ts`; `test-results/ai-quality-evidence/2026-06-15T15-58-50-940Z/report.json`; `test-results/ui-aicfo-real-use-desktop-2026-06-13-v1.png`; `test-results/ui-aicfo-real-use-mobile-2026-06-13-v1.png`; `test-results/ui-aicfo-demo-quality-desktop-2026-06-14-v2.png`; `test-results/ui-aicfo-demo-quality-mobile-response-viewport-2026-06-14-v2.png`
- Principal problema atual: contrato tecnico, UI, resposta demo-local e gate offline de qualidade canonica melhoraram, com base sempre visivel, proxima acao, eventos de uso e guarda contra vazamento de contexto bruto; custo real e qualidade percebida em usuario real ainda seguem sem evidencia suficiente.
- Impacto comercial: IA ajuda o pitch, mas nao pode virar promessa de CFO autonomo.
- Impacto tecnico: exige manter fallback, confianca, eventos granulares, testes de resposta, runner offline de qualidade e regressao contra vazamento de contexto bruto.
- Risco se ignorar: resposta generica, repetitiva, confiante demais ou com contexto interno exposto destruir confianca financeira mesmo com UI correta.
- Correcao recomendada: manter IA como consultoria de caixa com confianca, base usada e proxima acao; medir `ai_question_submitted`, `ai_consultation_completed`, `ai_fallback_observed`, `ai_response_action_created` e `ai_response_flow_opened` por workspace/coorte, e manter `avoids_raw_context_leak` como trait obrigatorio da avaliacao.
- Esforco estimado: medio.
- Prioridade: P1.

### 8. Dashboard e fluxo financeiro

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `components/Dashboard.tsx`; `src/app/visualSystem.ts`; `src/finance/weeklyCashReview.ts`; `tests/unit/dashboard-quick-actions.test.tsx`; `tests/unit/dashboard-metrics.test.ts`; `tests/unit/weekly-cash-review.test.ts`; `test-results/visual-regression/2026-06-14T08-15-51-721Z/manifest.json`
- Principal problema atual: dashboard agora abre com leitura unica de decisao (`Caixa real`, `Previsto curto`, `Pendente`, `Vencido`, atencao e revisao semanal), mas a prova de uso recorrente ainda nao fechou.
- Impacto comercial: o dashboard e vendavel para piloto.
- Impacto tecnico: precisa preservar separacao entre caixa real, previsto, pendente e atrasado.
- Risco se ignorar: regressao de decisao critica no principal ponto de valor.
- Correcao recomendada: congelar o contrato de informacao do primeiro viewport e evoluir por evidencias de uso, sem voltar a separar caixa, previsto, pendente e vencido em cards concorrentes.
- Esforco estimado: baixo a medio.
- Prioridade: P1.

### 9. Arquitetura frontend

- Nota atual: 8/10
- Confianca: media
- Evidencia usada: `App.tsx`; `components/app-shell/AppTopStatus.tsx`; `components/app-shell/AppSubNav.tsx`; `components/app-shell/AppMainNav.tsx`; `components/app-shell/AppFab.tsx`; `src/app/mainNavigation.ts`; `src/app/appShellLayout.ts`; `src/app/buildNavigationContext.ts`; `src/app/useAppTheme.ts`; `src/app/useBillingRuntime.ts`; `src/app/useSyncErrorTracking.ts`; `tests/unit/app-shell-layout.test.ts`; `tests/unit/app-shell-navigation.test.tsx`; `tests/unit/app-shell-demo-status-spacing.test.tsx`; `tests/unit/build-navigation-context.test.ts`; `tests/unit/useAppTheme.test.tsx`; `tests/unit/useBillingRuntime.test.tsx`; `tests/unit/useSyncErrorTracking.test.tsx`; `src/app/visualSystem.ts`; `scripts/capture-visual-regression.mjs`; `test-results/visual-regression/2026-06-14T22-28-03-977Z/manifest.json`; `test-results/visual-regression/2026-06-15T00-29-09-190Z/manifest.json`; `test-results/visual-regression/2026-06-15T01-30-35-504Z/manifest.json`; `docs/AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md`
- Principal problema atual: comportamento foi estabilizado; layout/status/FAB, shell visual, navigation context e efeitos runtime sairam do `App.tsx`, mas o arquivo ainda orquestra os hooks de auth, workspace, sync e estado financeiro.
- Impacto comercial: iteracao em produto fica aceitavel, mas refactors futuros podem ser caros.
- Impacto tecnico: risco de acoplamento visual, contexto e efeitos runtime caiu; o acoplamento restante e principalmente de orquestracao, aceitavel para piloto.
- Risco se ignorar: voltar a concentrar novas regras de layout, contexto ou runtime no `App.tsx`.
- Correcao recomendada: manter Fases 1, 2 e 3 como concluidas; novas extracoes devem ocorrer apenas quando houver mudanca funcional clara.
- Esforco estimado: medio.
- Prioridade: P2.

### 10. Arquitetura backend

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `backend/src/services/finance/eventStore.ts`; `backend/src/services/finance/eventStoreFirestore.ts`; `backend/src/routes/finance.ts`; `docs/DEPLOYMENT_STATUS.md`
- Principal problema atual: event-store publicado foi endurecido; ainda ha ressalva natural de operacao continua e custos.
- Impacto comercial: confianca de dados financeiros subiu muito.
- Impacto tecnico: producao agora falha fechado quando nao ha persistencia duravel.
- Risco se ignorar: qualquer fallback local futuro volta a invalidar evidencia.
- Correcao recomendada: manter `domainEventPersistence` como contrato obrigatorio em health/revalidacao.
- Esforco estimado: baixo para manter, medio se mudar store.
- Prioridade: P1.

### 11. Firebase, dados e seguranca

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `firestore.rules`; `docs/AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md`; `docs/DEPLOYMENT_STATUS.md`
- Principal problema atual: trilha sensivel foi fechada, mas dados financeiros exigem revalidacao constante.
- Impacto comercial: melhora confianca para piloto pago.
- Impacto tecnico: regras e event store precisam continuar sendo gates de deploy.
- Risco se ignorar: regressao em multi-tenant, billing ou eventos financeiros.
- Correcao recomendada: manter `npm run test:firestore:rules` e health publicado em qualquer mudanca de auth/dados.
- Esforco estimado: medio.
- Prioridade: P1.

### 12. Performance e escala

- Nota atual: 8/10
- Confianca: media
- Evidencia usada: `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json`; `docs/SCALE_READINESS_REVIEW_2026-06-11.md`
- Principal problema atual: `R2` fechou como gate publicado, mas `L1/L5` seguem documentados e nao substituem carga real de clientes.
- Impacto comercial: piloto esta mais defensavel; escala ampla ainda nao.
- Impacto tecnico: risco reaparece com volume real de sync, IA e workspaces.
- Risco se ignorar: vender alem da capacidade operacional comprovada.
- Correcao recomendada: repetir `health:scale-readiness` em deploys sensiveis e acompanhar SLOs reais quando houver clientes.
- Esforco estimado: medio.
- Prioridade: P2.

### 13. Observabilidade e operacao

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `docs/OPERATIONS_README.md`; `docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md`; `docs/HABIT_PROOF_PROGRAM_2026-06-13.md`; `package.json`
- Principal problema atual: bons runners e runbooks existem, mas SLO historico real ainda nao existe.
- Impacto comercial: incidentes devem ser detectaveis mais cedo.
- Impacto tecnico: artefatos datados reduzem ambiguidade.
- Risco se ignorar: operacao confundir PASS tecnico com saude de negocio.
- Correcao recomendada: separar sempre gate tecnico, evidencia de produto e metrica comercial.
- Esforco estimado: baixo a medio.
- Prioridade: P1.

### 14. Monetizacao, pricing e assinatura

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `docs/STRIPE_LIVE_SMOKE_2026-06-04.md`; `docs/DEPLOYMENT_STATUS.md`; `pages/Pricing.tsx`; `src/app/monetizationPlan.ts`
- Principal problema atual: billing publicado foi validado; ainda falta evidencia de disposicao real de pagamento recorrente.
- Impacto comercial: pode cobrar em piloto controlado; nao prova LTV.
- Impacto tecnico: checkout/portal tem trilha, mas deve ser revalidado a cada mudanca sensivel.
- Risco se ignorar: confundir checkout funcionando com modelo de monetizacao validado.
- Correcao recomendada: manter pricing focado no core e medir conversao/retencao paga quando houver cohort real.
- Esforco estimado: medio.
- Prioridade: P1.

### 15. Mercado, concorrencia e diferenciacao

- Nota atual: 7/10
- Confianca: media
- Evidencia usada: `docs/AUDIT_PRE_MORTEM_FLOW_FINANCE_2026-06-03.md`; `docs/PRODUCT_FOCUS_SURFACE_REVIEW_2026-06-11.md`
- Principal problema atual: diferenciacao melhorou por foco, mas ainda nao ha evidencia de mercado aceitando a tese.
- Impacto comercial: narrativa esta mais clara; aquisicao ainda e incerta.
- Impacto tecnico: evitar suite generica continua sendo decisao arquitetural.
- Risco se ignorar: competir contra ERP/financeiros grandes sem vantagem clara.
- Correcao recomendada: vender "clareza semanal de caixa para servicos" e testar com pilotos reais.
- Esforco estimado: medio.
- Prioridade: P1.

### 16. Risco de parecer generico

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `docs/PRODUCT_FOCUS_SURFACE_REVIEW_2026-06-11.md`; `src/app/mainNavigation.ts`; `docs/POST_AUDIT_EXECUTION_PLAN_2026-06-11.md`
- Principal problema atual: risco tecnicamente reduzido, mas qualquer nova feature lateral pode reabrir o problema.
- Impacto comercial: foco atual ajuda o usuario a entender o produto.
- Impacto tecnico: reduz a pressao por construir super-app.
- Risco se ignorar: o produto voltar a "dashboard financeiro com IA".
- Correcao recomendada: manter checklist de foco antes de aceitar qualquer feature.
- Esforco estimado: baixo.
- Prioridade: P1.

### 17. Prontidao para producao

- Nota atual: 8/10
- Confianca: alta
- Evidencia usada: `docs/DEPLOYMENT_STATUS.md`; `docs/OPERATIONS_README.md`; `test-results/activation-retention-refresh/2026-06-12T20-44-49-665Z/report.json`; `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json`
- Principal problema atual: pronto para piloto privado controlado; nao pronto para claim de escala comercial ampla.
- Impacto comercial: pode iniciar pilotos sem vender como produto maduro.
- Impacto tecnico: gates publicados estao fechados, mas devem ser repetidos em cada deploy sensivel.
- Risco se ignorar: lancamento publico prematuro mascarado por suite de testes verde.
- Correcao recomendada: manter go-live condicionado a revalidacao publicada e a prova longitudinal de habito.
- Esforco estimado: medio.
- Prioridade: P1.

## Checklist comparativo

### Fechado

- [x] P1 de codigo auditados.
- [x] Promessa Pro falsa de exportacao removida.
- [x] Auth/CSRF/origin endurecidos.
- [x] Billing/Stripe publicado validado.
- [x] Firestore rules sensiveis fechadas no recorte auditado.
- [x] Dashboard deixou de comunicar saude sem dados.
- [x] Onboarding/ativacao com valor financeiro inicial.
- [x] Ritual semanal visivel no dashboard.
- [x] `weekly_cash_review_completed` emitido e exportavel.
- [x] `R1` fechado como gate tecnico publicado.
- [x] `R2` fechado como gate tecnico publicado.
- [x] `R3` fechado como foco de produto.
- [x] `R4` fechado como repetibilidade operacional.
- [x] Backend event-store publicado endurecido com `domainEventPersistence`.
- [x] Programa longitudinal de habito criado com runner e thresholds.
- [x] Claims guard criado para bloquear overclaim de retencao, IA validada, conversao, escala comercial e investimento sem fronteira de evidencia.

### Parcial

- [x] Arquitetura frontend: suficiente para piloto; regras puras de layout/status/FAB foram extraidas para `src/app/appShellLayout.ts`, shell visual para `components/app-shell/*`, montagem de contexto para `src/app/buildNavigationContext.ts` e efeitos runtime para `src/app/useAppTheme.ts`, `src/app/useBillingRuntime.ts` e `src/app/useSyncErrorTracking.ts`.
- [~] IA consultiva: bem melhor ancorada no caixa, mas qualidade/custo real em uso amplo ainda sem evidencia.
- [~] Performance/escala: gate publicado fechado, mas carga real de clientes ainda nao existe.
- [~] Observabilidade: runners bons, mas SLO historico por fluxo ainda nao existe.
- [~] Mercado/diferenciacao: foco melhorou, mas demanda real ainda nao foi provada.

### Aberto

- [ ] Provar habito multi-semana com dados reais.
- [ ] Atingir `2` semanas distintas, `7` dias de observacao e `1` coorte no `npm run health:habit-proof`.
- [ ] Medir conversao paga real, churn, LTV, CAC, NPS ou uso recorrente amplo.
- [ ] Confirmar que pilotos reais usam a revisao semanal sem acompanhamento manual.

## Top riscos atuais

| Rank | Severidade | Risco atual | Evidencia | Acao |
| --- | --- | --- | --- | --- |
| 1 | P1 | Produto nao virar habito semanal | `test-results/habit-proof-evidence/2026-06-13T16-13-53-986Z/report.json` | Acumular exports reais em semanas diferentes |
| 2 | P1 | Confundir gate tecnico fechado com retencao comercial | `docs/HABIT_PROOF_PROGRAM_2026-06-13.md` | Manter linguagem de `SEM EVIDENCIA SUFICIENTE` ate runner passar |
| 3 | P1 | Nova feature lateral reabrir risco generico | `docs/PRODUCT_FOCUS_SURFACE_REVIEW_2026-06-11.md` | Aplicar checklist de foco antes de aceitar escopo |
| 4 | P1 | Deploy sensivel reabrir auth/billing/event-store | `docs/PUBLISHED_REVALIDATION_CHECKLIST_2026-06-11.md` | Rerodar checklist publicado por deploy |
| 5 | P1 | Documentacao transformar piloto controlado em claim comercial | `docs/CLAIMS_GUARD_2026-06-15.md`; `scripts/check-audit-claims.mjs` | Rodar `npm run audit:claims` antes de aceitar wording comercial |
| 6 | P2 | IA gerar valor percebido menor que o pitch | `pages/AICFO.tsx`; `src/app/productAnalytics.ts`; `tests/unit/aicfo-plan-render.test.tsx` | Medir pergunta, resposta, fallback, acao criada e navegacao por workspace |
| 7 | P2 | Escala real divergir do runner sintetico | `test-results/scale-readiness-evidence/2026-06-12T15-30-39-687Z/report.json` | Repetir scale readiness com volume real |
| 8 | P2 | Monetizacao validada tecnicamente, mas nao economicamente | `docs/STRIPE_LIVE_SMOKE_2026-06-04.md` | Medir conversao e retencao paga |

## O que falta agora

Falta uma unica frente real: prova longitudinal de habito.

Comando atual:

```bash
npm run health:habit-proof -- --min-distinct-review-weeks 2 --min-observation-days 7 --min-cohorts 1
```

Estado atual:

- Resultado: `BLOCK`
- Motivo: `0` coortes satisfazem o threshold
- Evidencia: `test-results/habit-proof-evidence/2026-06-13T16-13-53-986Z/report.json`
- Leitura: correto e esperado ate existir outra semana real

## Veredito final atual

Eu pagaria por piloto privado controlado.

Eu apostaria em validacao com usuarios reais.

Eu nao investiria nem venderia como SaaS pronto para escala ampla sem o `health:habit-proof` passar com dados reais multi-semana e sem alguma evidencia comercial minima de conversao/retencao.
