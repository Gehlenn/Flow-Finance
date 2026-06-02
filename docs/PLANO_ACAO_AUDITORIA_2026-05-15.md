# Plano de Ação — Auditoria Flow Finance 2026-05-15

## Papel deste documento

Plano executável derivado da auditoria em `docs/AUDIT_FLOW_FINANCE_2026-05-15.md`.

Cada item abaixo é uma **sessão de trabalho independente** que um agente (Codex / Claude / Copilot) deve poder executar do começo ao fim sem precisar de contexto adicional fora do referenciado. As sessões estão ordenadas por dependência. Pular ordem só com justificativa explícita.

Regras gerais para qualquer sessão:

- Antes de começar: ler `AGENTS.md`, `obsidian-vault/Projetos/Core/Project Rules.md`, `Product Plan.md` e este plano.
- O código vence a documentação. Se algo divergir, corrija a documentação na mesma passada.
- Commit atômico por sessão, com mensagem `audit-2026-05-15(<id>): <título>`.
- Sempre rodar `npm run lint` antes do commit.
- Para superfícies de risco (auth, billing, multi-tenancy, dados financeiros, rules), rodar a suíte aplicável: `npm run test:coverage:critical` e `npm run test:firestore:rules`.
- Testes E2E só obrigatórios em sessões que mudem fluxo de usuário.
- Nunca skipar hook de pre-commit.
- Trabalhar com `rtk` no shell (regra global do usuário).

Convenções:

- **Arquivos afetados** lista cada caminho que será editado, criado ou removido. Caminhos absolutos quando ambíguos.
- **Diff esperado** descreve em texto o que vai entrar e sair do arquivo. Não é o diff literal, é a intenção.
- **Critério de pronto** é uma lista verificável (comando + resultado esperado).
- **O que NÃO fazer nesta sessão** corta escopo para evitar drift.
- **Dependência** lista o ID de outras sessões que precisam estar fechadas antes.

Escala de prioridade igual à da auditoria: P0 bloqueia uso real; P1 prejudica fortemente; P2 melhora importante; P3 polimento.

Cronograma agregado:

- Etapa A (P0 — destrava produção e fundação financeira): sessões S0, S1, S2. Tempo: ~3-4 dias.
- Etapa B (P1 — saneamento crítico): sessões S3, S4, S5, S6, S7. Tempo: ~7-10 dias.
- Etapa C (P1 — monetização): sessão S8. Tempo: ~2 dias.
- Etapa D (P2 — polimento): sessões S9, S10. Tempo: ~3-5 dias.

Total: 15-21 dias úteis para o agente trabalhando em série. Se houver paralelização, ver matriz de dependências no fim do documento.

---

## Etapa A — Destravar produção e cravar fundação financeira (P0)

### Sessão S0 — Restaurar contrato de API em produção

ID: `S0`
Prioridade: P0
Esforço estimado: 0.5 dia
Dependência: nenhuma
Achado relacionado: P0-01

#### Objetivo

Fazer com que `https://flow-finance-backend.vercel.app/health`, `/api/health` e `/api/version` voltem a responder o contrato esperado em produção. Sem isso, todas as outras sessões são desperdício.

#### Pré-requisitos

- Acesso ao painel da Vercel do projeto backend (login com a conta dona).
- `VERCEL_TARGET_URL` definido em variável local antes de validar.
- Ler `docs/DEPLOYMENT_STATUS.md` e `docs/VERCEL_CONFIG.md`.

#### Arquivos afetados

- Possivelmente `backend/vercel.json` (verificar root directory / rewrites).
- Painel Vercel (config externo, não no repo) — root directory deve apontar para `backend/`.
- `docs/DEPLOYMENT_STATUS.md` — atualizar status pós-correção.
- `docs/VERCEL_RECOVERY_CHECKLIST.md` — atualizar com novo procedimento se aplicável.
- `docs/CHANGELOG.md` — registrar correção.

#### Diff esperado

1. Verificar no painel Vercel se o projeto backend tem `Root Directory = backend`. Se não, ajustar.
2. Conferir `backend/vercel.json` — deve apontar para `api/index.ts` ou equivalente conforme estrutura atual. Se houver `routes`/`rewrites` apontando para a raiz do repo, corrigir.
3. Garantir que as variáveis abaixo existem no projeto Vercel:
   - `NODE_ENV=production`
   - `JWT_SECRET` com 32+ caracteres
   - `OPENAI_API_KEY` ou `GEMINI_API_KEY`
   - `ALLOWED_ORIGINS` com o domínio do frontend
   - `APP_VERSION=0.9.7`
   - `SENTRY_DSN` (opcional, mas configurar se possível — ver S7)
4. Trigger de re-deploy.
5. Validar com:
   ```bash
   VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app rtk npm run health:vercel
   ```
6. Atualizar `docs/DEPLOYMENT_STATUS.md`: substituir o bloco "Situacao atual / Backend" pelo novo estado (com data 2026-05-15) e mover o estado antigo para a seção histórica, se houver.
7. Adicionar entrada em `docs/CHANGELOG.md`:
   ```
   ## 2026-05-15 - Restauracao do contrato de API
   - Root directory do projeto Vercel do backend ajustado para `backend/`
   - `/health`, `/api/health` e `/api/version` voltam a responder
   - Variaveis de ambiente fechadas no destino
   ```

#### Critério de pronto

- `curl https://flow-finance-backend.vercel.app/health` retorna `200` com payload contendo `status`, `requestId`, `routeScope`, `checks`.
- `curl https://flow-finance-backend.vercel.app/api/version` retorna `200` com `version: "0.9.7"`.
- `curl https://flow-finance-backend.vercel.app/api/health` retorna `200` com `service: "flow-finance-api"`.
- `npm run health:vercel` finaliza sem erro.
- `docs/DEPLOYMENT_STATUS.md` reflete o estado real.
- `docs/CHANGELOG.md` tem a entrada.

#### O que NÃO fazer nesta sessão

- Não tocar em código de produto.
- Não mexer em `firestore.rules`.
- Não corrigir nenhum outro achado da auditoria. Sessão dedicada a destravar produção.
- Não fazer rotação de segredos a menos que descubra que algum vazou.

#### Risco da sessão

- Se rotear errado de novo, a API continua quebrada. Mitigação: rodar `npm run health:vercel` antes e depois.
- Se as variáveis novas quebrarem outro deploy paralelo, restaurar com `vercel rollback`.

---

### Sessão S1 — Cravar moneyMath em todos os agregados financeiros do frontend

ID: `S1`
Prioridade: P0
Esforço estimado: 1.5 dia
Dependência: S0 (opcional para validação E2E, mas pode ser feito em paralelo)
Achado relacionado: P0-02, B-F-01, B-D-01

#### Objetivo

Eliminar uso de float JS em qualquer soma, subtração, multiplicação ou divisão de valor monetário no frontend. Tornar `src/security/moneyMath.ts` o único caminho. Adicionar teste de invariante que detecte regressão futura.

#### Pré-requisitos

- Ler `src/security/moneyMath.ts` e entender as funções existentes.
- Ler `components/Dashboard.tsx`, `components/CashFlow.tsx`, `components/TransactionList.tsx`, `components/AdvancedAnalytics.tsx`, `hooks/useFinancialState.ts`.

#### Arquivos afetados

Editar:

- `src/security/moneyMath.ts` — aumentar precisão e expor utilitários adicionais.
- `components/Dashboard.tsx` — substituir somas diretas por `sumTransactions` / `addMoney`.
- `components/CashFlow.tsx` — substituir `summary.pending += transaction.amount` por chamadas de `moneyMath`.
- `components/TransactionList.tsx` — qualquer agregação interna.
- `components/AdvancedAnalytics.tsx` — agregações de gráficos.
- `hooks/useFinancialState.ts` — agregados expostos para o app.

Criar:

- `tests/unit/money-math-invariants.test.ts` — invariantes financeiros.
- `tests/unit/dashboard-money-math.test.ts` — invariante específico para Dashboard.

#### Diff esperado

1. Em `src/security/moneyMath.ts`:
   - Mudar `Decimal.set({ precision: 10, rounding: 4 })` para `Decimal.set({ precision: 28, rounding: 4 })`.
   - Adicionar utilitário `toCents(n: number): number` retornando inteiro de centavos (multiplica por 100 e arredonda para int).
   - Adicionar `fromCents(cents: number): number`.
   - Exportar `roundMoney(n: number, decimals = 2): number` baseado em Decimal.
   - Manter API existente compatível.

2. Em cada componente listado:
   - Substituir todas as ocorrências de `.reduce((sum, x) => sum + x.amount, 0)` por `sumTransactions(arr.map(x => x.amount))` ou equivalente usando `addMoney`.
   - Onde houver `a + b` direto sobre valores monetários, usar `addMoney(a, b)`.
   - Onde houver subtração, usar `subtractMoney`.
   - Não tocar em multiplicações de percentual de exibição (`* 100` para `%`) — esses não são money math.

3. Em `components/Dashboard.tsx:99`:
   ```
   const currentBalance = sumTransactions(accounts.map(a => a.balance));
   ```

4. Em `components/Dashboard.tsx:104, 107`:
   ```
   const inflowMonth = sumTransactions(monthTransactions
     .filter(t => t.type === TransactionType.RECEITA)
     .map(t => t.amount));
   ```

5. Em `components/CashFlow.tsx:115-125`, substituir o `reduce` mutável por `reduce` que chama `addMoney` em cada acumulação:
   ```
   const summary = incomeTransactions.reduce((acc, t) => {
     const state = classifyRevenueState(t, referenceDate);
     if (state === 'pending') return { ...acc, pending: addMoney(acc.pending, t.amount) };
     if (state === 'overdue') return { ...acc, overdue: addMoney(acc.overdue, t.amount) };
     return { ...acc, confirmed: addMoney(acc.confirmed, t.amount) };
   }, { confirmed: 0, pending: 0, overdue: 0 });
   ```

6. Em `tests/unit/money-math-invariants.test.ts`:
   - Caso 1: somar `[0.1, 0.2]` via `sumTransactions` deve dar exatamente `0.3` (não `0.30000000000000004`).
   - Caso 2: gerar 1000 valores aleatórios entre 0.01 e 999.99 e comparar `sumTransactions` com soma de inteiros em centavos — diferença ≤ 0.005.
   - Caso 3: `addMoney(0.1, 0.2) === 0.3`.
   - Caso 4: `subtractMoney(1.0, 0.1) === 0.9`.

7. Em `tests/unit/dashboard-money-math.test.ts`:
   - Construir mock de 100 transações com centavos diversos.
   - Verificar que `calculateDashboardMetrics` retorna o mesmo valor de uma soma decimal de referência.

#### Critério de pronto

- `rtk grep "reduce((sum" components/ src/finance/` retorna zero ocorrências de soma direta sobre `.amount`, `.balance`, `.value`, `.expected_amount`, `.realized_amount`.
- `npm run lint` verde.
- `npm run test:coverage:critical` verde com `Branches >= 98%`.
- `npx vitest run tests/unit/money-math-invariants.test.ts tests/unit/dashboard-money-math.test.ts` verde.
- `tests/unit/dashboard-metrics.test.ts` (já existente) continua verde.

#### O que NÃO fazer nesta sessão

- Não mudar o schema de dados (sessão S6 trata disso).
- Não migrar para representação em centavos como tipo (deixar a interface pública em `number` por enquanto; é refactor maior).
- Não tocar em backend.

#### Risco da sessão

- Pequeno: o refactor é mecânico. Risco maior é esquecer ocorrências; mitigado pelo grep no critério.
- Médio: testes que conferem strings de moeda formatada podem falhar por mudança de arredondamento — atualizar tolerâncias.

---

### Sessão S2 — Persistir audit log em Firestore

ID: `S2`
Prioridade: P0
Esforço estimado: 0.5 dia
Dependência: S0 (precisa de backend e Firestore alinhados; pode rodar offline em emulator se S0 atrasar)
Achado relacionado: P0-03, B-D-03

#### Objetivo

Substituir o array em memória de `src/security/auditLogService.ts` por escrita em Firestore na coleção `audit_logs/{tenantId}/events/{eventId}`, respeitando as rules existentes (`firestore.rules:261-274`).

#### Pré-requisitos

- Ler `firestore.rules` linhas 261-274 (regra de `audit_logs`).
- Ler `src/security/auditLogService.ts` inteiro.
- Ler `services/firebase.ts` para entender como obter `db`.
- Ler qualquer arquivo que chama `logAuditEvent` (`rtk grep "logAuditEvent" -l`).

#### Arquivos afetados

Editar:

- `src/security/auditLogService.ts` — substituir backend de armazenamento.

Criar:

- `src/security/auditLogPersistence.ts` — adapter Firestore (separado para testabilidade).
- `tests/unit/audit-log-service.test.ts` — testes de comportamento (adicionar ou estender).
- `tests/firestore/audit-logs.rules.test.ts` — confirmar rules cobrem escrita autorizada e bloqueiam update/delete (se já não existir caso específico).

#### Diff esperado

1. Novo `src/security/auditLogPersistence.ts`:
   - Exporta `persistAuditEvent(tenantId: string, workspaceId: string, userId: string, entry: AuditLogEntry): Promise<void>`.
   - Usa `addDoc(collection(db, 'audit_logs', tenantId, 'events'), { ...entry, tenantId, workspaceId, userId, createdAt: serverTimestamp() })`.
   - Não lança em caso de erro de rede — registra via `logError` e retorna. Auditoria não pode quebrar fluxo do usuário, mas precisa ser visível.
   - Aceita injeção de `dbInstance` para testes.

2. Em `src/security/auditLogService.ts`:
   - Manter API pública (`logAuditEvent`, `getAuditLogs`, `AUDIT_EVENTS`).
   - Internamente, `logAuditEvent` agora aceita parâmetros adicionais `tenantId`, `workspaceId`, `userId` (ou lê de contexto thread-local — discutir, mas preferir parâmetros explícitos).
   - Continua mantendo cache em memória (últimos N eventos) para diagnóstico local, mas a fonte de verdade vira Firestore.
   - Chamar `persistAuditEvent` de forma async/fire-and-forget (`void persistAuditEvent(...)`), mas sempre `logInfo` o resultado.

3. Atualizar todas as chamadas existentes de `logAuditEvent` para passar `tenantId/workspaceId/userId`.
   - Identificar com `rtk grep "logAuditEvent(" -l`.
   - Em cada chamada, obter o contexto do hook/serviço local. Se um caller não tem contexto, criar overload temporário (`logAuditEvent_LEGACY`) que só faz o log local, e marcar com TODO de migração.

4. Testes:
   - Mockar `addDoc`. Verificar que o payload tem `tenantId`, `workspaceId`, `userId`, `event_type`, `entity`, `entity_id`, `metadata`, `createdAt`.
   - Verificar que falha de Firestore não joga exceção para o caller.

5. Para o teste de rules, garantir que existe caso:
   - Usuário autenticado, com `canEditWorkspaceData(workspaceId)`, escrevendo em `audit_logs/{tenantId}/events` com `tenantId` correto → permitido.
   - Mesma escrita sem `userId == request.auth.uid` → negado.
   - Update e delete → sempre negados.

#### Critério de pronto

- `rtk grep "auditLogs.push" src/` retorna zero ou só dentro de cache temporário com comentário explicando.
- Ao criar uma transação no app (rodando local com Firebase emulator), aparece documento em `audit_logs/{tenant}/events`.
- `npm run test:firestore:rules` verde.
- `npm run lint` verde.
- `npm run test:coverage:critical` verde.

