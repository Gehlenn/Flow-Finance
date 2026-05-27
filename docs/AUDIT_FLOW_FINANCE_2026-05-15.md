# Auditoria SÃªnior Flow Finance â€” 2026-05-15

## Papel deste documento

Auditoria multidisciplinar (produto, engenharia, seguranÃ§a, UX, SaaS) realizada em `2026-05-15` contra `package.json` versÃ£o `0.9.7`, cÃ³digo vivo do repo e documentaÃ§Ã£o canÃ´nica em `obsidian-vault/Projetos/Core/`.

Tom: tÃ©cnico, direto, crÃ­tico. Sem suavizaÃ§Ã£o.

Fontes de verdade lidas:

- `AGENTS.md` (raiz do repo)
- `obsidian-vault/Projetos/Core/Project Rules.md`
- `obsidian-vault/Projetos/Core/Product Plan.md`
- `obsidian-vault/Projetos/Core/Code Tasks.md`
- `obsidian-vault/Projetos/Core/Project Stack Guide.md`
- `obsidian-vault/Projetos/Planning/30-Day Plan.md`
- `README.md`, `ROADMAP.md`, `docs/CHANGELOG.md`, `docs/DEPLOYMENT_STATUS.md`
- `docs/UI_UX_BASELINE_AUDIT_2026-05-12.md`
- `docs/UI_UX_REFORM_PLAN_2026-05-12.md`
- `docs/UI_VALIDATION_REPORT_2026-05-13.md`
- `docs/SECURITY_AUDIT_2026-05-03.md`
- `firestore.rules`
- `backend/src/index.ts`, `backend/src/config/env.ts`, `backend/src/auth/authService.ts`, `backend/src/middleware/auth.ts`
- `App.tsx`, `src/app/mainNavigation.ts`
- `components/Dashboard.tsx`, `components/CashFlow.tsx`, `components/TransactionList.tsx`
- `pages/AICFO.tsx`, `pages/Autopilot.tsx`, `pages/OpenBanking.tsx`, `pages/ReceiptScanner.tsx`
- `services/firebase.ts`, `services/geminiService.ts`
- `src/config/api.config.ts`
- `src/security/moneyMath.ts`, `src/security/auditLogService.ts`
- `src/ai/aiOrchestrator.ts`
- `.env.example`, `.gitignore`

Plano de execuÃ§Ã£o derivado: `docs/PLANO_ACAO_AUDITORIA_2026-05-15.md`.

---

## 1. Veredito executivo

O Flow Finance Ã© um projeto operacionalmente sÃ©rio com base tÃ©cnica acima da mÃ©dia (Firestore rules razoavelmente densas, JWT hardening, refresh token rotation, Helmet, CORS allowlist, 218 testes unitÃ¡rios, cobertura crÃ­tica em 99% e auditoria de seguranÃ§a recente com 4 fixes documentados). Em paralelo, Ã© um projeto estrategicamente desfocado: o repositÃ³rio carrega Open Banking (Pluggy), AI CFO conversacional, Financial Autopilot, Receipt Scanner com OCR e PDF parse, integraÃ§Ã£o de clÃ­nica como rota de primeiro nÃ­vel no backend, e um pipeline AI de 21 arquivos rodando no cliente. Tudo o que o `Product Plan.md` diz que NÃƒO Ã© o eixo do produto.

A maior fraqueza Ã© integridade financeira frÃ¡gil. A soma de saldos do Dashboard, do CashFlow e da lista de transaÃ§Ãµes usa float JS cru. `moneyMath` existe mas Ã© usado quase sÃ³ em `reportEngine`.

O maior risco Ã© dupla quebra de confianÃ§a: produÃ§Ã£o fora do ar (backend Vercel devolve 404 em `/health`, `/api/health`, `/api/version` desde 2026-04 e ainda em 2026-05-08 segundo `docs/DEPLOYMENT_STATUS.md`) e auditoria de fachada no frontend (`auditLogService.ts` grava em array em memÃ³ria).

