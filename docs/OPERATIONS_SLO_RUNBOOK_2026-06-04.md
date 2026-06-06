# Flow Finance - SLO e runbook operacional vivo

Data: 2026-06-04  
Escopo: piloto privado do Flow Finance como SaaS de fluxo de caixa para empresas de servico.  
Status: documento operacional vivo. Estes SLOs sao alvos de operacao; ainda nao sao metricas historicas comprovadas.

## Regras de leitura

- Nao usar este documento como prova de uptime, latencia, conversao ou retencao real.
- Onde nao existe evidencia de producao, assumir `SEM EVIDENCIA SUFICIENTE`.
- Em incidente envolvendo dados financeiros, auth, billing ou IA consultiva, priorizar integridade e clareza sobre disponibilidade cosmetica.
- Open Banking, OCR e automacoes externas nao sao fluxo principal do MVP; so entram como aceleradores quando houver evidencia de uso real.

## Gates antes de piloto pago

1. `npm run type-check`
2. `npm run test:critical`
3. `npm run health:runtime`
4. `npm run health:runtime:mobile`
5. `npm run health:vercel`
6. `npm run test:firestore:rules` em Java 21+
7. `npm run health:stripe-live-smoke` com ambiente configurado e evidencia real anexada
8. `npm run health:activation-retention -- --input <export-real> --cohort-window-days <dias>` com export real de usuarios/workspaces; gate fechado em 2026-06-05 com `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`, `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/events.jsonl`, `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json`, `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.md` e `test-results/activation-retention-export/published-export-verified.json`; use o runner apenas para refresh/comparacao
9. `npm run health:target-performance` com URL alvo e baseline local comparavel, mais artefato anexado; o gate externo correspondente ja foi evidenciado em 2026-06-04 e este runner serve para renovar/comparar a evidencia

Se o smoke Stripe real nao rodou, nao cobrar cliente real.
Se um refresh futuro ainda nao trouxer export real valido, nao promover a renovacao dessa evidencia e reexecutar o runner apenas como rechecagem.
Se o baseline nao foi repetido no ambiente alvo, a renovacao de evidencia fica pendente. O gate de performance ja foi fechado em 2026-06-04 com PASS real e artefato anexado.

## Gates externos para public launch

Os gates externos de launch foram fechados. O shell pos-signup do frontend foi ajustado para nao prender a experiencia em loading quando o perfil ja carregou; isso nao reabre activation/retencao.

- [GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md](./GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md)
- [STRIPE_LIVE_SMOKE_2026-06-04.md](./STRIPE_LIVE_SMOKE_2026-06-04.md)
- [ACTIVATION_RETENTION_EVIDENCE_2026-06-04.md](./ACTIVATION_RETENTION_EVIDENCE_2026-06-04.md)
- o checklist de activation/retention agora e registro de gate fechado, nao bloqueio aberto
- Stripe real smoke
- ativacao e retencao por cohort real ja fechada em 2026-06-05

Nao tratar sandbox, testes locais ou harness local como fechamento desses gates.

## Matriz SLO por fluxo

| Fluxo | Usuario afetado | SLO alvo do piloto | Indicador minimo | Alerta | Primeiro responsavel |
| --- | --- | --- | --- | --- | --- |
| Login e sessao | Usuario autenticado ou demo | 99.5% de tentativas sem erro de auth/session no periodo de piloto | health auth local, logs de `auth-*`, erro visivel no login | pico de falhas de login, refresh recusado ou dominio OAuth bloqueado | Engenharia |
| Dashboard de caixa | Usuario com workspace ativo | 99% de carregamentos sem zero-state falso ou crash | runtime web/mobile, eventos `activation_*`, console sem erro critico | dashboard sem saldo/previsto quando ha dados locais ou erro de renderizacao | Produto + Engenharia |
| Ingestao manual de dados | Usuario criando saldo, entrada, saida ou recebivel | 99% de operacoes locais aceitas quando workspace esta valido | eventos `activation_first_transaction`, logs `finance-service-*`, erros de formulario | transacao criada sem workspace/tenant ou falha silenciosa ao salvar | Engenharia |
| Consultor IA | Usuario usando AICFO | 98% de consultas com resposta, diagnostico ou fallback explicito | eventos `ai_consultation_completed` e `ai_fallback_observed`, logs `aicfo-*`, `ai_cfo_request_failed` | resposta sem confianca/diagnostico quando geracao falha | Produto + Engenharia |
| Billing e assinatura | Owner/admin de workspace | 100% de tentativas de checkout com sucesso ou erro claro | eventos `billing_checkout_*`, logs Stripe, webhook dedupe | checkout sem URL, webhook recusado, plano alterado sem auditoria | Engenharia |
| Health e deploy backend | Operador interno | 99.9% de probes `/health`, `/api/health`, `/api/version` respondendo contrato esperado | `npm run health:vercel` | 404/HTML em health, version ausente, backend apontado para frontend | Engenharia |