#### O que NÃO fazer nesta sessão

- Não migrar histórico antigo (não existe — array em memória se perde a cada reload).
- Não criar leitura de audit log na UI (sessão futura).
- Não tocar em `pages/WorkspaceAudit.tsx` — ele já usa Firestore.

#### Risco da sessão

- Médio: precisa garantir que toda chamada de `logAuditEvent` recebe contexto. Falta de contexto = perda silenciosa de evento.
- Mitigação: introduzir overload `logAuditEvent_LEGACY` para chamadas sem contexto e marcar com TODO; reverter no final.

---

## Etapa B — Saneamento crítico (P1)

### Sessão S3 — Remover stubs de auth e fortalecer guardas

ID: `S3`
Prioridade: P1
Esforço estimado: 0.5 dia
Dependência: S0 (precisa do backend de pé para validar)
Achado relacionado: P1-04, B-S-01

#### Objetivo

Eliminar as stubs `AuthService.login`/`register` que só são bloqueadas via `NODE_ENV === 'production'`. Substituir o mock de token de teste por um mecanismo explícito que falha fechado em qualquer ambiente que não seja teste local.

#### Pré-requisitos

- Ler `backend/src/auth/authService.ts` inteiro.
- Ler `backend/src/middleware/auth.ts:64-72`.
- Ler `backend/src/auth/authController.ts` para entender chamadas.
- Ler `docs/SECURITY_AUDIT_2026-05-03.md`.

#### Arquivos afetados

Editar:

- `backend/src/auth/authService.ts` — remover ou isolar stubs.
- `backend/src/middleware/auth.ts` — substituir bypass de teste por mecanismo explícito.
- `backend/src/auth/authController.ts` — se ainda chamar `AuthService.login`, refatorar.
- `backend/src/config/env.ts` — adicionar `AUTH_DEV_BYPASS_TOKEN` opcional.
- `.env.example` — documentar a nova variável (com aviso de "INSECURE").
- `docs/SMOKE_AUTH_REAL_CHECKLIST.md` — refletir mudanças.
- `docs/CHANGELOG.md` — registrar.

#### Diff esperado

1. Em `backend/src/auth/authService.ts`:
   - Apagar `AuthService.login` (não é mais chamado em produção; auth real é via Firebase identity).
   - Apagar `AuthService.register`.
   - Se algo importar `AuthService` para outras coisas, manter classe vazia ou refatorar para função local.

2. Em `backend/src/middleware/auth.ts:64-72`, substituir:
   ```
   if (process.env.NODE_ENV === 'test' && token.startsWith('mock-token-for-')) { ... }
   ```
   por:
   ```
   const devBypassToken = env.AUTH_DEV_BYPASS_TOKEN;
   if (
     env.NODE_ENV === 'test'
     && devBypassToken
     && token === devBypassToken
   ) {
     req.userId = 'test-user';
     req.userEmail = 'test-user@local.test';
     req.userExp = Date.now() / 1000 + 60;
     updateRequestContext({ userId: 'test-user', userEmail: req.userEmail });
     logger.warn({ fallback: 'auth-dev-bypass-active' }, 'INSECURE DEV LOGIN bypass token used');
     next();
     return;
   }
   ```
   - Se nada de bypass match, segue para JWT normal.
   - `AUTH_DEV_BYPASS_TOKEN` é uma string única gerada por dev local; não tem default.

3. Em `backend/src/config/env.ts`:
   - Adicionar `AUTH_DEV_BYPASS_TOKEN: readEnv('AUTH_DEV_BYPASS_TOKEN')`.
   - No bloco de validação no fim do arquivo, adicionar:
     ```
     if (env.AUTH_DEV_BYPASS_TOKEN && env.NODE_ENV === 'production') {
       throw new Error('AUTH_DEV_BYPASS_TOKEN must be unset in production');
     }
     ```

4. Atualizar testes que dependiam do prefixo `mock-token-for-` para usar `AUTH_DEV_BYPASS_TOKEN`. Identificar com `rtk grep "mock-token-for-" tests/`.

5. Em `.env.example`, na seção de segurança:
   ```
   # AUTH_DEV_BYPASS_TOKEN: ative SOMENTE em teste local automatizado.
   # NUNCA defina em produção (o backend rejeita boot).
   # Use string aleatoria de 32+ caracteres se for usar.
   # AUTH_DEV_BYPASS_TOKEN=
   ```

6. Atualizar `docs/CHANGELOG.md`:
   ```
   ## 2026-05-15 - Remocao de stubs de auth e endurecimento
   - AuthService.login/register removidos
   - Bypass de teste agora exige AUTH_DEV_BYPASS_TOKEN explicito (sem default)
   - Boot bloqueia se AUTH_DEV_BYPASS_TOKEN estiver setado em producao
   ```

#### Critério de pronto

- `rtk grep "AuthService.login\|AuthService.register" backend/` retorna zero (exceto comentários de história).
- `rtk grep "mock-token-for-" backend/ tests/` retorna zero (todos migrados).
- Subir backend com `NODE_ENV=production` e `AUTH_DEV_BYPASS_TOKEN=xxx` falha no boot com erro claro.
- `npm run test:backend` verde.
- `npm run lint` verde.
- `docs/CHANGELOG.md` atualizado.

#### O que NÃO fazer nesta sessão

- Não mudar Firebase identity flow.
- Não tocar em `firestore.rules`.
- Não mexer em billing.

#### Risco da sessão

- Baixo a médio: testes existentes que usavam `mock-token-for-USERID` precisam virar `AUTH_DEV_BYPASS_TOKEN`, perdendo a flexibilidade de "qualquer userId". Mitigação: em testes de integração que precisam de múltiplos usuários, gerar JWT real com `generateAccessToken` ao invés de bypass.

---

### Sessão S4 — Cortar páginas legadas e dependências pesadas do bundle

ID: `S4`
Prioridade: P1
Esforço estimado: 1.5 dia
Dependência: nenhuma (mas idealmente depois de S1 para evitar mover arquivos que ainda vão ser editados)
Achado relacionado: P1-01

#### Objetivo

Alinhar o bundle com o `Product Plan.md`. Remover `pages/AICFO.tsx`, `pages/Autopilot.tsx`, `pages/OpenBanking.tsx`, `pages/ReceiptScanner.tsx` do bundle ativo. Remover dependências pesadas (`react-pluggy-connect`, `tesseract.js`, `pdf-parse`, `@google/genai`) que não pertencem ao núcleo.

Observação: `pages/AICFO.tsx` é a tela do **Consultor IA**, que continua no produto. **Manter o Consultor IA**, mas refatorar para versão mínima na sessão S5. Aqui em S4, esta página é mantida; remover só Autopilot, OpenBanking e ReceiptScanner.

#### Pré-requisitos

- Ler `Product Plan.md` para confirmar escopo cortado.
- Ler `src/app/mainNavigation.ts` — confirmar que essas páginas já não estão na nav principal.
- Ler `hooks/useNavigationTabs.tsx` para entender o roteamento.
- Ler `package.json` dependências.
- `rtk grep -l "from '\\.\\./pages/Autopilot'\\|from './pages/Autopilot'"` para identificar imports.

#### Arquivos afetados

Remover:

- `pages/Autopilot.tsx`
- `pages/OpenBanking.tsx`
- `pages/ReceiptScanner.tsx`
- `pages/AIControlPanel.tsx` — se for só wrapper de dev panel já coberto por `src/debug/`, decidir caso a caso (manter se útil para dev).

Editar:

- `hooks/useNavigationTabs.tsx` — remover rotas das páginas eliminadas.
- `App.tsx` — remover imports residuais (se houver).
- `package.json` — remover dependências mortas.
- `.env.example` — remover ou desativar feature flags correspondentes.
- `src/app/monetizationPlan.ts` — se referenciar features cortadas, ajustar.
- Backend `backend/src/index.ts` e `backend/src/routes/banking.ts` — manter Pluggy só atrás de `FEATURE_OPEN_FINANCE=false` (já está); adicionar bloco de comentário "deprecated for current scope".