A maior oportunidade Ã© cortar 30-40% da superfÃ­cie do produto e do AI engine para alinhar com o que estÃ¡ escrito no `Product Plan.md`.

NÃ£o estÃ¡ pronto para validaÃ§Ã£o com cliente real pagante. EstÃ¡ pronto para piloto privado com clÃ­nica, com avisos.

## 2. Tabela de notas

| Quesito | Nota 0-10 | Status | Principal problema | Prioridade |
|---|---:|---|---|---|
| 1. Produto / posicionamento | 4 | desalinhado | CÃ³digo contradiz `Product Plan.md` (AI CFO, Autopilot, Open Banking, Receipt Scanner) | P1 |
| 2. Utilidade real p/ serviÃ§o | 5 | parcial | "Receita prevista" derivada de `Reminder` Ã© frÃ¡gil; faltam recebÃ­veis formais | P1 |
| 3. Arquitetura geral | 6 | aceitÃ¡vel | Camadas certas (front, backend proxy, Firebase, Stripe), mas 4+ integraÃ§Ãµes inativas | P2 |
| 4. Estrutura do projeto | 4 | confusa | `src/` duplica responsabilidades com `components/`, `pages/`, `services/`, `hooks/`, `utils/`, `models/` em paralelo | P2 |
| 5. Backend | 6 | aceitÃ¡vel | Bom uso de Express/Helmet, mas escopo heavy clinic/business/external integration | P1 |
| 6. Banco / modelo de dados | 5 | fraco | Receita prevista, recebÃ­vel, lembrete, transaÃ§Ã£o misturados sem schema canÃ´nico | P1 |
| 7. SeguranÃ§a | 7 | bom | Auditoria recente fechou 4 issues; ainda hÃ¡ resÃ­duos (audit log em memÃ³ria, stubs auth) | P1 |
| 8. Vazamento de dados | 7 | bom | Backend proxy correto p/ Gemini; query params removidos do log; XSS escapado | P2 |
| 9. Auth / authz / multi-tenant | 7 | bom | Rules densas; refresh tokens; stubs dev presentes (guardas em produÃ§Ã£o) | P1 |
| 10. Firestore rules | 7 | bom | Boa estrutura, mas `tenant_members read` Ã© generosa; sem rate-limit declarado | P2 |
| 11. Frontend | 5 | aceitÃ¡vel | InconsistÃªncia visual reconhecida (baseline 14/24), 30% melhorada | P2 |
| 12. Mobile / responsivo | 6 | aceitÃ¡vel | Capacitor presente; falta evidÃªncia de QA real em iOS | P2 |
| 13. Design visual | 5 | fraco | Excesso de gradientes, font-black, microtipografia text-[7px] | P2 |
| 14. UI / hierarquia | 5 | fraco | CTA primÃ¡rio e densidade variando entre telas | P2 |
| 15. UX / jornada | 5 | fraco | 5 tabs ok, mas Consultor IA, Insights e Fluxo competem entre si | P1 |
| 16. Dashboard | 5 | fraco | Float JS direto nos cÃ¡lculos de saldo; texto consultivo bom mas dado frÃ¡gil | **P0** |
| 17. TransaÃ§Ãµes / fluxo de caixa | 5 | aceitÃ¡vel | Sem reconciliaÃ§Ã£o real, sem conciliaÃ§Ã£o bancÃ¡ria declarada | P1 |
| 18. Receita prevista vs realizada | 4 | fraca | Modelo duplo (Reminder em Dashboard, status em CashFlow) | P1 |
| 19. IA consultiva | 4 | desalinhada | Promessa "consultiva" + cÃ³digo "autopilot/orchestrator/autonomous" | P1 |
| 20. Bugs provÃ¡veis | 5 | risco | Race conditions sync, Sentry duplo, lucide-react@1.8 errado | P1 |
| 21. Testes / QA | 7 | bom | 218 unit + 12 e2e + critical 99.5%, mas peso em AI; baixo em integridade $ | P2 |
| 22. Observabilidade | 6 | aceitÃ¡vel | Endpoints contratados, Sentry no cÃ³digo, mas DSN ausente no destino | P1 |
| 23. Performance | 5 | fraco | Bundle pesado (tesseract.js + pdf-parse + recharts + 2 Sentrys + 2 Geminis) | P2 |
| 24. Acessibilidade | 4 | fraco | Sem teste a11y; microtipografia ruim; contraste com gradientes | P2 |
| 25. Developer experience | 6 | aceitÃ¡vel | Scripts numerosos, mas com 3 logs de backend dev acumulados na raiz | P3 |
| 26. DocumentaÃ§Ã£o | 7 | boa | Vault + docs/ + repo; mas com "registro histÃ³rico" 0.9.6 vs cÃ³digo 0.9.7 | P2 |
| 27. ComercializaÃ§Ã£o / rentabilidade | 4 | fraco | Stripe sandbox ok local; sem pricing claro, sem paywall claro | P1 |
| 28. ProntidÃ£o p/ validaÃ§Ã£o real | 3 | crÃ­tico | Backend Vercel fora do ar (404 health endpoints) | **P0** |
| 29. Riscos estratÃ©gicos | 4 | alto | Escopo, supply chain de OCR/PDF, dependÃªncia de Pluggy | P1 |
| 30. PrÃ³ximas prioridades | â€” | â€” | Definidas no plano de aÃ§Ã£o | â€” |