## Runbook de incidente

### Severidade

- P0: vazamento, corrupcao ou perda de dados financeiros; auth quebrada para usuarios reais; cobranca indevida; webhook Stripe duplicando plano; IA sugerindo decisao sem fallback/confianca quando o modelo falhou.
- P1: login, dashboard, ingestao, IA ou billing indisponivel para parte relevante dos usuarios; erro sem mensagem acionavel; health de producao quebrado.
- P2: degradacao com workaround claro; metricas ou eventos faltando; UX de diagnostico confusa.
- P3: melhoria de texto, documentacao ou monitoramento sem impacto operacional imediato.

### Passos comuns

1. Congelar mudancas de release ate classificar severidade.
2. Registrar fluxo afetado, workspace afetado quando disponivel, horario e comando/evidencia.
3. Confirmar se o problema e local, Vercel, Firebase/Firestore, Stripe, provedor IA ou codigo de aplicacao.
4. Rodar apenas os checks relacionados ao fluxo afetado antes de rodar suites amplas.
5. Se envolver dado financeiro ou billing, preservar logs e nao executar correcao manual sem trilha de auditoria.
6. Atualizar este runbook ou o checklist de auditoria se a causa-raiz virar procedimento recorrente.

## Triagem por fluxo

### Relatorio semanal e ritual de caixa

Evidencia primaria:
- `src/finance/weeklyCashReview.ts`
- `tests/unit/weekly-cash-review.test.ts`
- evento `weekly_cash_review_completed`

Comandos:

```bash
npx vitest run tests/unit/weekly-cash-review.test.ts tests/unit/product-analytics.test.ts
npm run health:activation-retention
```

Primeiro diagnostico:
- o relatorio semanal deve separar entradas confirmadas, saidas confirmadas, recebiveis previstos, recebiveis vencidos e proximas acoes.
- o historico deve ser escopado por workspace e deduplicado por semana.
- o evento `weekly_cash_review_completed` mede conclusao do ritual; o gate de activation/retention foi fechado em 2026-06-05 com export real backend-autenticado, entao a prova de coorte real agora esta nos artefatos publicados acima.
- `npm run health:activation-retention` deve gerar artefato em `test-results/activation-retention-evidence/` e manter `SEM EVIDENCIA SUFICIENTE` quando faltar export real.

### Login e sessao

Evidencia primaria:
- `components/Login.tsx`
- `backend/src/routes/auth.ts`
- `backend/src/middleware/csrfOrigin.ts`
- `tests/unit/auth-routes-security.test.ts`
- `backend/tests/unit/csrf-origin.test.ts`
- `npm run health:auth-local`

Comandos:

```bash
npm run health:auth-local
npx vitest run backend/tests/unit/auth-routes-security.test.ts backend/tests/unit/csrf-origin.test.ts
```

Primeiro diagnostico:
- verificar se o erro e dominio OAuth, cookie/CSRF/origin, Firebase indisponivel ou workspace hydration.
- se refresh com cookie falhar, checar origin e CSRF antes de alterar auth.
- se login local/demo falhar, nao assumir falha de Firebase.

### Dashboard de caixa

