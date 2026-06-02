�# Auditoria Sênior Flow Finance � 2026-05-15

## Papel deste documento

Auditoria multidisciplinar (produto, engenharia, segurança, UX, SaaS) realizada em `2026-05-15` contra `package.json` versão `0.9.7`, código vivo do repo e documentação canônica em `obsidian-vault/Projetos/Core/`.

Tom: técnico, direto, crítico. Sem suavização.

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

Plano de execução derivado: `docs/PLANO_ACAO_AUDITORIA_2026-05-15.md`.

---

## 1. Veredito executivo

O Flow Finance é um projeto operacionalmente sério com base técnica acima da média (Firestore rules razoavelmente densas, JWT hardening, refresh token rotation, Helmet, CORS allowlist, 218 testes unitários, cobertura crítica em 99% e auditoria de segurança recente com 4 fixes documentados). Em paralelo, é um projeto estrategicamente desfocado: o repositório carrega Open Banking (Pluggy), AI CFO conversacional, Financial Autopilot, Receipt Scanner com OCR e PDF parse, integração de clínica como rota de primeiro nível no backend, e um pipeline AI de 21 arquivos rodando no cliente. Tudo o que o `Product Plan.md` diz que NÒO é o eixo do produto.

A maior fraqueza é integridade financeira frágil. A soma de saldos do Dashboard, do CashFlow e da lista de transações usa float JS cru. `moneyMath` existe mas é usado quase só em `reportEngine`.

O maior risco é dupla quebra de confiança: produção fora do ar (backend Vercel devolve 404 em `/health`, `/api/health`, `/api/version` desde 2026-04 e ainda em 2026-05-08 segundo `docs/DEPLOYMENT_STATUS.md`) e auditoria de fachada no frontend (`auditLogService.ts` grava em array em memória).

A maior oportunidade é cortar 30-40% da superfície do produto e do AI engine para alinhar com o que está escrito no `Product Plan.md`.

Não está pronto para validação com cliente real pagante. Está pronto para piloto privado com clínica, com avisos.

## 2. Tabela de notas