Atualizar testes:

- Remover ou marcar como skipped: `tests/unit/open-banking-service*.test.ts`, `tests/unit/ai-autopilot-*.test.ts`, `tests/unit/aicfo-*.test.ts` que dependem das pages removidas (não os de `aiCFO.ts`, que continuam).

Documentação:

- `docs/CHANGELOG.md` — registrar remoção.
- `docs/ROADMAP.md` — atualizar seção que mencionar Open Banking.
- `obsidian-vault/Projetos/Core/Code Tasks.md` — atualizar status.

#### Diff esperado

1. Remover arquivos:
   ```
   rm pages/Autopilot.tsx
   rm pages/OpenBanking.tsx
   rm pages/ReceiptScanner.tsx
   ```
   (substituir com Edit/Write tool no agente Claude).

2. Em `hooks/useNavigationTabs.tsx`:
   - Remover qualquer `case 'autopilot'`, `case 'openbanking'`, `case 'receiptscanner'`.
   - Limpar imports.
   - Se houver tipo `Tab = '...' | 'autopilot' | ...`, retirar os literais.

3. Em `package.json`, remover de `dependencies`:
   - `react-pluggy-connect`
   - `tesseract.js`
   - `pdf-parse`
   - `@google/genai` (manter `@google/generative-ai` por enquanto, se for usado por backend)
   - `esbuild` (mover para `devDependencies` — já vem com Vite).
   
   Rodar `rtk npm install` para regenerar `package-lock.json`.

4. Em `.env.example`, comentar:
   ```
   # VITE_FEATURE_AUTOPILOT=false  # desativado: fora do escopo atual do produto
   # VITE_FEATURE_OPEN_BANKING=false  # desativado: Pluggy nao integra no eixo principal
   # VITE_FEATURE_RECEIPT_SCANNER=false  # desativado: OCR fora do escopo atual
   # VITE_FEATURE_AI_CFO=true  # manter: Consultor IA continua
   ```
   E mudar defaults declarados no início.

5. Backend `backend/src/index.ts`:
   - Manter `bankingRoutes` atrás de `featureGateOpenFinance` mas adicionar comentário:
     ```
     // bankingRoutes: mantido atras de feature gate. Fora do eixo atual do produto.
     // Default FEATURE_OPEN_FINANCE=false. Nao ativar sem decisao explicita.
     ```
   - Considerar remover `app.use('/api/banking', ...)` em `production` se gate disser `false`. Verificar implementação atual de `featureGateOpenFinance`.

6. Testes:
   - `tests/unit/open-banking-service*.test.ts` — se testar a rota Pluggy, manter (cobertura da feature gate).
   - `tests/unit/ai-autopilot-*.test.ts` — se a função `runFinancialAutopilot` for removida em S5, esses testes vão para lá. Por enquanto, manter os do core e remover os específicos da UI removida.

7. Documentação:
   - `docs/CHANGELOG.md`:
     ```
     ## 2026-05-15 - Corte de paginas legadas e dependencias pesadas
     - Removidas: pages/Autopilot.tsx, pages/OpenBanking.tsx, pages/ReceiptScanner.tsx
     - Removidas dependencias: react-pluggy-connect, tesseract.js, pdf-parse, @google/genai
     - Open Finance/Pluggy continua disponivel atras de FEATURE_OPEN_FINANCE=false
     - Consultor IA (pages/AICFO.tsx) preservado para refactor em S5
     ```

#### Critério de pronto

- `rtk grep "from '\.\./pages/Autopilot'\|from './pages/Autopilot'" src/ hooks/ components/ App.tsx` retorna zero.
- Mesma checagem para `OpenBanking` e `ReceiptScanner`.
- `rtk npm install` sem erros.
- `rtk npm run build` produz bundle. Comparar tamanho antes/depois:
  - Antes: rodar `du -sh dist/assets` num branch limpo.
  - Depois: idem; deve cair em pelo menos 25%.
- `rtk npm run lint` verde.
- `rtk npm run test:coverage:critical` verde.
- `rtk npx playwright test tests/e2e/dashboard.spec.ts tests/e2e/transactions.spec.ts --project=chromium --workers=1` verde.

#### O que NÃO fazer nesta sessão

- Não remover `pages/AICFO.tsx` (Consultor IA).
- Não remover `services/geminiService.ts` (continua sendo proxy).
- Não tocar em `src/ai/` ainda (S5 trata).
- Não tocar em billing nem auth.

#### Risco da sessão

- Médio: imports residuais quebram o build. Mitigação: rodar `npm run build` antes do commit; corrigir todos os erros.
- Médio: testes E2E podem quebrar se algum spec navegar para rotas removidas. Mitigação: rodar suíte completa; ajustar specs que dependem das rotas.
- Baixo: Pluggy continua na codebase (atrás de flag) e qualquer rollback é trivial.

---

### Sessão S5 — Reduzir `src/ai/` e renomear "Autopilot" para alinhar com promessa

ID: `S5`
Prioridade: P1
Esforço estimado: 1.5 dia
Dependência: S4 (precisa ter cortado a página de Autopilot antes)
Achado relacionado: P1-03

#### Objetivo

Reduzir 21 arquivos em `src/ai/` para um núcleo consultivo focado: interpretação de entrada, contexto financeiro, resposta do Consultor IA, memória básica. Eliminar a metáfora "Autopilot" e o pipeline de 6 camadas que confunde "regras" com "IA".

#### Pré-requisitos

- Ler `src/ai/aiOrchestrator.ts`, `src/ai/financialAutopilot.ts`, `src/ai/aiCFO.ts`, `src/ai/aiInterpreter.ts`, `src/ai/aiMemory.ts`, `src/ai/financialEngine.ts`, `src/ai/insightGenerator.ts`, `src/ai/riskAnalyzer.ts`, `src/ai/behaviorAnalyzer.ts`, `src/ai/leakDetector.ts`, `src/ai/adaptiveAIEngine.ts`.
- Ler `pages/AICFO.tsx` para mapear o que ela consome.
- Ler `Product Plan.md` para reconfirmar: "IA consultiva (clareza de decisao)".

#### Arquivos afetados

Manter e adaptar:

- `src/ai/aiInterpreter.ts` — entrada livre (texto/voz) → ação estruturada. Mantém.
- `src/ai/aiCFO.ts` — Q&A do Consultor IA. Mantém, simplifica.
- `src/ai/aiMemory.ts` — memória básica do usuário. Mantém, simplifica.
- `src/ai/cfoConversationStore.ts` — store da conversa. Mantém.
- `src/ai/subscriptionDetector.ts` — detector de assinaturas (útil, alinha com fluxo de caixa). Mantém.

Renomear/Refatorar:

- `src/ai/financialAutopilot.ts` → `src/ai/signalEngine.ts`. A função `runFinancialAutopilot` vira `computeFinancialSignals`. `AutopilotAction` vira `FinancialSignal` com campo explícito `kind: 'cut' | 'goal' | 'alert' | 'opportunity'` e nunca executa nada — só sugere.

Remover:

- `src/ai/aiOrchestrator.ts` — substituir por chamadas diretas a `aiCFO` + `signalEngine` conforme necessário.
- `src/ai/adaptiveAIEngine.ts` — heurística client-side mascarada de "aprendizado".
- `src/ai/behaviorAnalyzer.ts` — sobrepõe `aiCFO`.
- `src/ai/financialEngine.ts` — duplica `src/finance/`.
- `src/ai/financialGraph.ts` — não usado pelo eixo principal.
- `src/ai/financialSimulator.ts` — fora do eixo.
- `src/ai/riskAnalyzer.ts` — funde dentro de `signalEngine`.
- `src/ai/leakDetector.ts` — funde dentro de `signalEngine`.
- `src/ai/fixedExpenseDetector.ts` — funde com `subscriptionDetector`.
- `src/ai/salaryDetector.ts` — funde em `signalEngine` se útil; senão remove.
- `src/ai/aiDebugService.ts` — manter em `src/debug/` se útil; senão remove.
- `src/ai/insightGenerator.ts` — funde em `signalEngine` (gera apenas sinais).
- `src/ai/cfoEvaluation.ts` — manter só se for usado em métricas internas; senão remove.
- `src/ai/categoryLearning.ts` — funde em `aiInterpreter` ou remove.
- `src/ai/receiptScanner.ts` — remover (já cortou a página em S4).

Editar:

- `pages/AICFO.tsx` — atualizar imports. Trocar `runAIPipelineSync` por `computeFinancialSignals` + chamada direta a `generateCFOResponse`.
- Qualquer outro consumidor das funções removidas.

Testes:

- Manter os testes de `aiCFO` core, `aiMemory`, `subscriptionDetector`.
- Renomear testes de Autopilot → Signal Engine.
- Remover testes de funções deletadas.

#### Diff esperado

1. Criar `src/ai/signalEngine.ts` consolidando `riskAnalyzer`, `leakDetector`, `insightGenerator`, `salaryDetector` (parte útil), `fixedExpenseDetector` (parte útil) em funções puras:
   - `computeFinancialSignals(state: FinancialState, profile: UserProfile): FinancialSignal[]`
   - Onde `FinancialSignal = { id, kind, severity, title, description, suggestedAction?, evidence }`.
   - Nada executa. Tudo retorna estrutura.

2. Apagar arquivos listados em "Remover".

3. Em `pages/AICFO.tsx`:
   - Trocar `import { runAIPipelineSync } from '../src/ai/aiOrchestrator';` por:
     ```
     import { computeFinancialSignals } from '../src/ai/signalEngine';
     ```
   - Substituir chamadas e construtores de UI.

4. Em `App.tsx`, se houver uso direto de `aiOrchestrator`, remover.

5. Em `pages/AICFO.tsx`, copy:
   - Sem "Autopilot" em lugar nenhum.
   - Substituir microcopy "Autopilot" por "Sugestão" / "Sinal" / "Sugerimos avaliar" — conforme `assistantCopy.ts`.

6. Tipos em `src/ai/types.ts` (se existir) ou em `signalEngine.ts`:
   ```
   export type FinancialSignalKind = 'cash_warning' | 'expense_pattern' | 'projected_gap' | 'fixed_expense_detected' | 'subscription_detected' | 'opportunity';
   export interface FinancialSignal {
     id: string;
     kind: FinancialSignalKind;
     severity: 'info' | 'attention' | 'urgent';
     title: string;
     description: string;
     suggestedAction?: string;
     evidence: Record<string, unknown>;
     computed_at: string;
   }
   ```

7. Documentação:
   - `docs/CHANGELOG.md` — registrar.
   - Atualizar `docs/UI_TYPO_COLOR_CONTRACT.md` se referenciar termos antigos.
   - Atualizar `Code Tasks.md` no vault.

#### Critério de pronto

- `ls src/ai/` lista no máximo 8 arquivos: `aiInterpreter.ts`, `aiCFO.ts`, `aiMemory.ts`, `cfoConversationStore.ts`, `signalEngine.ts`, `subscriptionDetector.ts`, mais qualquer subdir essencial (`memory/`, `queue/` se útil).
- `rtk grep "Autopilot\|autopilot" src/ components/ pages/ hooks/ App.tsx` retorna zero (exceto comentários de história, se intencional).
- `rtk grep "runAIPipelineSync\|aiOrchestrator" src/ components/ pages/ hooks/` retorna zero.
- `rtk npm run lint` verde.
- `rtk npm run test:coverage:critical` verde.
- E2E Chromium verde.
- Tela do Consultor IA continua respondendo às 6 quick prompts existentes.

#### O que NÃO fazer nesta sessão

- Não mudar o backend de AI proxy.
- Não alterar o modelo de dados (S6 trata).
- Não mudar o paywall (S8 trata).

#### Risco da sessão

- Alto: muitos arquivos tocados. Mitigação: commits intermediários por subgrupo (`signalEngine` → `cfo refactor` → `cleanup`). Cada commit rodando `npm run lint` e `npm run test:coverage:critical`.
- Médio: testes existentes referenciam funções removidas. Mitigação: rodar suíte completa e adaptar.

---

### Sessão S6 — Modelo canônico de `Receivable` e migração de Dashboard/CashFlow

ID: `S6`
Prioridade: P1
Esforço estimado: 3.5 dias
Dependência: S1 (precisa do moneyMath consolidado), S2 (audit log persistido para registrar mudanças críticas)
Achado relacionado: P1-02, B-F-02, B-F-03

#### Objetivo

Criar entidade canônica `Receivable` (recebível) que unifica o que hoje está disperso entre `Reminder` financeiro e `Transaction.generated`. Fazer Dashboard e CashFlow lerem do mesmo agregado. Garantir invariante: "soma de Receivables.open == projetado no Dashboard == pendente no CashFlow".

#### Pré-requisitos

- S1 concluída.
- S2 concluída.
- Ler `types.ts` (raiz), `models/`, `shared/`, `backend/shared/`.
- Ler `firestore.rules` para entender estrutura `workspaces/{id}/...`.
- Ler `components/Dashboard.tsx` métricas `pendingRevenueMonth`, `overdueRevenueAmount`, `projectedRevenueMonth`.
- Ler `components/CashFlow.tsx` `classifyRevenueState`, `calculateRevenueStateSummary`.

#### Arquivos afetados

Criar:

- `shared/models/Receivable.ts` (ou `types.ts` se preferir co-locar) — definição do tipo.
- `firestore.rules` — adicionar coleção `workspaces/{workspaceId}/receivables/{receivableId}`.
- `src/finance/receivableService.ts` — CRUD + agregações.
- `tests/unit/receivable-invariants.test.ts` — invariantes financeiros do modelo.
- `tests/firestore/receivables.rules.test.ts` — segurança da coleção.

Editar:

- `components/Dashboard.tsx` — `calculateDashboardMetrics` lê de receivables.
- `components/CashFlow.tsx` — `calculateRevenueStateSummary` lê de receivables.
- `hooks/useFinancialState.ts` — expor receivables.
- `src/services/firestoreWorkspaceStore.ts` (ou equivalente) — adicionar fetch/sync de receivables.
- Backend `backend/src/services/finance/` — endpoint `/api/finance/receivables` (CRUD + sync).
- Migração: criar utilitário one-shot que reads existing Reminders financeiros e gera Receivables equivalentes (modo opt-in: só na primeira vez por workspace, marcado com flag).

Documentação:

- `docs/ARCHITECTURE.md` — atualizar diagrama de dados.
- `docs/CHANGELOG.md`.

#### Diff esperado

1. `shared/models/Receivable.ts`:
   ```ts
   export type ReceivableStatus = 'open' | 'realized' | 'overdue' | 'cancelled';
   export type ReceivableSource = 'manual' | 'reminder_migration' | 'transaction_link' | 'integration';

   export interface Receivable {
     id: string;
     workspace_id: string;
     tenant_id: string;
     user_id: string;
     description: string;
     expected_amount: number;       // valor previsto
     realized_amount: number;       // valor recebido (parcial ou total)
     due_date: string;              // ISO date
     realized_at: string | null;
     status: ReceivableStatus;
     source: ReceivableSource;
     source_ref?: string;           // id do Reminder ou Transaction original
     customer_label?: string;       // empresa de servico atende clientes; util para "ligacao operacao-financeiro"
     created_at: string;
     updated_at: string;
   }

   export function isOpen(r: Receivable, ref: Date = new Date()): boolean {
     return r.status === 'open' && new Date(r.due_date) >= startOfDay(ref);
   }
   export function isOverdue(r: Receivable, ref: Date = new Date()): boolean {
     return r.status === 'open' && new Date(r.due_date) < startOfDay(ref);
   }
   // helper startOfDay aqui ou em utils
   ```