MÃ©dia ponderada: 5.4 / 10.

---

## 3. Achados crÃ­ticos (P0 + P1)

### P0-01 â€” Backend de produÃ§Ã£o fora do contrato de API

EvidÃªncia:

- `docs/DEPLOYMENT_STATUS.md` documenta o estado operacional do backend publicado.
- `README.md:12` confirma o bloqueio como remanescente.
- VersÃ£o `0.9.7` no `package.json`; doc fala em `0.9.6.1v` como registro histÃ³rico.

Impacto:

- Sem backend, a IA nÃ£o responde, o billing nÃ£o fecha o ciclo end-to-end, o sync nÃ£o persiste, o login Firebaseâ†’sessÃ£o nÃ£o troca tokens.
- O frontend "funciona" mas Ã© uma vitrine vazia. Validar com cliente queima credibilidade.

RecomendaÃ§Ã£o:

- Corrigir root directory do projeto Vercel do backend (apontar para `backend/`, nÃ£o para a raiz do repo).
- Validar via `npm run health:vercel` com `VERCEL_TARGET_URL`.
- Bloquear deploy se health falhar.

EsforÃ§o: 0.5 dia.

Risco se ignorar: validaÃ§Ã£o impossÃ­vel, cobranÃ§a impossÃ­vel, confianÃ§a financeira impossÃ­vel.

### P0-02 â€” CÃ¡lculos financeiros usando float JavaScript no Dashboard, CashFlow e listas

EvidÃªncia:

- `components/Dashboard.tsx:99` â€” `accounts.reduce((sum, account) => sum + account.balance, 0)`.
- `components/Dashboard.tsx:104,107,112,115,182,184` â€” somas diretas.
- `components/CashFlow.tsx:115-125` â€” `summary.pending += transaction.amount`.
- `src/security/moneyMath.ts` existe mas sÃ³ `src/finance/reportEngine.ts` importa (grep confirmado).

Impacto:

- Em produto financeiro, `0.1 + 0.2 = 0.30000000000000004` Ã© inaceitÃ¡vel.
- DiferenÃ§as entre "Saldo" e "Soma de transaÃ§Ãµes" vÃ£o aparecer em ambientes reais com volume.
- Quebra a regra explÃ­cita do `Project Rules.md`: integridade e rastreabilidade antes de velocidade.

RecomendaÃ§Ã£o:

- Tornar `moneyMath.ts` o Ãºnico caminho para operaÃ§Ãµes monetÃ¡rias no frontend.
- Aumentar `Decimal.set({ precision: 28 })`.
- Adicionar teste de invariante: "soma de N lembretes via floats vs decimais Ã© idÃªntica centavo a centavo".

EsforÃ§o: 1-2 dias para refactor mais 0.5 dia para testes.

Risco se ignorar: erro silencioso de centavos; cliente perde confianÃ§a no nÃºmero do saldo.

### P0-03 â€” Audit log do frontend sÃ³ em memÃ³ria

EvidÃªncia:

- `src/security/auditLogService.ts:18` â€” `const auditLogs: AuditLogEntry[] = [];`.
- Nunca persiste.
- `firestore.rules:261-274` cria a coleÃ§Ã£o `audit_logs/{tenantId}/events/{eventId}` com `allow update, delete: if false` (tamper-evident), mas o frontend nunca escreve nela.

Impacto:

- Promessa de auditabilidade sÃ³ no schema, nÃ£o no comportamento.
- Falsa sensaÃ§Ã£o de rastreabilidade para um produto financeiro.

RecomendaÃ§Ã£o:

- Substituir `auditLogs.push(entry)` por escrita em Firestore em `audit_logs/{tenantId}/events`.
- Manter array em memÃ³ria apenas como cache opcional.
- Cobrir com teste de rules.

EsforÃ§o: 0.5 dia.

Risco se ignorar: defesa jurÃ­dica enfraquecida em incidente; falha de conformidade.

### P1-01 â€” Escopo do produto contradiz o `Product Plan.md`

EvidÃªncia:

- `Product Plan.md` diz NÃƒO super-app, NÃƒO Open Finance como eixo, NÃƒO "CFO autÃ´nomo".
- CÃ³digo atual:
  - `pages/AICFO.tsx`, `pages/Autopilot.tsx`, `pages/OpenBanking.tsx`, `pages/ReceiptScanner.tsx` presentes.
  - `src/ai/financialAutopilot.ts`, `src/ai/aiCFO.ts`, `src/ai/aiOrchestrator.ts` pipeline completo.
  - Backend `bankingRoutes` (com `featureGateOpenFinance`), `clinicIntegrationRoutes`, `businessIntegrationRoutes`, `externalIntegrationRoutes`.
  - `package.json` lista `react-pluggy-connect`, `tesseract.js`, `pdf-parse`, `@google/genai`, `@google/generative-ai` como dependÃªncias (nÃ£o devDependencies).
  - `.env.example:105` â€” `VITE_FEATURE_AUTOPILOT=true` por padrÃ£o.

Impacto:

- Bundle inflado, complexidade cognitiva alta, manutenÃ§Ã£o pesada, mensagem confusa para o cliente.
- Custo de IA inflado por funcionalidades fora do eixo.
- Reforma de UI ficou cosmÃ©tica: a casa por trÃ¡s continua igual.

RecomendaÃ§Ã£o:

- Cortar com bisturi as 4 pÃ¡ginas legadas (mover para `pages/legacy/` ou deletar).
- Remover `react-pluggy-connect`, `tesseract.js`, `pdf-parse`, `@google/genai`.
- Apagar `src/ai/financialAutopilot.ts` e dependÃªncias.
- Reduzir `src/ai/` de 21 arquivos para ~5.
- Pluggy continua sÃ³ atrÃ¡s de feature flag default off.

EsforÃ§o: 2-3 dias.

Risco se ignorar: projeto nÃ£o se explica em uma frase; cliente novo confunde.

### P1-02 â€” "Receita prevista" tem dois modelos competindo

EvidÃªncia:

- `Dashboard.tsx:109-117` constrÃ³i `projectedRevenueMonth` somando `reminders` com `amount > 0` e `!completed`.
- `CashFlow.tsx:90-133` constrÃ³i o mesmo conceito derivando `status` de `transaction.generated` + `transaction.date`.
- NÃ£o existe entidade canÃ´nica de "RecebÃ­vel".