| Quesito | Nota 0-10 | Status | Principal problema | Prioridade |
|---|---:|---|---|---|
| 1. Produto / posicionamento | 4 | desalinhado | Código contradiz `Product Plan.md` (AI CFO, Autopilot, Open Banking, Receipt Scanner) | P1 |
| 2. Utilidade real p/ serviço | 5 | parcial | "Receita prevista" derivada de `Reminder` é frágil; faltam recebíveis formais | P1 |
| 3. Arquitetura geral | 6 | aceitável | Camadas certas (front, backend proxy, Firebase, Stripe), mas 4+ integrações inativas | P2 |
| 4. Estrutura do projeto | 4 | confusa | `src/` duplica responsabilidades com `components/`, `pages/`, `services/`, `hooks/`, `utils/`, `models/` em paralelo | P2 |
| 5. Backend | 6 | aceitável | Bom uso de Express/Helmet, mas escopo heavy clinic/business/external integration | P1 |
| 6. Banco / modelo de dados | 5 | fraco | Receita prevista, recebível, lembrete, transação misturados sem schema canônico | P1 |
| 7. Segurança | 7 | bom | Auditoria recente fechou 4 issues; ainda há resíduos (audit log em memória, stubs auth) | P1 |
| 8. Vazamento de dados | 7 | bom | Backend proxy correto p/ Gemini; query params removidos do log; XSS escapado | P2 |
| 9. Auth / authz / multi-tenant | 7 | bom | Rules densas; refresh tokens; stubs dev presentes (guardas em produção) | P1 |
| 10. Firestore rules | 7 | bom | Boa estrutura, mas `tenant_members read` é generosa; sem rate-limit declarado | P2 |
| 11. Frontend | 5 | aceitável | Inconsistência visual reconhecida (baseline 14/24), 30% melhorada | P2 |
| 12. Mobile / responsivo | 6 | aceitável | Capacitor presente; falta evidência de QA real em iOS | P2 |
| 13. Design visual | 5 | fraco | Excesso de gradientes, font-black, microtipografia text-[7px] | P2 |
| 14. UI / hierarquia | 5 | fraco | CTA primário e densidade variando entre telas | P2 |
| 15. UX / jornada | 5 | fraco | 5 tabs ok, mas Consultor IA, Insights e Fluxo competem entre si | P1 |
| 16. Dashboard | 5 | fraco | Float JS direto nos cálculos de saldo; texto consultivo bom mas dado frágil | **P0** |
| 17. Transações / fluxo de caixa | 5 | aceitável | Sem reconciliação real, sem conciliação bancária declarada | P1 |
| 18. Receita prevista vs realizada | 4 | fraca | Modelo duplo (Reminder em Dashboard, status em CashFlow) | P1 |
| 19. IA consultiva | 4 | desalinhada | Promessa "consultiva" + código "autopilot/orchestrator/autonomous" | P1 |
| 20. Bugs prováveis | 5 | risco | Race conditions sync, Sentry duplo, lucide-react@1.8 errado | P1 |
| 21. Testes / QA | 7 | bom | 218 unit + 12 e2e + critical 99.5%, mas peso em AI; baixo em integridade $ | P2 |
| 22. Observabilidade | 6 | aceitável | Endpoints contratados, Sentry no código, mas DSN ausente no destino | P1 |
| 23. Performance | 5 | fraco | Bundle pesado (tesseract.js + pdf-parse + recharts + 2 Sentrys + 2 Geminis) | P2 |
| 24. Acessibilidade | 4 | fraco | Sem teste a11y; microtipografia ruim; contraste com gradientes | P2 |
| 25. Developer experience | 6 | aceitável | Scripts numerosos, mas com 3 logs de backend dev acumulados na raiz | P3 |
| 26. Documentação | 7 | boa | Vault + docs/ + repo; mas com "registro histórico" 0.9.6 vs código 0.9.7 | P2 |
| 27. Comercialização / rentabilidade | 4 | fraco | Stripe sandbox ok local; sem pricing claro, sem paywall claro | P1 |
| 28. Prontidão p/ validação real | 3 | crítico | Backend Vercel fora do ar (404 health endpoints) | **P0** |
| 29. Riscos estratégicos | 4 | alto | Escopo, supply chain de OCR/PDF, dependência de Pluggy | P1 |
| 30. Próximas prioridades | � | � | Definidas no plano de ação | � |

Média ponderada: 5.4 / 10.

---

## 3. Achados críticos (P0 + P1)

### P0-01 � Backend de produção fora do contrato de API

Evidência:

- `docs/DEPLOYMENT_STATUS.md` documenta o estado operacional do backend publicado.
- `README.md:12` confirma o bloqueio como remanescente.
- Versão `0.9.7` no `package.json`; doc fala em `0.9.6.1v` como registro histórico.

Impacto:

- Sem backend, a IA não responde, o billing não fecha o ciclo end-to-end, o sync não persiste, o login Firebase� sessão não troca tokens.
- O frontend "funciona" mas é uma vitrine vazia. Validar com cliente queima credibilidade.

Recomendação:

- Corrigir root directory do projeto Vercel do backend (apontar para `backend/`, não para a raiz do repo).
- Validar via `npm run health:vercel` com `VERCEL_TARGET_URL`.
- Bloquear deploy se health falhar.

Esforço: 0.5 dia.

Risco se ignorar: validação impossível, cobrança impossível, confiança financeira impossível.

### P0-02 � Cálculos financeiros usando float JavaScript no Dashboard, CashFlow e listas

Evidência:

- `components/Dashboard.tsx:99` � `accounts.reduce((sum, account) => sum + account.balance, 0)`.
- `components/Dashboard.tsx:104,107,112,115,182,184` � somas diretas.
- `components/CashFlow.tsx:115-125` � `summary.pending += transaction.amount`.
- `src/security/moneyMath.ts` existe mas só `src/finance/reportEngine.ts` importa (grep confirmado).

Impacto:

- Em produto financeiro, `0.1 + 0.2 = 0.30000000000000004` é inaceitável.
- Diferenças entre "Saldo" e "Soma de transações" vão aparecer em ambientes reais com volume.
- Quebra a regra explícita do `Project Rules.md`: integridade e rastreabilidade antes de velocidade.

Recomendação:

- Tornar `moneyMath.ts` o único caminho para operações monetárias no frontend.
- Aumentar `Decimal.set({ precision: 28 })`.
- Adicionar teste de invariante: "soma de N lembretes via floats vs decimais é idêntica centavo a centavo".

Esforço: 1-2 dias para refactor mais 0.5 dia para testes.

Risco se ignorar: erro silencioso de centavos; cliente perde confiança no número do saldo.

### P0-03 � Audit log do frontend só em memória

Evidência:

- `src/security/auditLogService.ts:18` � `const auditLogs: AuditLogEntry[] = [];`.
- Nunca persiste.
- `firestore.rules:261-274` cria a coleção `audit_logs/{tenantId}/events/{eventId}` com `allow update, delete: if false` (tamper-evident), mas o frontend nunca escreve nela.

Impacto:

- Promessa de auditabilidade só no schema, não no comportamento.
- Falsa sensação de rastreabilidade para um produto financeiro.

Recomendação:

- Substituir `auditLogs.push(entry)` por escrita em Firestore em `audit_logs/{tenantId}/events`.
- Manter array em memória apenas como cache opcional.
- Cobrir com teste de rules.

Esforço: 0.5 dia.

Risco se ignorar: defesa jurídica enfraquecida em incidente; falha de conformidade.

### P1-01 � Escopo do produto contradiz o `Product Plan.md`

Evidência:

- `Product Plan.md` diz NÒO super-app, NÒO Open Finance como eixo, NÒO "CFO autônomo".
- Código atual:
  - `pages/AICFO.tsx`, `pages/Autopilot.tsx`, `pages/OpenBanking.tsx`, `pages/ReceiptScanner.tsx` presentes.
  - `src/ai/financialAutopilot.ts`, `src/ai/aiCFO.ts`, `src/ai/aiOrchestrator.ts` pipeline completo.
  - Backend `bankingRoutes` (com `featureGateOpenFinance`), `clinicIntegrationRoutes`, `businessIntegrationRoutes`, `externalIntegrationRoutes`.
  - `package.json` lista `react-pluggy-connect`, `tesseract.js`, `pdf-parse`, `@google/genai`, `@google/generative-ai` como dependências (não devDependencies).
  - `.env.example:105` � `VITE_FEATURE_AUTOPILOT=true` por padrão.

Impacto:

- Bundle inflado, complexidade cognitiva alta, manutenção pesada, mensagem confusa para o cliente.
- Custo de IA inflado por funcionalidades fora do eixo.
- Reforma de UI ficou cosmética: a casa por trás continua igual.

Recomendação:

- Cortar com bisturi as 4 páginas legadas (mover para `pages/legacy/` ou deletar).
- Remover `react-pluggy-connect`, `tesseract.js`, `pdf-parse`, `@google/genai`.
- Apagar `src/ai/financialAutopilot.ts` e dependências.
- Reduzir `src/ai/` de 21 arquivos para ~5.
- Pluggy continua só atrás de feature flag default off.

Esforço: 2-3 dias.

Risco se ignorar: projeto não se explica em uma frase; cliente novo confunde.

### P1-02 � "Receita prevista" tem dois modelos competindo

Evidência:

- `Dashboard.tsx:109-117` constrói `projectedRevenueMonth` somando `reminders` com `amount > 0` e `!completed`.
- `CashFlow.tsx:90-133` constrói o mesmo conceito derivando `status` de `transaction.generated` + `transaction.date`.
- Não existe entidade canônica de "Recebível".

Impacto:

- Dois números diferentes para a mesma pergunta dependendo da tela.
- O eixo central declarado no `Product Plan.md` (receita prevista + receita realizada) não tem dado canônico.

Recomendação:

- Definir modelo `Receivable` com campos: `id`, `workspace_id`, `tenant_id`, `due_date`, `expected_amount`, `realized_amount`, `source`, `status`.
- Migrar `Reminder` financeiro e `transaction.generated` para alimentar esse modelo.
- Dashboard e CashFlow leem do mesmo agregado.
- Teste invariante: "soma de Receivables.open == projetado no Dashboard == pendente no CashFlow".

Esforço: 3-4 dias.

Risco se ignorar: toda decisão consultiva da IA fica em cima de dado inconsistente.