Evidencia primaria:
- `components/Dashboard.tsx`
- `hooks/useNavigationTabs.tsx`
- `src/app/financeService.ts`
- `tests/unit/dashboard-metrics.test.ts`
- `tests/unit/dashboard-quick-actions.test.tsx`
- `tests/e2e/runtime-console-health.spec.ts`

Comandos:

```bash
npx vitest run tests/unit/dashboard-metrics.test.ts tests/unit/dashboard-quick-actions.test.tsx
npm run health:runtime
npm run health:runtime:mobile
```

Primeiro diagnostico:
- confirmar se o usuario tem conta, transacao e recebivel suficientes.
- zero-state sem dados e comportamento esperado; saude financeira com base vazia e incidente.
- checar se FAB/bottom nav estao ocultando CTA de ativacao no mobile.

### Ingestao manual de dados

Evidencia primaria:
- `src/app/financeService.ts`
- `hooks/useFinancialState.ts`
- `src/app/productAnalytics.ts`
- `tests/unit/finance-service.test.ts`
- `tests/unit/useFinancialState.test.tsx`
- `tests/unit/product-analytics.test.ts`

Comandos:

```bash
npx vitest run tests/unit/finance-service.test.ts tests/unit/useFinancialState.test.tsx tests/unit/product-analytics.test.ts
```

Primeiro diagnostico:
- verificar se `tenant_id` e `workspace_id` acompanham a entidade.
- checar se dedupe de analytics nao expoe IDs crus em localStorage.
- se a criacao local funciona e sync falha, tratar como sync/backend, nao como bug de formulario.

### Consultor IA

Evidencia primaria:
- `pages/AICFO.tsx`
- `src/ai/aiCFO.ts`
- `src/ai/aiCFOHelpers.ts`
- `backend/src/controllers/aiController.ts`
- `tests/unit/aicfo-plan-render.test.tsx`
- `tests/unit/ai-cfo-observability.test.ts`
- `backend/tests/unit/ai-controller-observability.test.ts`

Comandos:

```bash
npx vitest run tests/unit/aicfo-plan-render.test.tsx tests/unit/ai-cfo-observability.test.ts
npx vitest run backend/tests/unit/ai-controller-observability.test.ts backend/tests/unit/ai-cfo-route.integration.test.ts
```

Primeiro diagnostico:
- resposta normal deve ter base, confianca e profundidade quando o contrato trouxer esses campos.
- falha de modelo deve retornar diagnostico, `confidence_band: low` e `response_depth: reduced`.
- fallback de IA deve emitir `ai_fallback_observed` para separar falha de modelo de consulta concluida.
- se a IA nao tiver base suficiente, nao transformar fallback em recomendacao financeira.

### Billing e Stripe

Evidencia primaria:
- `src/saas/billingClient.ts`
- `backend/src/routes/saas.ts`
- `backend/src/services/saas/stripeService.ts`
- `backend/src/services/externalIdempotencyStore.ts`
- `tests/unit/billing-client.test.ts`
- `backend/tests/integration/billing.integration.test.ts`
- `backend/tests/unit/stripe-service.test.ts`
- `docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md`

Comandos:

```bash
npx vitest run tests/unit/billing-client.test.ts backend/tests/unit/stripe-service.test.ts backend/tests/unit/external-idempotency-store.test.ts
npx vitest run backend/tests/integration/billing.integration.test.ts
npx playwright test tests/e2e/billing.spec.ts --project=chromium --workers=1
npm run health:stripe-live-smoke
```

Primeiro diagnostico:
- se nao houver `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_MONTHLY` e `STRIPE_WEBHOOK_SECRET`, classificar como gate operacional externo.
- `npm run health:stripe-live-smoke` deve gerar artefato em `test-results/stripe-live-smoke/` mesmo quando o resultado for `BLOCK`.
- o runner agora tambem deve denunciar endpoint Stripe incompatível antes de novo pagamento de teste: URL errada ou eventos minimos ausentes nao podem passar silenciosamente.
- webhook duplicado deve ser bloqueado por event id.
- checkout sem URL precisa erro visivel e evento `billing_checkout_failed`.
- smoke Stripe sandbox nao fecha o gate de lancamento publico; o fechamento exige evidencia real em ambiente alvo.