Impacto:

- Dois nÃºmeros diferentes para a mesma pergunta dependendo da tela.
- O eixo central declarado no `Product Plan.md` (receita prevista + receita realizada) nÃ£o tem dado canÃ´nico.

RecomendaÃ§Ã£o:

- Definir modelo `Receivable` com campos: `id`, `workspace_id`, `tenant_id`, `due_date`, `expected_amount`, `realized_amount`, `source`, `status`.
- Migrar `Reminder` financeiro e `transaction.generated` para alimentar esse modelo.
- Dashboard e CashFlow leem do mesmo agregado.
- Teste invariante: "soma de Receivables.open == projetado no Dashboard == pendente no CashFlow".

EsforÃ§o: 3-4 dias.

Risco se ignorar: toda decisÃ£o consultiva da IA fica em cima de dado inconsistente.

### P1-03 â€” IA "consultiva" embalada como "autÃ´noma"

EvidÃªncia:

- `src/ai/aiOrchestrator.ts:36` importa `runFinancialAutopilot`.
- `src/ai/financialAutopilot.ts` produz `AutopilotAction`.
- `pages/AICFO.tsx` mostra `Consultor IA` (rÃ³tulo simpÃ¡tico) mas chama `runAIPipelineSync` que executa 6 camadas client-side.
- 21 arquivos em `src/ai/`.

Impacto:

- Promessa quebrada: a IA nÃ£o Ã© IA, Ã© regras client-side.
- Sob rÃ³tulo "Autopilot".
- Risco reputacional mÃ©dio em demos sofisticadas.

RecomendaÃ§Ã£o:

- Renomear `financialAutopilot` para `signalEngine`.
- Reduzir pipeline de 6 camadas para 3 (Financial Engine + Risk + Insight).
- Qualquer decisÃ£o real fica fora â€” sÃ³ sinaliza.

EsforÃ§o: 1-2 dias.

Risco se ignorar: demo do produto mostra "Autopilot" no cÃ³digo; cliente sofisticado descobre.

### P1-04 â€” Stubs de auth presentes com guardas sÃ³ de `NODE_ENV`

EvidÃªncia:

- `backend/src/auth/authService.ts:7-11`:

  ```ts
  if (process.env.NODE_ENV === 'production') throw new Error('...');
  return { id: `usr_${Buffer.from(username).toString('base64').slice(0, 12)}`, ... };
  ```
- `backend/src/middleware/auth.ts:64-72` aceita `mock-token-for-` se `NODE_ENV === 'test'`.

Impacto:

- Se um deploy for promovido com `NODE_ENV` ausente ou setado para staging/development por engano, o login local fictÃ­cio passa.
- ConfiguraÃ§Ã£o-zumbi que mata fintech.

RecomendaÃ§Ã£o:

- Remover a stub.
- Se precisar de dev login, isolar em arquivo carregado por dynamic import condicional sÃ³ no startup local.
- Trocar check de NODE_ENV por allowlist explÃ­cita (`AUTH_DEV_BYPASS_TOKEN`) com log "INSECURE DEV LOGIN ACTIVE" no boot.

EsforÃ§o: 0.5 dia.

Risco se ignorar: auth bypass por configuraÃ§Ã£o errada.

### P1-05 â€” `lucide-react@1.8.0` e Sentry com dois majors

EvidÃªncia:

- `package.json:70`: `"lucide-react": "1.8.0"`.
- A linha de release legÃ­tima de `lucide-react` estÃ¡ em `0.4xx`. A versÃ£o `1.8.0` nÃ£o existe no npm canÃ´nico â€” provÃ¡vel typosquat ou pacote diferente.
- `@sentry/react@10.47.0` + `@sentry/tracing@7.120.4` â€” APIs incompatÃ­veis entre majors 7 e 10.