### P1-03 � IA "consultiva" embalada como "autônoma"

Evidência:

- `src/ai/aiOrchestrator.ts:36` importa `runFinancialAutopilot`.
- `src/ai/financialAutopilot.ts` produz `AutopilotAction`.
- `pages/AICFO.tsx` mostra `Consultor IA` (rótulo simpático) mas chama `runAIPipelineSync` que executa 6 camadas client-side.
- 21 arquivos em `src/ai/`.

Impacto:

- Promessa quebrada: a IA não é IA, é regras client-side.
- Sob rótulo "Autopilot".
- Risco reputacional médio em demos sofisticadas.

Recomendação:

- Renomear `financialAutopilot` para `signalEngine`.
- Reduzir pipeline de 6 camadas para 3 (Financial Engine + Risk + Insight).
- Qualquer decisão real fica fora � só sinaliza.

Esforço: 1-2 dias.

Risco se ignorar: demo do produto mostra "Autopilot" no código; cliente sofisticado descobre.

### P1-04 � Stubs de auth presentes com guardas só de `NODE_ENV`

Evidência:

- `backend/src/auth/authService.ts:7-11`:

  ```ts
  if (process.env.NODE_ENV === 'production') throw new Error('...');
  return { id: `usr_${Buffer.from(username).toString('base64').slice(0, 12)}`, ... };
  ```
- `backend/src/middleware/auth.ts:64-72` aceita `mock-token-for-` se `NODE_ENV === 'test'`.

Impacto:

- Se um deploy for promovido com `NODE_ENV` ausente ou setado para staging/development por engano, o login local fictício passa.
- Configuração-zumbi que mata fintech.

Recomendação:

- Remover a stub.
- Se precisar de dev login, isolar em arquivo carregado por dynamic import condicional só no startup local.
- Trocar check de NODE_ENV por allowlist explícita (`AUTH_DEV_BYPASS_TOKEN`) com log "INSECURE DEV LOGIN ACTIVE" no boot.

Esforço: 0.5 dia.

Risco se ignorar: auth bypass por configuração errada.

### P1-05 � `lucide-react@1.8.0` e Sentry com dois majors

Evidência:

- `package.json:70`: `"lucide-react": "1.8.0"`.
- A linha de release legítima de `lucide-react` está em `0.4xx`. A versão `1.8.0` não existe no npm canônico � provável typosquat ou pacote diferente.
- `@sentry/react@10.47.0` + `@sentry/tracing@7.120.4` � APIs incompatíveis entre majors 7 e 10.

Impacto:

- Risco de supply chain alto se `lucide-react@1.8.0` for typosquat.
- Sentry duplo: traces da v7 não conectam com transport da v10. Observabilidade comprometida silenciosamente.

Recomendação:

- Verificar publisher e provenance em `package-lock.json`.
- Trocar para `lucide-react@^0.x` legítimo.
- Migrar Sentry para v10 e remover `@sentry/tracing@7`.

Esforço: 0.5 dia.

Risco se ignorar: comprometimento de build ou ruído crônico de Sentry.

### P1-06 � Backend trafega 4 modelos de integração em paralelo

Evidência:

- `backend/src/index.ts:351-359` registra `/api/integrations/external`, `/api/integrations/keys`, `/api/integrations`, `/api/integrations/clinic`.
- Mais `bankingRoutes` (Pluggy).
- Middlewares próprios: `clinicAudit`, `clinicPayloadLimit`, `businessIntegrationContract`, `integrationBindingScope`, `externalIntegrationAuth`.

Impacto:

- Cada vetor é uma surface de risco (HMAC, idempotência, quota).
- Manutenção quadruplicada.
- A regra "preservar fronteiras SaaS" do `Project Rules.md` está sendo multiplicada, não preservada.

Recomendação:

- Definir um contrato único de integração externa (`/api/integrations/{provider}` com HMAC + idempotency-key + workspace binding).
- Mover clinic e business para serem providers desse contrato, não rotas separadas.
- Bloquear por feature flag até existir cliente real.

Esforço: 2-3 dias.

Risco se ignorar: dívida de manutenção e auditoria.