### Health e deploy Vercel

Evidencia primaria:
- `scripts/verify-vercel-observability.mjs`
- `tests/e2e/performance.spec.ts`
- `docs/PERFORMANCE_BASELINE_2026-06-04.md`
- `docs/VERCEL_CONFIG.md`
- `docs/VERCEL_DEPLOYMENT.md`
- `docs/VERCEL_RECOVERY_CHECKLIST.md`
- `package.json`

Comandos:

```bash
npm run health:vercel
VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app npm run health:vercel
PERF_BASELINE_WRITE=1 npx playwright test tests/e2e/performance.spec.ts --project=chromium --workers=1
npm run health:target-performance -- --target-url https://flow-finance-app.vercel.app
```

Primeiro diagnostico:
- `/` com `404` em backend API-only pode ser esperado.
- `/health`, `/api/health` e `/api/version` precisam responder contrato.
- quando o risco for billing/workspace persistence, o contrato minimo agora inclui `workspacePersistence` nesses endpoints; se o backend published estiver sem store duravel, o status esperado e `unhealthy`, nao sucesso falso.
- se health retornar HTML ou 404, checar alias/projeto Vercel antes de alterar Express.
- baseline de performance local continua em `test-results/performance-baseline/chromium-dashboard.json`; o gate externo foi fechado com evidence real em `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.json`.
- `npm run health:target-performance` continua gerando artefato em `test-results/target-performance-evidence/` para refresh/comparacao quando rerodado.
- consulte [GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md](./GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md) para o criterio de fechamento do launch publico.

## Criterios de fechamento de incidente

- causa-raiz registrada com evidencia.
- teste direcionado verde.
- se aplicavel, runtime web/mobile ou health Vercel verde.
- se envolveu billing, evento externo deduplicado e estado do workspace confirmado.
- se envolveu IA, usuario nunca recebe fallback como decisao certa.
- auditoria/checklist atualizado quando o incidente muda o risco do produto.

## Lacunas assumidas

- SEM EVIDENCIA SUFICIENTE de SLO historico por fluxo.
- Relatorio semanal e evento de ritual existem localmente; a retencao por coorte real foi fechada em 2026-06-05 com os artefatos publicados em `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/report.json`, `test-results/activation-retention-export/2026-06-05T20-20-29-124Z/events.jsonl`, `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json` e `test-results/activation-retention-export/published-export-verified.json`.
- Custo por workspace e custo por resposta IA ainda dependem de evidencia real de provedor/fatura e repeticao em ambiente alvo; a evidencia local atual e apenas estimativa baseada em tokens.
- Gate de performance no alvo fechado com evidencia real em `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.json`; SEM EVIDENCIA SUFICIENTE ainda para carga multi-tenant sintetica em ambiente alvo.
- Em 2026-06-05 o smoke Stripe real ponta a ponta foi fechado no ambiente publicado: checkout hosted pago, eventos reais do Stripe com `pending_webhooks=0`, `currentPlan=pro` no workspace publicado, `hasBillingCustomer=true` e `POST /api/saas/stripe/portal-session` retornando URL valida do portal.
- A causa do ultimo bloqueio antes do fechamento foi especifica: `billingCustomerId` estava sendo salvo pelo caminho sincrono do workspace e a checkout-session nao propagava `subscription_data[metadata][workspaceId]`, entao o webhook `customer.subscription.created` nao religava a assinatura ao workspace no runtime Firebase. Isso foi corrigido no backend publicado.
Gate ja fechado com evidencia:

- [TARGET_PERFORMANCE_EVIDENCE_2026-06-04.md](./TARGET_PERFORMANCE_EVIDENCE_2026-06-04.md)
- baseline de performance repetido no ambiente alvo com PASS real em `test-results/target-performance-evidence/2026-06-04T22-01-40-962Z/report.json`
- [ACTIVATION_RETENTION_EVIDENCE_2026-06-04.md](./ACTIVATION_RETENTION_EVIDENCE_2026-06-04.md)
- activation/retention fechado com PASS real em `test-results/activation-retention-evidence/2026-06-05T20-20-36-828Z-events/report.json`
