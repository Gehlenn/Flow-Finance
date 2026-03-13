# Go / No-Go — Open Finance Firebase-first (v0.5.1v)

**Data:** 13 de Março de 2026  
**Branch:** `hardening-architecture`  
**Release label:** `0.5.1v (Open Finance Transition)`  
**Responsável técnico:** eng. Flow Finance

---

## Critérios obrigatórios de aprovação (Go)

| # | Critério | Evidência necessária | Status |
|---|----------|----------------------|--------|
| 1 | Build do backend sem erros TypeScript | `npm run build` saída `0 errors` | ✅ Confirmado |
| 2 | Lint sem warnings críticos | `npm run lint` saída `0 problems` | ✅ Confirmado |
| 3 | Suite de testes unitários passing | `npm test` — 263 testes, 0 falhas | ✅ Confirmado |
| 4 | Cobertura crítica ≥ 98% | `npm run test:coverage:critical` — Stmts 100%, Branches 98.9% | ✅ Confirmado |
| 5 | E2E passando com backend ativo | `npm run test:e2e` — 33 passed, 0 failed | ✅ Confirmado |
| 6 | Health endpoint retorna `persistenceReady=true` com driver `firebase` | `GET /api/banking/health` | ✅ Confirmado |
| 7 | Rota de migração retorna `200` | `POST /api/banking/migrate` | ✅ Confirmado |
| 8 | Webhook rejeita requisições não-assinadas | `POST /api/banking/webhook` → `401` sem header | ✅ Confirmado |
| 9 | Webhook aceita requisições assinadas corretamente | `POST /api/banking/webhook` com HMAC correto → `202` | ✅ Confirmado |
| 10 | `OPEN_FINANCE_PROVIDER` só aceita `mock` ou `pluggy` | `isSupportedOpenFinanceProvider` — testes unitários passando | ✅ Confirmado |
| 11 | Persistência sobrevive a restart | `connectionId` igual antes e após reinicialização do backend | ✅ Confirmado |
| 12 | Commit com mensagem de release padronizada | `0b7bb79 chore(release): initiate 0.5.1v …` | ✅ Confirmado |

---

## Critérios condicionais (pendentes de ambiente externo)

| # | Critério | Responsável | Status |
|---|----------|-------------|--------|
| 13 | Variáveis de staging/prod injetadas no provedor | DevOps / Owner | ⏳ Pendente |
| 14 | `GET /api/banking/health` em staging retorna `persistenceReady=true` | QA / Owner | ⏳ Pendente |
| 15 | Validação manual com banco real via Pluggy widget | Owner (MFA/consent) | ⏳ Pendente |
| 16 | Evidências de produção coletadas (5 prints conforme GO_LIVE_PLAN) | Owner | ⏳ Pendente |

---

## Critérios de bloqueio (No-Go automático)

- ❌ Qualquer teste unitário falhando
- ❌ Cobertura crítica abaixo de 98%
- ❌ Build com erros TypeScript
- ❌ Health endpoint retornando `persistenceReady=false` em staging/prod
- ❌ Vazamento de credenciais Firebase em logs ou respostas HTTP
- ❌ Webhook aceitando requisições sem assinatura HMAC válida

---

## Resultado da avaliação local

```
BUILD:    ✅ OK  (0 TypeScript errors)
LINT:     ✅ OK  (0 problems)
TESTS:    ✅ OK  (263 passed, 0 failed)
COVERAGE: ✅ OK  (Stmts 100% | Branches 98.9% | Funcs 100% | Lines 100%)
E2E:      ✅ OK  (33 passed, 32 skipped backend-optional, 0 failed)
```

**Decisão local:** ✅ **GO** — todos os critérios locais atendidos.  
**Decisão de staging/prod:** ⏳ Aguardando injeção de variáveis e validação manual.

---

## Próximos passos para Go completo

1. Injetar as variáveis listadas em `backend/README.md` → seção *"Staging / production variables (Firebase-first)"*.
2. Confirmar `/api/banking/health` em staging com `persistenceDriver=firebase` e `persistenceReady=true`.
3. Executar o roteiro de 9 passos em `docs/OPEN_FINANCE_GO_LIVE_PLAN.md` → seção *"Roteiro de validacao manual com banco real"*.
4. Coletar as 5 evidências e assinar o sign-off abaixo.

---

## Sign-off

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Engenharia | | | |
| Produto / Owner | | | |
| QA | | | |

> Após sign-off completo, mover este arquivo para `docs/releases/GO_NO_GO_v0.5.1v_SIGNED.md`.