Impacto:

- Risco de supply chain alto se `lucide-react@1.8.0` for typosquat.
- Sentry duplo: traces da v7 nÃ£o conectam com transport da v10. Observabilidade comprometida silenciosamente.

RecomendaÃ§Ã£o:

- Verificar publisher e provenance em `package-lock.json`.
- Trocar para `lucide-react@^0.x` legÃ­timo.
- Migrar Sentry para v10 e remover `@sentry/tracing@7`.

EsforÃ§o: 0.5 dia.

Risco se ignorar: comprometimento de build ou ruÃ­do crÃ´nico de Sentry.

### P1-06 â€” Backend trafega 4 modelos de integraÃ§Ã£o em paralelo

EvidÃªncia:

- `backend/src/index.ts:351-359` registra `/api/integrations/external`, `/api/integrations/keys`, `/api/integrations`, `/api/integrations/clinic`.
- Mais `bankingRoutes` (Pluggy).
- Middlewares prÃ³prios: `clinicAudit`, `clinicPayloadLimit`, `businessIntegrationContract`, `integrationBindingScope`, `externalIntegrationAuth`.

Impacto:

- Cada vetor Ã© uma surface de risco (HMAC, idempotÃªncia, quota).
- ManutenÃ§Ã£o quadruplicada.
- A regra "preservar fronteiras SaaS" do `Project Rules.md` estÃ¡ sendo multiplicada, nÃ£o preservada.

RecomendaÃ§Ã£o:

- Definir um contrato Ãºnico de integraÃ§Ã£o externa (`/api/integrations/{provider}` com HMAC + idempotency-key + workspace binding).
- Mover clinic e business para serem providers desse contrato, nÃ£o rotas separadas.
- Bloquear por feature flag atÃ© existir cliente real.

EsforÃ§o: 2-3 dias.

Risco se ignorar: dÃ­vida de manutenÃ§Ã£o e auditoria.

### P1-07 â€” `.env.example` contradiz defaults reais do backend

EvidÃªncia:

- `.env.example:105` â€” `VITE_FEATURE_AUTOPILOT=true`.
- `.env.example:120-122` â€” `VITE_FEATURE_OPEN_BANKING=true`, `VITE_FEATURE_RECEIPT_SCANNER=true`, `VITE_FEATURE_AI_CFO=true`.
- `backend/src/config/env.ts:102` â€” `FEATURE_OPEN_FINANCE=false` (default).

Impacto:

- Devs que copiam o exemplo ligam features que o backend nÃ£o suporta por padrÃ£o.
- Ambiente inconsistente; decisÃµes de produto contraditas pela documentaÃ§Ã£o de setup.

RecomendaÃ§Ã£o:

- Default todas as features fora do eixo para `false`.
- ComentÃ¡rio inline: "ative sÃ³ para experimentaÃ§Ã£o".

EsforÃ§o: 5 minutos.

Risco se ignorar: confusÃ£o crÃ´nica entre devs.

### P1-08 â€” Sentry sem DSN no destino e dois inits

EvidÃªncia:

- `App.tsx:39` chama `initSentry()`; backend faz o mesmo.
- `docs/DEPLOYMENT_STATUS.md` agora trata `VITE_SENTRY_DSN`/`SENTRY_DSN` como provisionados em producao.
- Resultado: o risco principal deixou de ser `env ausente` e passou a ser `evidencia final de observabilidade nao consolidada`.

Impacto:

- Falhas em produÃ§Ã£o invisÃ­veis.
- Para um sistema financeiro, bug silencioso pode passar dias sem detecÃ§Ã£o.

RecomendaÃ§Ã£o:

- Configurar DSN no Vercel.
- Bloquear deploy se DSN ausente em `NODE_ENV=production`.
- Remover `@sentry/tracing@7`.

EsforÃ§o: 0.5 dia.

Risco se ignorar: bugs em produÃ§Ã£o sem rastreio.

