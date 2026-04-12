# Runbook Operacional - Linha v0.9.x (Flow Finance)

Data de consolidacao: 2026-04-11  
Escopo: linha v0.9.x com estado atual real da 0.9.6  
Status de release (decisao ja tomada): GO WITH KNOWN LIMITATIONS

## 1) Contexto da linha v0.9.x

Este runbook consolida a referencia operacional unica da linha v0.9.x para evitar leitura fragmentada entre checklist, matrix, review de risco, changelog e resumo de PR.

Fontes consolidadas (obrigatorias):
- `docs/CHANGELOG.md`
- `docs/CHECKLIST_EXECUCAO_PRIORIZADA_v0.7_v0.9_2026-04-11.md`
- `docs/CODE_REALITY_MATRIX_v0.6_to_v0.9_2026-04-11.md`
- `docs/PRODUCTION_RISK_REVIEW_2026-04-11.md`
- `docs/PR_SUMMARY_0.9.6.md`

Diretriz desta consolidacao:
- nao reabrir discussao de release
- registrar apenas o que esta validado nas fontes
- explicitar lacunas quando algo nao estiver documentado

## 2) Estado atual real da 0.9.6

Estado consolidado:
- versao oficial alinhada em `0.9.6` (package e changelog)
- release encerrada como GO WITH KNOWN LIMITATIONS
- simplificacao de UI ciclo 1 entregue (navegacao, dashboard, copy consultiva)
- recorte critico validado operacionalmente

Nucleo validado no recorte critico:
- auth e workspace scope
- billing/admin base e gating principal
- sync com politica de conflito validada
- business integration
- importacao, scanner/OCR e quota no recorte coberto
- lint e cobertura critica aprovados

Observacao importante de estado:
- existe registro documental de dependencia remanescente para matriz E2E cross-browser/device (Firefox, WebKit e mobile viewport). Esta limitacao foi aceita no fechamento 0.9.6.

## 3) Decisoes ja tomadas

Decisoes consolidadas da linha:
- 0.9.6 e a baseline oficial atual da linha v0.9.x.
- release 0.9.6 encerrada como GO WITH KNOWN LIMITATIONS.
- navegacao principal simplificada para nucleo de produto; AI Lab apenas em dev.
- Open Finance/Analytics/Autopilot removidos da barra principal sem delete irreversivel.
- assistente e consultor IA reposicionados para tom consultivo operacional.
- padrao de provider IA alinhado para `Gemini -> OpenAI fallback`.
- politica de conflito de sync validada como `client-updated-at-last-write-wins`.

## 4) Known limitations aceitas

Limitacoes aceitas para 0.9.6:
- matriz E2E cross-browser/device nao consolidada no fechamento (dependencia residual documentada).
- cobertura E2E parcial nesta rodada (com cenarios skipped em parte da trilha).
- billing real completo (sandbox -> producao com operacao comercial full) ainda em rollout controlado, mas o wiring de admin para checkout/portal real ja esta conectado.
- propagacao de gating Free/Pro principal esta reconciliada; residual atual e revisar superficies premium secundarias fora do recorte principal.
- governanca de fonte de verdade documental ainda com pendencia de alinhamento (`AGENTS.md`, roadmap e vault canonico).

## 5) Comandos de validacao obrigatorios

Baseline minima para patch na linha v0.9.x:

```bash
npm run build
npm run lint
npm test
npm run test:coverage:critical
```

Recorte E2E minimo usado na linha:

```bash
npx playwright test tests/e2e/auth.spec.ts --project=chromium --workers=1
npx playwright test tests/e2e/dashboard.spec.ts --project=chromium --workers=1
npx playwright test tests/e2e/billing.spec.ts --project=chromium --workers=1
```

Validacao adicional recomendada para fechamento de novo patch com reducao de risco:
- repetir recorte critico em Firefox e WebKit
- repetir recorte principal em viewport mobile

## 6) Dependencias de ambiente

Dependencias explicitamente evidenciadas nas fontes consolidadas:
- Node.js + npm (execucao de build/lint/test)
- Playwright com matriz executada em Chromium, Firefox, WebKit, Mobile Chrome e Mobile Safari
- configuracao valida de ambiente backend para auth/JWT em producao
- configuracao de providers IA com fallback (`Gemini` primario, `OpenAI` fallback)

Lacunas explicitas (nao presumir):
- versoes exatas de Node/Playwright nao estao consolidadas nessas 5 fontes.
- matriz detalhada de variaveis de ambiente por ambiente (dev/staging/prod) nao esta descrita integralmente nessas 5 fontes.

## 7) Riscos residuais

Risco agregado atual para a linha: MEDIO.

Classificacao consolidada:
- Auth: Medio
- Quota IA: Baixo-Medio
- Prioridade de provider IA: Baixo-Medio
- Categorizacao IA: Baixo-Medio
- Sync conflitos: Medio
- Billing real: Medio
- Governanca documental/source-of-truth: Baixo-Medio

Riscos operacionais relevantes:
- regressao em fluxo auth/session entre modos de execucao
- ausencia de evidencia consolidada de stress concorrente de sync em ambiente alvo
- diferenca entre readiness tecnico de billing e operacao comercial end-to-end
- risco de contexto incorreto por documentacao dispersa

## 8) Criterios objetivos para nova entrega/patch

Um patch na linha v0.9.x so deve ser marcado como GO quando:

1. escopo da mudanca estiver delimitado e rastreavel em docs
2. `npm run build` estiver verde
3. `npm run lint` estiver verde
4. `npm test` estiver verde
5. `npm run test:coverage:critical` estiver verde
6. recorte E2E minimo (auth/dashboard/billing em Chromium) estiver verde ou com skip justificado e registrado
7. riscos residuais novos estiverem explicitados e classificados
8. decisao final estiver registrada como `GO` ou `GO WITH KNOWN LIMITATIONS`

Criterio de NO-GO:
- falha em qualquer gate obrigatorio sem mitigacao validada e sem decisao formal documentada.

## 9) Backlog pos-release resumido

Backlog operacional consolidado (resumo):
- consolidar matriz E2E cross-browser/device (Chromium, Firefox, WebKit, mobile viewport)
- validar trilha completa de checkout/webhook/portal em ambiente alvo
- revisar observabilidade minima (requestId, routeScope, erros de integracao)
- congelar contratos HTTP sensiveis (auth, sync, finance/metrics, saas)
- manter validacao de cobertura critica em todo merge candidate
- revisar se existe alguma superficie premium secundaria ainda fora do contrato principal de gating
- corrigir fonte de verdade documental (AGENTS/roadmap/vault canonico)

## Referencias de auditoria

Este arquivo substitui a leitura fragmentada como fonte operacional unica da linha v0.9.x.

Se houver divergencia futura entre documentos, este runbook deve ser atualizado primeiro e os demais devem apenas referenciar esta fonte.
