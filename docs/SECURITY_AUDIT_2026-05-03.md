# Flow Finance — Relatório de Auditoria de Segurança

**Data:** 2026-05-03  
**Versão auditada:** 0.9.6  
**Stack:** React + TypeScript (Vite), Express + TypeScript, Firebase/Firestore  
**Auditor:** GitHub Copilot (security-best-practices skill)  

---

## Resumo Executivo

Quatro vulnerabilidades identificadas e corrigidas nesta sessão. Nenhuma crítica (exploração requer usuário autenticado ou backend comprometido). O projeto já possui boas práticas consolidadas: Helmet ativo, CORS configurável, rate limiting por usuário e por IP, Zod para validação de schemas, Firestore Rules com controle de tenant/workspace, e insecure local login bloqueado em produção.

---

## Achados por Severidade

### HIGH

#### SEC-001 — Open Redirect via `returnUrl` nas rotas Stripe
- **Status:** ✅ CORRIGIDO
- **Localização:** `backend/src/validation/saas.schema.ts:43,47` | `backend/src/routes/saas.ts:199,214`
- **Evidência (antes):** `returnUrl: z.string().url()` — aceita qualquer URL válida, incluindo `https://evil.com`
- **Impacto:** Usuário autenticado com plano pago poderia ser redirecionado para domínio externo após Stripe checkout/portal, expondo sessões ou enganando o usuário.
- **Fix aplicado:** `safeReturnUrl()` valida que a origem da URL está na allowlist (`FRONTEND_URL` + `ALLOWED_ORIGINS`). Em dev/localhost, permite localhost sem restrição.

---

### MEDIUM

#### SEC-002 — DOM XSS potencial via `innerHTML` nos runtime guards
- **Status:** ✅ CORRIGIDO
- **Localização:** `src/runtime/runtimeGuard.ts:122-129` | `src/runtime/versionGuard.ts:179-180`
- **Evidência (antes):** `<strong>${issue.guard}</strong>: ${issue.message}` e `v${localVersion} / v${backendVersion}` interpolados diretamente em `innerHTML`
- **Impacto:** `backendVersion` e `issue.message` vêm parcialmente de respostas do backend (API de health/version). Backend comprometido ou MITM poderia injetar HTML/JS executável no contexto da página.
- **Fix aplicado:** Função `escapeHtml()` adicionada em ambos os arquivos. Todas as interpolações de dados externos em `innerHTML` usam `escapeHtml(value)`.

#### SEC-003 — Query params logados em todas as requisições HTTP
- **Status:** ✅ CORRIGIDO
- **Localização:** `backend/src/index.ts:133` (logging middleware)
- **Evidência (antes):** `query: _req.query` incluído no log de cada request
- **Impacto:** Tokens, IDs ou dados sensíveis passados como query params aparecem em todos os logs de request — amplia superfície de vazamento em caso de comprometimento de logs.
- **Fix aplicado:** Campo `query` removido do log padrão. Comentário explica a razão. Logging de query pode ser adicionado seletivamente por rota após scrubbing.

---

### LOW

#### SEC-004 — Limite do body parser excessivamente alto (10mb)
- **Status:** ✅ CORRIGIDO
- **Localização:** `backend/src/index.ts:141-146`
- **Evidência (antes):** `express.json({ limit: '10mb' })` e `express.urlencoded({ limit: '10mb' })`
- **Impacto:** Aumenta o custo de ataques de DoS por volume — cada request pode consumir até 10mb de memória em parsing. Para uma API que processa JSON de transações e configurações, 1mb é suficiente.
- **Fix aplicado:** Limite reduzido para `1mb`. Rotas que precisam de payloads maiores (ex.: import de OFX/CSV) podem usar middleware específico com limite próprio.

---

## Achados Não Corrigidos (aceitáveis)

| ID | Descrição | Justificativa |
|----|-----------|---------------|
| N/A | Firebase API Key em `.env.local` | Firebase API keys são projetadas para serem públicas; segurança garantida pelas Firestore Security Rules. `.env.local` não é comitado. |
| N/A | `innerHTML` estático em `index.tsx` e guards (conteúdo hardcoded) | Conteúdo é literal de template sem interpolação de dados externos. Sem risco real. |
| N/A | `Logo.tsx` usa `dangerouslySetInnerHTML` com template literal estático | CSS injetado é string de build-time sem inputs externos. Sem risco real. |

---

## Boas Práticas Confirmadas

- ✅ `helmet()` ativo no servidor Express
- ✅ CORS configurado por allowlist via env vars (`ALLOWED_ORIGINS`, `FRONTEND_URL`)
- ✅ `trust proxy` configurável e testado (`resolveTrustProxySetting`)
- ✅ Rate limiting por IP (`apiLimiter`) e por usuário (`rateLimitByUser`) em rotas críticas
- ✅ Zod para validação de schemas em todas as rotas principais
- ✅ Firestore Rules com controle rigoroso de tenant/workspace/role
- ✅ Insecure local login bloqueado em produção (`AUTH_ALLOW_INSECURE_LOCAL_LOGIN`)
- ✅ Refresh token rotation implementada
- ✅ HMAC para validação de webhooks externos (clínica/Pluggy)
- ✅ Auditlog de eventos de autenticação
- ✅ Sem secrets hardcoded no código fonte

---

## Arquivos Alterados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `backend/src/validation/saas.schema.ts` | SEC-001: `safeReturnUrl()` com allowlist |
| `src/runtime/runtimeGuard.ts` | SEC-002: `escapeHtml()` + escape em `issuesList` |
| `src/runtime/versionGuard.ts` | SEC-002: `escapeHtml()` + escape em versões |
| `backend/src/index.ts` | SEC-003: remove `query` do log; SEC-004: limite 10mb→1mb |