2. `firestore.rules` (acrescentar dentro de `workspaces/{workspaceId}`):
   ```
   match /receivables/{receivableId} {
     allow read: if isWorkspaceMember(workspaceId);
     allow create: if canEditWorkspaceData(workspaceId)
       && requestMatchesWorkspaceContext(workspaceId);
     allow update: if canEditWorkspaceData(workspaceId)
       && resourceMatchesWorkspaceContext(workspaceId)
       && requestMatchesWorkspaceContext(workspaceId);
     allow delete: if canManageWorkspace(workspaceId)
       && resourceMatchesWorkspaceContext(workspaceId);
   }
   ```

3. `src/finance/receivableService.ts`:
   - `listReceivables(workspaceId): Promise<Receivable[]>`
   - `createReceivable(workspaceId, input): Promise<Receivable>`
   - `markRealized(id, amount): Promise<void>` (usando `addMoney` em `realized_amount`).
   - `cancelReceivable(id): Promise<void>`.
   - `aggregateReceivables(workspaceId, refDate): { confirmed, pending, overdue, projected }` usando `moneyMath`.

4. `components/Dashboard.tsx`:
   - Trocar `pendingRevenueMonth`, `overdueRevenueAmount`, `projectedRevenueMonth` para virem de `aggregateReceivables`.
   - Manter `confirmedRevenueMonth = inflowMonth` por enquanto (ou ligar a `Receivable.status === 'realized'` no mês — preferível).

5. `components/CashFlow.tsx`:
   - Substituir `classifyRevenueState(transaction, ...)` por leitura direta dos receivables.
   - Manter agregação por timeframe via receivables.

6. Migração one-shot (script utilitário, não no caminho crítico):
   - `scripts/migrate-reminders-to-receivables.mjs`:
     - Itera por todos os reminders com `amount > 0`.
     - Cria Receivable correspondente com `source: 'reminder_migration'`, `source_ref: reminderId`.
     - Marca workspace com flag `receivablesMigrated_v1: true` para evitar duplicação.

7. Backend `backend/src/routes/finance.ts` (ou novo arquivo):
   - `GET /api/finance/receivables?workspaceId=...`
   - `POST /api/finance/receivables`
   - `PATCH /api/finance/receivables/:id`
   - `DELETE /api/finance/receivables/:id` (só `canManageWorkspace`)

8. Testes:
   - `tests/unit/receivable-invariants.test.ts`:
     - 50 receivables aleatórios → `aggregateReceivables.projected` == `sum(pending) + sum(overdue)` (com moneyMath).
     - Soma confirmed via receivables == inflowMonth do Dashboard (mesmo mês).
   - `tests/firestore/receivables.rules.test.ts`:
     - Cross-workspace read negado.
     - Update mantém `workspace_id` original.

9. Documentação:
   - `docs/ARCHITECTURE.md` — adicionar nó `Receivable` no modelo.
   - `docs/CHANGELOG.md`.

#### Critério de pronto

- `aggregateReceivables(workspaceId)` retorna `{ confirmed, pending, overdue, projected }` com numbers idênticos centavo a centavo aos calculados no Dashboard e CashFlow.
- `rtk grep "Reminder.*amount" components/Dashboard.tsx components/CashFlow.tsx` retorna zero (substituído por receivables).
- `npm run test:firestore:rules` verde com novos casos de `receivables`.
- `npm run test:coverage:critical` mantém ≥ 98% cobertura.
- Em local dev, criar receivable manual aparece no Dashboard "Previsto" e no CashFlow "Pendente" com o mesmo valor.

#### O que NÃO fazer nesta sessão

- Não remover `Reminder` da tipologia (continua existindo para lembretes não-financeiros).
- Não tocar em IA (S5 já fechou).
- Não criar UI dedicada de Receivables (sessão de produto futura). Por enquanto, manipulação via API ou via fluxos de criação existentes que ajustam o source_ref.

#### Risco da sessão

- Alto: mudança de modelo de dados é cara de reverter. Mitigação:
  - Coexistência: `Reminder` continua existindo; `Receivable` é criado em paralelo, com migração explícita.
  - Feature flag `RECEIVABLES_AS_SOURCE_OF_TRUTH=false` por default; quando true, Dashboard/CashFlow leem de receivables; quando false, leem de Reminders (comportamento atual).
  - Commit final só quando flag puder ser true em prod.
- Médio: Firestore rules adicionais podem quebrar testes de rules existentes. Mitigação: rodar `npm run test:firestore:rules` após cada commit.

---

### Sessão S7 — Observabilidade ativa em produção

ID: `S7`
Prioridade: P1
Esforço estimado: 0.5 dia
Dependência: S0
Achado relacionado: P1-08, P1-05 (parcial — Sentry duplo)

#### Objetivo

Sentry funcionando em produção (DSN ativo, evento de teste chegando), com **um único major** do SDK. Remover `@sentry/tracing@7`.

#### Pré-requisitos

- Acesso ao projeto Sentry (criar se não existir).
- `VITE_SENTRY_DSN` para frontend, `SENTRY_DSN` para backend.

#### Arquivos afetados

Editar:

- `package.json` — remover `@sentry/tracing@7`.
- `src/config/sentry.ts` (frontend) — usar API v10.
- `backend/src/config/sentry.ts` — confirmar API v10.
- `App.tsx:39` — não tocar (já chama `initSentry`).
- `.env.example` — adicionar entradas de DSN.
- Vercel env vars — fora do repo, no painel.
- `docs/SENTRY_SETUP.md` — atualizar.
- `docs/CHANGELOG.md`.

#### Diff esperado

1. `rtk npm uninstall @sentry/tracing`.

2. Em `src/config/sentry.ts`:
   - Garantir que usa API v10 (sem `Sentry.BrowserTracing`; em v10 é via `Sentry.browserTracingIntegration()`).
   - Adicionar guard: se `import.meta.env.PROD && !VITE_SENTRY_DSN`, logar `[Sentry] DSN ausente em producao` (não fatal, mas visível).

3. Vercel:
   - Adicionar `VITE_SENTRY_DSN` no projeto frontend.
   - Adicionar `SENTRY_DSN` no projeto backend.
   - Adicionar `SENTRY_ENVIRONMENT=production`.

4. Validar:
   - `curl https://flow-finance-backend.vercel.app/_test/sentry-error` (criar endpoint só-em-dev, ou usar Sentry CLI/dashboard).
   - Ver evento chegar no Sentry.

5. `docs/SENTRY_SETUP.md`: atualizar instruções, principalmente o passo de DSN.

6. `docs/CHANGELOG.md`:
   ```
   ## 2026-05-15 - Sentry consolidado e ativo
   - @sentry/tracing@7 removido (conflito de API com @sentry/react@10)
   - DSN configurado em producao
   - Browser tracing via API v10
   ```

#### Critério de pronto

- `rtk grep "@sentry/tracing" .` retorna zero.
- `rtk npm install` sem warning de Sentry.
- Bundle não inclui Sentry v7.
- Evento de teste visível no painel Sentry.
- `npm run health:io` verde.

#### O que NÃO fazer nesta sessão

- Não alterar `pages/`.
- Não tocar em auth.

#### Risco da sessão

- Baixo: a mudança é pontual e a API v10 é estável.

---

## Etapa C — Monetização (P1)

### Sessão S8 — Definir paywall, página de pricing e ativar Stripe em produção

