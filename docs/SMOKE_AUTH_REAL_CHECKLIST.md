# Smoke Auth Real - Checklist Operacional

Objetivo: validar o fluxo real de autenticacao (sem mock) no Flow Finance.

## 1. Pre requisitos locais

1. Criar ou atualizar `.env.local` usando `.env.local.example`.
2. Definir pelo menos uma URL de backend:
   - `VITE_BACKEND_URL` ou
   - `VITE_API_PROD_URL`
3. Definir chaves Firebase web no frontend:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`

## 2. Checagem automatica de readiness

Rodar:

```bash
node scripts/check-local-auth-readiness.mjs
```

Saidas esperadas:
- `READY`: ambiente pronto para smoke real
- `NOT READY`: faltam chaves obrigatorias

Modo JSON:

```bash
node scripts/check-local-auth-readiness.mjs --json
```

## 3. Validacao de backend publicado

Rodar:

```bash
VERCEL_TARGET_URL=https://flow-finance-backend.vercel.app npm run health:vercel
```

Esperado:
- `/health` = 200
- `/api/health` = 200
- `/api/version` = 200

## 4. Smoke funcional real (manual)

1. Abrir app local (`npm run dev`) ou frontend publicado.
2. Fazer login real (Google ou Microsoft) com conta autorizada no Firebase do projeto.
3. Confirmar criacao/resolucao de workspace ativo.
4. Validar dashboard carrega sem erro de contexto.
5. Navegar para Ajustes -> Workspace Admin.
6. Validar que o estado de billing reflete permissao real (owner/admin vs viewer).
7. Executar uma chamada protegida (ex.: acao de billing/workspace) sem erro 401/403 inesperado.

## 5. Evidencias minimas

- Print da autenticacao concluida
- Print do workspace ativo
- Print do estado de billing/admin
- Resultado do health backend
- Resultado do `check-local-auth-readiness`

## 6. Criterio de conclusao

Considerar o smoke real aprovado somente se:
- readiness local estiver `READY`
- health de backend estiver aprovado
- login real concluir
- workspace e billing carregarem sem regressao de permissao