---

## 4. Bugs e riscos provÃ¡veis (catÃ¡logo)

### Funcionais

- **B-F-01 (P0)** Soma de saldos com float em Dashboard, CashFlow, lista.
- **B-F-02 (P1)** Receita prevista diverge entre Dashboard (Reminders) e CashFlow (`transaction.generated`).
- **B-F-03 (P1)** `Dashboard.tsx:113-115` soma `overdueRevenueAmount` sem filtro de mÃªs, mas `pendingRevenueMonth` filtra por mÃªs. `projectedRevenueMonth = pendingRevenueMonth + overdueRevenueAmount` mistura escopos temporais.
- **B-F-04 (P2)** `CashFlow.tsx:194` usa `JSON.stringify(transactions.map(t => t.id + t.amount))` como assinatura. ConcatenaÃ§Ã£o string+number causa colisÃµes.
- **B-F-05 (P2)** Workspace recovery em `api.config.ts:329-341` escolhe o primeiro workspace silenciosamente. UsuÃ¡rio multi-workspace pode abrir o errado.

### Visuais

- **B-V-01 (P2)** `text-[7px]` documentado no baseline; ainda parcialmente presente.
- **B-V-02 (P2)** Gradiente do FAB pode conflitar com gradiente da nav inferior em mobile.
- **B-V-03 (P2)** Status pill com `z-index: 100` pode ficar atrÃ¡s de modais em iOS Safari.

### Dados

- **B-D-01 (P0)** Float drift nos agregados.
- **B-D-02 (P1)** Mistura de timezones: `new Date(transaction.date)` sem normalizaÃ§Ã£o TZ; clientes em fuso diferente verÃ£o data errada.
- **B-D-03 (P1)** Audit log perdido a cada reload.

### SeguranÃ§a

- **B-S-01 (P1)** Stubs de auth (P1-04).
- **B-S-02 (P1)** `lucide-react@1.8.0` suspeito.
- **B-S-03 (P2)** `firestore.rules` para `tenant_members` permite read se `canManageWorkspace(workspaceId)` â€” verificar se admin de workspace A enxerga membros de workspace B do mesmo tenant.
- **B-S-04 (P2)** `helmet()` sem CSP customizado.

### ExperiÃªncia

- **B-X-01 (P1)** Backend 404 em produÃ§Ã£o: login Firebase nÃ£o troca por sessÃ£o real; app cai em fallback silencioso.
- **B-X-02 (P2)** `NamePromptModal` aparece sem onboarding â€” usuÃ¡rio leigo abandona.
- **B-X-03 (P2)** Falha de cloudSync desativa `cloudSyncEnabled` silenciosamente sem notificar.

### Mobile

- **B-M-01 (P2)** `resources:generate` removido por supply chain â€” build mobile nÃ£o reprodutÃ­vel sem intervenÃ§Ã£o manual.
- **B-M-02 (P2)** Sem evidÃªncia de QA real em iOS Safari mobile.

---

## 5. Alinhamento com o rumo do produto

| Eixo declarado | Estado no cÃ³digo | Alinhado? |
|---|---|---|
| Fluxo de caixa | `CashFlow.tsx` agrega entradas e saÃ­das | Parcial (falta moneyMath consistente) |
| Empresas de serviÃ§o | Sem nada specific-by-design; clinic-specific embutido no backend | NÃ£o |
| Receita prevista vs realizada | Dois modelos competindo (Reminder vs `transaction.status`) | NÃ£o |
| OperaÃ§Ã£o â†” financeiro | Endpoints `/api/integrations/clinic` e `/api/integrations` existem, mas isolados do dashboard | Parcial |
| IA consultiva | Promessa correta; cÃ³digo entrega "autopilot/orchestrator" | NÃ£o |
| Simplicidade | Nav reformada (sim); cÃ³digo (nÃ£o, escopo inflado) | Parcial |
| Confiabilidade financeira | Decimal.js existe, mal usado | NÃ£o |
| MonetizaÃ§Ã£o | Backend pronto, fluxo de usuÃ¡rio nÃ£o | Parcial |

