---
status: investigating
trigger: "Diagnosticar o bloqueio de sessão/autenticação que impede o uso da IA no app."
created: 2026-04-25T00:00:00-03:00
updated: 2026-04-25T00:00:00-03:00
---

## Current Focus

hypothesis: Confirmada — backend local não consegue emitir token/sessão para o frontend (Firebase exchange indisponível + fallback inseguro bloqueado + CORS de produção), então toda rota de IA falha em 401 por falta de token.
test: Leitura de código/config: requisitos de verificação Firebase, gate do login legado, política de CORS e exigência de auth em /api/ai.
expecting: Evidência de: (1) falta de FIREBASE_* ou GOOGLE_APPLICATION_CREDENTIALS; (2) NODE_ENV=production bloqueando login legado e loopback CORS; (3) rotas /api/ai protegidas por authMiddleware.
next_action: Entregar diagnóstico com configuração mínima para destravar IA local.

## Symptoms

expected: IA funcionar após login (token backend válido disponível no frontend).
actual: IA não funciona; endpoints de IA retornam 401 e UI cai em fallback.
errors: ""
reproduction: ""
started: ""

## Eliminated

## Evidence

- timestamp: 2026-04-25T00:00:00-03:00
  checked: backend/src/services/auth/firebaseIdentityService.ts
  found: Backend só troca idToken do Firebase se tiver FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (service account) ou GOOGLE_APPLICATION_CREDENTIALS; caso contrário, firebaseSessionController retorna 503.
  implication: Sem essas envs no backend local, o endpoint /api/auth/firebase-session não consegue emitir JWT para o frontend.

- timestamp: 2026-04-25T00:00:00-03:00
  checked: backend/.env.local + backend/src/config/env.ts
  found: backend/.env.local não define FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY nem GOOGLE_APPLICATION_CREDENTIALS.
  implication: Firebase -> backend session exchange está indisponível neste ambiente do backend.

- timestamp: 2026-04-25T00:00:00-03:00
  checked: backend/src/controllers/authController.ts + backend/.env.local
  found: /api/auth/login (email/senha) está bloqueado a menos que AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true E NODE_ENV seja development/test; backend/.env.local define NODE_ENV=\"production\".
  implication: O fallback de desenvolvimento (email/senha) fica efetivamente desabilitado no backend.

- timestamp: 2026-04-25T00:00:00-03:00
  checked: backend/src/config/cors.ts + backend/.env.local
  found: Em NODE_ENV=production, origens loopback (localhost/127.0.0.1) são filtradas/negadas; backend/.env.local aponta FRONTEND_URL/CORS_ORIGIN para domínio Vercel.
  implication: Rodando backend local com NODE_ENV=production, chamadas do frontend local tendem a falhar por CORS (incluindo bootstrap de sessão e chamadas de IA).

- timestamp: 2026-04-25T00:00:00-03:00
  checked: hooks/useAuthAndWorkspace.ts + src/services/backendSession.ts
  found: Frontend tenta trocar Firebase idToken por token backend via AUTH.FIREBASE_SESSION; se falhar e estiver em DEV + VITE_AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true, cai para /api/auth/login com password \"firebase-session\"; se isso falhar, não seta token e backendSyncEnabled permanece false.
  implication: Falha em /api/auth/firebase-session + bloqueio do /api/auth/login explica ausência de token e 401 nos endpoints protegidos (incluindo IA).

## Resolution

root_cause: "Backend local está efetivamente em modo produção (NODE_ENV=production), sem credenciais de verificação do Firebase (FIREBASE_* ou GOOGLE_APPLICATION_CREDENTIALS) e com CORS bloqueando loopback; isso impede o exchange Firebase idToken -> JWT e também bloqueia o fallback inseguro /api/auth/login, então o frontend nunca obtém token/sessão backend e os endpoints de IA retornam 401."
fix: "Configurar backend local como development e liberar CORS para localhost; e escolher 1 caminho: (A) configurar credenciais Firebase Admin para habilitar /api/auth/firebase-session, ou (B) manter fallback legado habilitado em dev (AUTH_ALLOW_INSECURE_LOCAL_LOGIN=true) para emitir JWT via /api/auth/login quando o exchange falhar."
verification: "N/A (modo diagnose-only)."
files_changed: []