### P1-07 � `.env.example` contradiz defaults reais do backend

Evidência:

- `.env.example:105` � `VITE_FEATURE_AUTOPILOT=true`.
- `.env.example:120-122` � `VITE_FEATURE_OPEN_BANKING=true`, `VITE_FEATURE_RECEIPT_SCANNER=true`, `VITE_FEATURE_AI_CFO=true`.
- `backend/src/config/env.ts:102` � `FEATURE_OPEN_FINANCE=false` (default).

Impacto:

- Devs que copiam o exemplo ligam features que o backend não suporta por padrão.
- Ambiente inconsistente; decisões de produto contraditas pela documentação de setup.

Recomendação:

- Default todas as features fora do eixo para `false`.
- Comentário inline: "ative só para experimentação".

Esforço: 5 minutos.

Risco se ignorar: confusão crônica entre devs.

### P1-08 � Sentry sem DSN no destino e dois inits

Evidência:

- `App.tsx:39` chama `initSentry()`; backend faz o mesmo.
- `docs/DEPLOYMENT_STATUS.md` agora trata `VITE_SENTRY_DSN`/`SENTRY_DSN` como provisionados em producao.
- Resultado: o risco principal deixou de ser `env ausente` e passou a ser `evidencia final de observabilidade nao consolidada`.

Impacto:

- Falhas em produção invisíveis.
- Para um sistema financeiro, bug silencioso pode passar dias sem detecção.

Recomendação:

- Configurar DSN no Vercel.
- Bloquear deploy se DSN ausente em `NODE_ENV=production`.
- Remover `@sentry/tracing@7`.

Esforço: 0.5 dia.

Risco se ignorar: bugs em produção sem rastreio.

---

## 4. Bugs e riscos prováveis (catálogo)

### Funcionais

- **B-F-01 (P0)** Soma de saldos com float em Dashboard, CashFlow, lista.
- **B-F-02 (P1)** Receita prevista diverge entre Dashboard (Reminders) e CashFlow (`transaction.generated`).
- **B-F-03 (P1)** `Dashboard.tsx:113-115` soma `overdueRevenueAmount` sem filtro de mês, mas `pendingRevenueMonth` filtra por mês. `projectedRevenueMonth = pendingRevenueMonth + overdueRevenueAmount` mistura escopos temporais.
- **B-F-04 (P2)** `CashFlow.tsx:194` usa `JSON.stringify(transactions.map(t => t.id + t.amount))` como assinatura. Concatenação string+number causa colisões.
- **B-F-05 (P2)** Workspace recovery em `api.config.ts:329-341` escolhe o primeiro workspace silenciosamente. Usuário multi-workspace pode abrir o errado.

### Visuais

- **B-V-01 (P2)** `text-[7px]` documentado no baseline; ainda parcialmente presente.
- **B-V-02 (P2)** Gradiente do FAB pode conflitar com gradiente da nav inferior em mobile.
- **B-V-03 (P2)** Status pill com `z-index: 100` pode ficar atrás de modais em iOS Safari.

### Dados

- **B-D-01 (P0)** Float drift nos agregados.
- **B-D-02 (P1)** Mistura de timezones: `new Date(transaction.date)` sem normalização TZ; clientes em fuso diferente verão data errada.
- **B-D-03 (P1)** Audit log perdido a cada reload.

### Segurança

- **B-S-01 (P1)** Stubs de auth (P1-04).
- **B-S-02 (P1)** `lucide-react@1.8.0` suspeito.
- **B-S-03 (P2)** `firestore.rules` para `tenant_members` permite read se `canManageWorkspace(workspaceId)` � verificar se admin de workspace A enxerga membros de workspace B do mesmo tenant.
- **B-S-04 (P2)** `helmet()` sem CSP customizado.

### Experiência

- **B-X-01 (P1)** Backend 404 em produção: login Firebase não troca por sessão real; app cai em fallback silencioso.
- **B-X-02 (P2)** `NamePromptModal` aparece sem onboarding � usuário leigo abandona.
- **B-X-03 (P2)** Falha de cloudSync desativa `cloudSyncEnabled` silenciosamente sem notificar.

### Mobile