Competindo com o foco:

- `pages/OpenBanking.tsx` + `react-pluggy-connect`.
- `pages/AICFO.tsx` chamando `runAIPipelineSync` de 6 camadas.
- `pages/Autopilot.tsx` + `financialAutopilot.ts`.
- `pages/ReceiptScanner.tsx` + `tesseract.js` + `pdf-parse`.
- Backend `clinicIntegrationRoutes`, `businessIntegrationRoutes`, `externalIntegrationRoutes`, `integrationKeyRoutes`.

Veredito: produto declarado Ã© "simples e Ãºtil"; cÃ³digo entregue Ã© "denso e ambicioso". DivergÃªncia crÃ´nica.

---

## 6. DecisÃµes difÃ­ceis evitadas pelo projeto

1. **Cortar AICFO e Autopilot.** Filho preferido; manter atrasa o produto real.
2. **Aceitar que clÃ­nica Ã© vertical, nÃ£o horizontal.** Backend jÃ¡ tem clinic-specific routes. Ou vira clinic-only ou apaga.
3. **Open Finance Ã© distraÃ§Ã£o atÃ© PMF.** Pluggy custa ~R$1k/mÃªs (comentÃ¡rio no `env.ts`); luxo prÃ©-receita.
4. **Backend Vercel quebrado por 30+ dias.** Deveria ter sido P0 absoluto hÃ¡ um mÃªs. Reformar UI enquanto API estÃ¡ em 404 Ã© prioridade trocada.
5. **Cobrar pelo quÃª.** Sem paywall, billing virou infraestrutura sem ROI.
6. **Promessa de IA vs heurÃ­stica client-side.** Renomear ou implementar de verdade backend-side com LLM no loop.
7. **"Web e mobile primeira classe"** com `resources:generate` removido â€” mobile nÃ£o tem build reprodutÃ­vel.
8. **Dois Sentrys, dois SDKs Gemini, dois bancos (Firestore + Postgres backend).** Custo de manter ambas as escolhas; escolher uma de cada.

---

## 7. Nota final

Flow Finance hoje: **5.4 / 10**.

Por que essa nota:

- Engenharia tem rigor (testes, rules, seguranÃ§a auditada, refresh tokens, rate limit) â€” puxa para cima.
- Produto estÃ¡ desfocado (escopo inflado, IA performativa, dados financeiros frÃ¡geis) â€” puxa para baixo.
- Ambiente alvo de produÃ§Ã£o quebrado hÃ¡ 30+ dias bloqueia validaÃ§Ã£o real.

O que faria subir 2 pontos (para ~7.5):

1. Backend Vercel respondendo o contrato.
2. moneyMath em 100% dos agregados.
3. Audit log persistido em Firestore.
4. 4 pÃ¡ginas legadas cortadas do bundle.
5. Modelo canÃ´nico de Receivable substituindo o Reminder-financeiro.

O que impediria de validar:

- Backend Vercel em 404 (impossÃ­vel).
- Saldos com erro de centavos.
- Audit log fake.
- Promessa de "Autopilot" sem entregar.

PrÃ³xima aÃ§Ã£o mais importante: fechar o backend de produÃ§Ã£o (P0-01). Antes disso, qualquer outro trabalho Ã© desperdÃ­cio.

---

## 8. Limites desta auditoria

- Foi feita sÃ³ lendo repositÃ³rio, docs e config.
- NÃ£o rodei lint, testes nem subi o app.
- A nota Ã© baseada em evidÃªncia de cÃ³digo.
- Confirmar P0-01 e P0-02 com execuÃ§Ã£o real antes de agir.

Plano de execuÃ§Ã£o detalhado: `docs/PLANO_ACAO_AUDITORIA_2026-05-15.md`.