ID: `S8`
Prioridade: P1
Esforço estimado: 2 dias
Dependência: S0 (backend Stripe sandbox precisa estar acessível), S4 (escopo enxuto)
Achado relacionado: nota 27 da auditoria, decisão difícil #5

#### Objetivo

Definir 3 features Pro concretas, conectar paywall na UI, criar página de pricing pública e validar Stripe live (não só sandbox).

#### Pré-requisitos

- S0 concluída.
- S4 concluída (escopo já enxuto, definição clara do que está no Free vs Pro).
- Acesso ao Stripe Dashboard para criar produtos e price IDs reais.
- Definir antes de codar:
  - Quais 3 features são Pro? Recomendado: (a) Consultor IA ilimitado, (b) múltiplos workspaces, (c) exportação de relatórios PDF.
  - Preço? Recomendado: R$ 49/mês ou R$ 490/ano.

#### Arquivos afetados

Editar:

- `src/app/monetizationPlan.ts` — definição das features Pro e limites Free.
- `components/UpgradePromptCard.tsx` — copy concreto, CTAs para Stripe Checkout.
- `pages/Settings.tsx` — bloco "Plano" com botão de upgrade.
- Backend `backend/src/routes/saas.ts` — confirmar que checkout aceita o priceId real.

Criar:

- `pages/Pricing.tsx` — página pública de pricing (pode ser rota sem auth ou marketing).
- `tests/unit/monetization-paywall.test.ts` — testes do `canAccessFeature`.

Stripe Dashboard (fora do repo):

- Criar produto "Flow Finance Pro".
- Price mensal R$ 49 e anual R$ 490.
- Webhook configurado para `https://flow-finance-backend.vercel.app/api/saas/billing-hooks`.

Documentação:

- `docs/MONETIZATION_FREE_PRO_PHASE6.md` — atualizar (já existe).
- `docs/CHANGELOG.md`.

#### Diff esperado

1. `src/app/monetizationPlan.ts`:
   ```ts
   export const FREE_LIMITS = {
     workspaces: 1,
     consultorIaQueriesPerMonth: 20,
     reportExportPerMonth: 0,
   };

   export const PRO_FEATURES = {
     unlimitedConsultorIa: true,
     multipleWorkspaces: true,
     reportExport: true,
   };

   export function canAccessFeature(
     plan: 'free' | 'pro',
     feature: keyof typeof PRO_FEATURES,
   ): boolean {
     if (plan === 'pro') return true;
     return false;
   }

   export function withinFreeLimit(
     plan: 'free' | 'pro',
     key: keyof typeof FREE_LIMITS,
     currentUsage: number,
   ): boolean {
     if (plan === 'pro') return true;
     return currentUsage < FREE_LIMITS[key];
   }
   ```

2. `components/UpgradePromptCard.tsx`:
   - Copy curto e operacional: "Consultor IA ilimitado, mais workspaces, exportação. R$ 49/mês."
   - Botão chama `POST /api/saas/stripe/checkout-session` com priceId mensal.
   - Mostra estado de loading e erro com toast.

3. `pages/AICFO.tsx`:
   - Antes de enviar a 21ª query do mês em plano Free, mostrar UpgradePromptCard inline e bloquear.
   - Reset por workspace/mês.

4. `pages/Pricing.tsx`:
   - Tela pública sem auth (rota nova ou subdomínio dependendo da infra).
   - Tabela Free vs Pro com 3 colunas: limite, recurso, decisão.
   - CTA "Começar grátis" e "Assinar Pro".

5. `pages/Settings.tsx`:
   - Bloco "Plano atual" mostrando Free ou Pro.
   - Botão "Gerenciar assinatura" → abre Stripe Billing Portal (já implementado).

6. Validação:
   - Login com user Free → consumir 21 queries → ver paywall.
   - Clicar upgrade → ir ao Stripe Checkout (sandbox primeiro, depois live).
   - Pagar → webhook → workspace vira Pro → paywall some.
   - Abrir billing portal → cancelar → workspace volta a Free (via webhook).

7. `docs/MONETIZATION_FREE_PRO_PHASE6.md`:
   - Atualizar tabela Free/Pro com as 3 features acima e preço.

8. `docs/CHANGELOG.md`:
   ```
   ## 2026-05-15 - Paywall ativo e pricing publico
   - 3 features Pro definidas: Consultor IA ilimitado, multi-workspace, exportacao
   - UpgradePromptCard inline na tela do Consultor IA quando limite Free atingido
   - pages/Pricing.tsx publicado
   ```

#### Critério de pronto

- Usuário Free atinge limite → vê paywall claro.
- Checkout Stripe abre, completa pagamento, webhook eleva workspace.
- Stripe Billing Portal abre e o cancelamento volta para Free.
- `npm run test:coverage:critical` verde.
- `pages/Pricing.tsx` acessível.

#### O que NÃO fazer nesta sessão

- Não criar paywalls em features não decididas.
- Não mexer no schema de Receivable.
- Não tocar em auth (já feito em S3).

#### Risco da sessão

- Médio: a passagem de sandbox para live tem armadilhas (webhook secret diferente, modo live no Stripe). Mitigação: validar primeiro no sandbox com o mesmo fluxo, depois trocar `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` para chaves live.

---

## Etapa D — Polimento (P2)

### Sessão S9 — Tokenização de cores, normalização tipográfica e acessibilidade

ID: `S9`
Prioridade: P2
Esforço estimado: 2 dias
Dependência: S4, S5 (escopo enxuto antes de polir)
Achado relacionado: notas 13, 14, 24; B-V-01, B-V-02, B-V-03

#### Objetivo

Aplicar de fato o `docs/UI_TYPO_COLOR_CONTRACT.md`. Substituir `text-[7px]`/`text-[8px]`/`text-[9px]` e `font-black` em texto operacional. Migrar hex hardcoded para tokens. Adicionar contraste mínimo WCAG AA.

#### Pré-requisitos

- Ler `docs/UI_TYPO_COLOR_CONTRACT.md` e `docs/UI_UX_BASELINE_AUDIT_2026-05-12.md`.
- Ler `src/styles/tailwind.css` para tokens existentes.

#### Arquivos afetados

Editar:

- `src/styles/tailwind.css` — expandir tokens se necessário.
- `components/Dashboard.tsx`, `components/CashFlow.tsx`, `components/Settings.tsx`, `components/TransactionList.tsx`, `components/Assistant.tsx`, `components/AdvancedAnalytics.tsx`, `components/Login.tsx`.
- `pages/AICFO.tsx`, `pages/WorkspaceAdmin.tsx`, `pages/WorkspaceAudit.tsx`.

Documentação:

- `docs/UI_TYPO_COLOR_CONTRACT.md` — atualizar com regras finais e ESLint rule (se aplicável).

#### Diff esperado

1. Substituir todas as ocorrências:
   - `text-[7px]`, `text-[8px]`, `text-[9px]` → `text-xs` (12px).
   - `text-[10px]` → `text-xs` ou `text-[11px]` no máximo.
   - `font-black` (900) em texto operacional → `font-semibold` (600).
   - Cores hex hardcoded em componentes → classes Tailwind ou variáveis CSS.

2. Em `components/CashFlow.tsx:30,77,269-270` e `components/AdvancedAnalytics.tsx:18-29,173-183`:
   - Substituir hex de gráficos por consts no topo do arquivo, e ideialmente movê-las para `src/styles/chartPalette.ts`.

3. ESLint rule customizada (opcional):
   - Bloquear `text-\[[0-9]+px\]` com `< 10`.
   - Bloquear `font-black` em arquivos `components/` e `pages/`.

4. Acessibilidade:
   - Tabs da nav inferior: adicionar `aria-label`, `role="tab"`, `aria-selected`.
   - FAB: `aria-label="Adicionar lançamento"` (já tem).
   - Modais: focus trap se ainda não tiver.

#### Critério de pronto