- **B-M-01 (P2)** `resources:generate` removido por supply chain � build mobile não reprodutível sem intervenção manual.
- **B-M-02 (P2)** Sem evidência de QA real em iOS Safari mobile.

---

## 5. Alinhamento com o rumo do produto

| Eixo declarado | Estado no código | Alinhado? |
|---|---|---|
| Fluxo de caixa | `CashFlow.tsx` agrega entradas e saídas | Parcial (falta moneyMath consistente) |
| Empresas de serviço | Sem nada specific-by-design; clinic-specific embutido no backend | Não |
| Receita prevista vs realizada | Dois modelos competindo (Reminder vs `transaction.status`) | Não |
| Operação �  financeiro | Endpoints `/api/integrations/clinic` e `/api/integrations` existem, mas isolados do dashboard | Parcial |
| IA consultiva | Promessa correta; código entrega "autopilot/orchestrator" | Não |
| Simplicidade | Nav reformada (sim); código (não, escopo inflado) | Parcial |
| Confiabilidade financeira | Decimal.js existe, mal usado | Não |
| Monetização | Backend pronto, fluxo de usuário não | Parcial |

Competindo com o foco:

- `pages/OpenBanking.tsx` + `react-pluggy-connect`.
- `pages/AICFO.tsx` chamando `runAIPipelineSync` de 6 camadas.
- `pages/Autopilot.tsx` + `financialAutopilot.ts`.
- `pages/ReceiptScanner.tsx` + `tesseract.js` + `pdf-parse`.
- Backend `clinicIntegrationRoutes`, `businessIntegrationRoutes`, `externalIntegrationRoutes`, `integrationKeyRoutes`.

Veredito: produto declarado é "simples e útil"; código entregue é "denso e ambicioso". Divergência crônica.

---

## 6. Decisões difíceis evitadas pelo projeto

1. **Cortar AICFO e Autopilot.** Filho preferido; manter atrasa o produto real.
2. **Aceitar que clínica é vertical, não horizontal.** Backend já tem clinic-specific routes. Ou vira clinic-only ou apaga.
3. **Open Finance é distração até PMF.** Pluggy custa ~R$1k/mês (comentário no `env.ts`); luxo pré-receita.
4. **Backend Vercel quebrado por 30+ dias.** Deveria ter sido P0 absoluto há um mês. Reformar UI enquanto API está em 404 é prioridade trocada.
5. **Cobrar pelo quê.** Sem paywall, billing virou infraestrutura sem ROI.
6. **Promessa de IA vs heurística client-side.** Renomear ou implementar de verdade backend-side com LLM no loop.
7. **"Web e mobile primeira classe"** com `resources:generate` removido � mobile não tem build reprodutível.
8. **Dois Sentrys, dois SDKs Gemini, dois bancos (Firestore + Postgres backend).** Custo de manter ambas as escolhas; escolher uma de cada.

---

## 7. Nota final

Flow Finance hoje: **5.4 / 10**.

Por que essa nota:

- Engenharia tem rigor (testes, rules, segurança auditada, refresh tokens, rate limit) � puxa para cima.
- Produto está desfocado (escopo inflado, IA performativa, dados financeiros frágeis) � puxa para baixo.
- Ambiente alvo de produção quebrado há 30+ dias bloqueia validação real.

O que faria subir 2 pontos (para ~7.5):

1. Backend Vercel respondendo o contrato.
2. moneyMath em 100% dos agregados.
3. Audit log persistido em Firestore.
4. 4 páginas legadas cortadas do bundle.
5. Modelo canônico de Receivable substituindo o Reminder-financeiro.

O que impediria de validar:

- Backend Vercel em 404 (impossível).
- Saldos com erro de centavos.
- Audit log fake.
- Promessa de "Autopilot" sem entregar.

Próxima ação mais importante: fechar o backend de produção (P0-01). Antes disso, qualquer outro trabalho é desperdício.

---

## 8. Limites desta auditoria

- Foi feita só lendo repositório, docs e config.
- Não rodei lint, testes nem subi o app.
- A nota é baseada em evidência de código.
- Confirmar P0-01 e P0-02 com execução real antes de agir.

Plano de execução detalhado: `docs/PLANO_ACAO_AUDITORIA_2026-05-15.md`.