- `rtk grep -E "text-\[(7|8|9)px\]" components/ pages/` retorna zero.
- `rtk grep "font-black" components/ pages/` retorna zero ou só em hero principal específico aprovado.
- `rtk grep -E "#[0-9a-fA-F]{6}" components/ pages/ | wc -l` ao menos -50% em relação à baseline.
- `npm run lint` verde.
- Captura visual antes/depois das 5 telas principais.

#### O que NÃO fazer nesta sessão

- Não tocar em lógica de negócio.
- Não mexer em testes funcionais.

#### Risco da sessão

- Baixo: mudança cosmética.

---

### Sessão S10 — Code splitting, redução de bundle e correção de versão duplicada

ID: `S10`
Prioridade: P2
Esforço estimado: 1.5 dia
Dependência: S4, S5
Achado relacionado: notas 23, P1-05

#### Objetivo

Reduzir bundle inicial em ~30% via code splitting por rota. Confirmar e corrigir `lucide-react@1.8.0` (se for typosquat). Garantir que cada package tem versão correta.

#### Pré-requisitos

- S4 e S5 concluídas (já cortaram dependências).
- Acesso a `npm` para auditoria.

#### Arquivos afetados

Editar:

- `package.json`, `package-lock.json` — corrigir `lucide-react`.
- `hooks/useNavigationTabs.tsx` — lazy load de páginas.
- `App.tsx` — `Suspense` boundary.
- `vite.config.ts` — `build.rollupOptions.manualChunks` se necessário.

Documentação:

- `docs/CHANGELOG.md`.

#### Diff esperado

1. Verificar `lucide-react@1.8.0`:
   - `rtk npm view lucide-react versions --json` para listar versões oficiais.
   - Se `1.8.0` não constar, **incidente de supply chain**: rotacionar segredos que passaram pelo CI desde a instalação, abrir `docs/SECRET_INCIDENT_CHECKLIST.md`.
   - Substituir por última versão estável: `rtk npm install lucide-react@latest`.
   - Conferir que ícones usados continuam disponíveis (interface mudou entre majors).

2. Code splitting:
   - Em `hooks/useNavigationTabs.tsx`, converter páginas para `React.lazy`:
     ```
     const Dashboard = React.lazy(() => import('../components/Dashboard'));
     const CashFlow = React.lazy(() => import('../components/CashFlow'));
     const AICFO = React.lazy(() => import('../pages/AICFO'));
     // ...
     ```
   - Em `App.tsx`, envolver `navigation.renderActiveTab(navigationContext)` com `<Suspense fallback={<TabLoader />}>`.

3. `vite.config.ts`:
   - Adicionar `manualChunks` separando `recharts`, `firebase`, `@sentry/react`.

4. Medir antes/depois:
   - `rtk npm run build`
   - `du -sh dist/assets`

5. `docs/CHANGELOG.md`:
   ```
   ## 2026-05-15 - Code splitting e correcao de lucide-react
   - Paginas via React.lazy
   - lucide-react corrigido para versao estavel
   - Bundle reduzido em XX% (especificar)
   ```

#### Critério de pronto

- Bundle inicial gzip ≤ 500KB.
- `npm run build` sem warnings.
- Todas as rotas continuam navegando.
- Lighthouse mobile ≥ 70 (rodar local com `rtk npm run build && rtk npm run preview` e Lighthouse no Chrome).

#### O que NÃO fazer nesta sessão

- Não introduzir nova UI lib.
- Não trocar gerenciador de estado.

#### Risco da sessão

- Médio: `React.lazy` pode ter race conditions com testes E2E. Mitigação: aguardar `[data-testid='tab-content']` em todos os specs.
- Alto se `lucide-react@1.8.0` for typosquat: ativar `docs/SECRET_INCIDENT_CHECKLIST.md`.

---

## Matriz de dependências

```
S0  (P0, destrava prod)
 ├─ S2  (P0, audit log)
 ├─ S3  (P1, auth)
 ├─ S7  (P1, sentry)
 └─ S8  (P1, paywall — depende de S0 + S4)

S1  (P0, moneyMath)
 └─ S6  (P1, Receivable — depende de S1 + S2)

S4  (P1, corte de escopo)
 ├─ S5  (P1, AI reduzida)
 ├─ S8  (P1, paywall)
 ├─ S9  (P2, UI)
 └─ S10 (P2, bundle)
```

Paralelização possível:

- S0, S1, S4 podem rodar em paralelo (independentes).
- S2, S3 só depois de S0.
- S5 só depois de S4.
- S6 só depois de S1 e S2.
- S7 só depois de S0.
- S8 só depois de S0 e S4.
- S9, S10 só depois de S4 e S5.

Caminho crítico mínimo (sequencial):

```
S0 → S1 → S2 → S6 → S4 → S5 → S8 → S9 → S10
```

Estimativa do caminho crítico: ~13 dias.

Cronograma com 1 agente em paralelo (2 trilhas):

- Dia 1: S0 + início S1.
- Dia 2: finaliza S1 + S2.
- Dia 3: S3 + início S4.
- Dia 4-5: finaliza S4 + S5.
- Dia 6: S7.
- Dia 7-10: S6.
- Dia 11-12: S8.
- Dia 13-15: S9 + S10.

---

## Critério de pronto agregado (definição de "auditoria fechada")

Esta auditoria está fechada quando:

- [ ] S0: contrato de API em prod responde 200 em `/health`, `/api/health`, `/api/version`.
- [ ] S1: `moneyMath` cobre 100% dos agregados financeiros do frontend; teste invariante verde.
- [ ] S2: audit log persiste em Firestore; rules cobrem casos.
- [ ] S3: stubs de auth removidos; bypass de teste exige token explícito.
- [ ] S4: páginas legadas (Autopilot, OpenBanking, ReceiptScanner) removidas do bundle; dependências pesadas eliminadas; bundle reduzido ≥ 25%.
- [ ] S5: `src/ai/` reduzido para ≤ 8 arquivos; "Autopilot" eliminado da UI e do código.
- [ ] S6: `Receivable` é fonte única para receita prevista; Dashboard e CashFlow leem do mesmo agregado.
- [ ] S7: Sentry ativo em produção com SDK único.
- [ ] S8: paywall na 21ª query do Consultor IA Free; checkout e portal Stripe funcionando em live.
- [ ] S9: tipografia e cores conforme `UI_TYPO_COLOR_CONTRACT.md`; acessibilidade básica WCAG AA.
- [ ] S10: bundle ≤ 500KB gzip; `lucide-react` em versão oficial.
- [ ] Nota agregada na próxima auditoria ≥ 7.5/10.

---

## Apêndice — Comandos de validação reutilizáveis

Antes de qualquer sessão:

```bash
rtk git status
rtk npm run lint
```

Depois de qualquer sessão que toque código:

```bash
rtk npm run lint
rtk npm run test:coverage:critical
```

Sessões que mudam fluxo de usuário (S4, S5, S6, S8):

```bash
rtk npx playwright test --project=chromium --workers=1
```

Sessões que mexem em rules ou auth (S2, S3, S6):

```bash
rtk npm run test:firestore:rules
rtk npm run test:backend
```

Sessões que tocam deploy (S0, S7):

```bash
VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app rtk npm run health:vercel
```

Auditoria de segredos (sempre, antes do push):

```bash
rtk npm run security:scan-secrets
```

---

## Apêndice — O que NÃO entra neste plano

Coisas observadas na auditoria que ficaram fora deste plano por serem polimento adicional, não regressão:

- Migração de `components/` e `services/` para dentro de `src/` (refactor estrutural maior, custo > benefício imediato).
- Documentação de architecture diagram visual.
- Substituição de `recharts` por lib menor.
- Internacionalização além de PT-BR.
- App store mobile listing (iOS/Android).
- LGPD compliance documentado.

Esses entram em ciclos futuros depois que o caminho crítico fechar.
