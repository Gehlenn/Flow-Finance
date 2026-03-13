# Open Finance Go Live Plan

## Objetivo
Levar o fluxo Open Finance (Pluggy) para operacao estavel e validada ponta a ponta, com seguranca, persistencia e observabilidade.

## Escopo validado
- Frontend Open Banking/Pluggy: pronto para fluxo real quando backend estiver disponivel.
- Backend banking routes: implementadas e protegidas por autenticacao.
- Persistencia: suporta memoria (default), Firebase e PostgreSQL (opcional).
- Webhook Pluggy: endpoint implementado com suporte a secret.

## Fase 0 - Preflight tecnico

### 0.1 Backend e frontend sobem sem erro
Comandos:

```bash
# terminal 1 (backend)
cd backend
npm install
npm run build
npm run dev

# terminal 2 (frontend)
cd ..
npm install
npm run dev -- --port 4173 --strictPort
```

Criterio de aceite:
- Backend respondendo em /api/health.
- Frontend respondendo em http://localhost:4173.

### 0.2 Testes base da stack
Comandos:

```bash
npm run lint
npm test
npm run test:coverage:critical
npm run test:e2e
```

Criterio de aceite:
- Todos verdes antes de ativar Pluggy em ambiente alvo.

## Fase 1 - Configuracao de ambiente Open Finance

### 1.1 Variaveis obrigatorias no backend/.env
Configurar:

- OPEN_FINANCE_PROVIDER=pluggy
- PLUGGY_CLIENT_ID=<seu_client_id>
- PLUGGY_CLIENT_SECRET=<seu_client_secret>
- PLUGGY_BASE_URL=https://api.pluggy.ai

Opcional recomendado:
- PLUGGY_BANK_CONNECTORS={"nubank":201,"itau":176}
- PLUGGY_WEBHOOK_SECRET=<segredo_compartilhado>

Criterio de aceite:
- /api/banking/health retorna providerMode=pluggy e pluggyConfigured=true.

### 1.2 CORS para ambiente real
Configurar FRONTEND_URL no backend para dominio(s) corretos (pode ser lista separada por virgula).

Criterio de aceite:
- Sem bloqueio CORS para chamadas /api/banking/* vindas do frontend oficial.

## Fase 2 - Persistencia e resiliencia

### 2.1 Ativar Firebase para conexoes bancarias
No backend/.env:

- OPEN_FINANCE_STORE_DRIVER=firebase
- FIREBASE_PROJECT_ID=<firebase_project_id>
- FIREBASE_CLIENT_EMAIL=<firebase_client_email>
- FIREBASE_PRIVATE_KEY=<firebase_private_key>

Opcional (apenas se escolher PostgreSQL no futuro):

```bash
cd backend
psql "$DATABASE_URL" -f sql/migrations/001_create_bank_connections.sql
```

Criterio de aceite:
- /api/banking/health retorna persistenceEnabled=true e persistenceReady=true.
- Conexao bancaria persiste apos restart do backend.

### 2.2 Validar restart sem perda de estado
Teste:
1. Conectar banco via UI.
2. Reiniciar backend.
3. Reabrir UI e confirmar conexao listada.

Criterio de aceite:
- Nenhuma perda de conexao apos restart.

## Fase 3 - Fluxo funcional ponta a ponta

### 3.1 Jornada principal
Validar em ambiente com Pluggy ativo:
1. Login no app (token backend presente em auth_token).
2. Abrir Open Banking.
3. Gerar connect-token.
4. Conectar item no widget Pluggy.
5. Registrar conexao no backend.
6. Executar sync.
7. Ver saldo e transacoes importadas.
8. Desconectar banco.

Criterio de aceite:
- Todas etapas concluem sem erro 4xx/5xx nao esperado.
- Sync atualiza status, last_sync e saldo.

### 3.2 E2E dedicado Open Banking
Comandos:

```bash
# com backend rodando em 3001
npx playwright test tests/e2e/open-banking-pluggy.spec.ts --project=chromium --workers=1
```

Observacao:
- O teste pode pular quando backend nao estiver ativo ou quando nao houver sessao autenticada disponivel no fluxo.

Criterio de aceite:
- Cenarios nao devem pular em ambiente de validacao oficial.
- Resultado esperado: teste executado e verde.

## Fase 4 - Webhook e sincronizacao assincrona

### 4.1 Publicar endpoint de webhook
Endpoint:
- POST /api/banking/webhooks/pluggy

Configurar Pluggy com URL publica:
- https://<dominio-backend>/api/banking/webhooks/pluggy?secret=<PLUGGY_WEBHOOK_SECRET>

Criterio de aceite:
- Eventos recebidos e processados.
- Conexoes relacionadas ao item recebem update de status/saldo quando aplicavel.

### 4.2 Teste de falha controlada
Simular erro de refresh no webhook e confirmar fallback:
- conexao marcada com status error
- error_message preenchido

Criterio de aceite:
- Falha observavel e recuperavel, sem inconsistencia silenciosa.

## Fase 5 - Observabilidade e seguranca

### 5.1 Logs operacionais
Garantir log estruturado para:
- connect sucesso/falha
- sync sucesso/falha
- webhook recebido/processado/falha

Criterio de aceite:
- Eventos rastreaveis por userId, connectionId e itemId.

### 5.2 Seguranca minima
Checklist:
- Nao expor PLUGGY_CLIENT_SECRET no frontend.
- Webhook protegido por secret.
- Rotas /api/banking (exceto health/webhook) com auth middleware.
- CORS restrito aos dominios autorizados.

Criterio de aceite:
- Revisao de seguranca sem achados criticos.

## Criterio de Go Live
Aprovado somente quando TODOS os itens abaixo estiverem completos:

1. Preflight e suites base verdes.
2. providerMode=pluggy e pluggyConfigured=true.
3. Persistencia Firebase ativa e validada apos restart.
4. Jornada ponta a ponta executada com sucesso.
5. E2E Open Banking sem skip no ambiente oficial.
6. Webhook Pluggy funcional com secret.
7. Logs e seguranca revisados sem bloqueadores.

## Rollback plan
Se houver incidente apos ativacao:

1. Trocar OPEN_FINANCE_PROVIDER para mock.
2. Reiniciar backend.
3. Manter frontend operacional com fluxo simulado.
4. Abrir incidente com evidencias:
   - timestamp
   - endpoint
   - payload/resposta
   - logs correlacionados

## Evidencias a anexar no PR/Release
- Prints de /api/banking/health antes e depois.
- Resultado do E2E Open Banking.
- Resultado de lint/test/test:coverage:critical/test:e2e.
- Prova de persistencia apos restart.
- Prova de webhook recebido/processado.

## Checklist Firebase-First (Staging -> Producao)

Objetivo:
- Operar Open Finance sem PostgreSQL, com persistencia em Firebase para conexoes bancarias.

### A. Variaveis obrigatorias no backend
Definir no ambiente de deploy:

- OPEN_FINANCE_PROVIDER=pluggy
- OPEN_FINANCE_STORE_DRIVER=firebase
- PLUGGY_CLIENT_ID=<client_id>
- PLUGGY_CLIENT_SECRET=<client_secret>
- PLUGGY_WEBHOOK_SECRET=<webhook_secret>
- FIREBASE_PROJECT_ID=<firebase_project_id>
- FIREBASE_CLIENT_EMAIL=<firebase_client_email>
- FIREBASE_PRIVATE_KEY=<firebase_private_key>
- FRONTEND_URL=<dominio_frontend>

Observacao:
- Nao habilitar OPEN_FINANCE_POSTGRES_ENABLED quando a estrategia for Firebase-first.

### B. Deploy em staging
1. Aplicar variaveis acima no backend de staging.
2. Fazer deploy/restart do backend.
3. Validar health:

```bash
curl -s https://<staging-backend>/api/banking/health
```

Esperado:
- providerMode=pluggy
- persistenceDriver=firebase
- persistenceReady=true
- webhookSecretConfigured=true

### C. Migracao de conexoes do usuario atual para Firebase
Quando houver conexoes criadas antes em memoria, executar uma vez por usuario autenticado:

```bash
curl -X POST https://<staging-backend>/api/banking/migrate/firebase \
   -H "Authorization: Bearer <jwt>" \
   -H "Content-Type: application/json" \
   -d '{"userId":"<user_id_autenticado>"}'
```

Esperado:
- targetDriver=firebase
- migratedUsers >= 1
- migratedConnections >= 0

### D. Smoke test funcional em staging
Executar fluxo minimo:
1. Login no app.
2. Abrir Open Banking.
3. Gerar connect-token.
4. Conectar item no Pluggy.
5. Sincronizar.
6. Reiniciar backend.
7. Reabrir tela e confirmar conexao ainda listada.

Comando adicional recomendado:

```bash
npx playwright test tests/e2e/open-banking-pluggy.spec.ts --project=chromium --workers=1
```

### E. Smoke test de webhook em staging
Validar secret do webhook:

1. Sem secret -> 401
2. Secret invalido -> 401
3. Secret valido -> 202

Exemplo:

```bash
curl -i -X POST "https://<staging-backend>/api/banking/webhooks/pluggy?secret=<PLUGGY_WEBHOOK_SECRET>" \
   -H "Content-Type: application/json" \
   -d '{"event":"item/updated","itemId":"test-item"}'
```

### F. Go/No-Go para producao
Somente promover para producao quando:

1. /api/banking/health em staging mostrar persistenceDriver=firebase e persistenceReady=true.
2. Fluxo de conexao + sync + restart sem perda de estado estiver aprovado.
3. Webhook com secret estiver aprovado (401/401/202).
4. npm run lint, npm test e npm run test:coverage:critical estiverem verdes no commit candidato.

## Execucao assistida (2026-03-12)

Status desta rodada de validacao:

- Fase 0.1 (backend/frontend): APROVADO
   - /api/health: 200
   - /api/banking/health: 200

- Fase 0.2 (gates de qualidade): APROVADO
   - npm run lint: verde
   - npm test: verde
   - npm run test:coverage:critical: verde (100/98.9/100/100)
   - npm run test:e2e: verde (30 passed, 35 skipped)

- Fase 1 (configuracao Open Finance): PARCIAL
   - providerMode=pluggy: OK
   - pluggyConfigured=true: OK
   - webhookSecretConfigured=true: OK (validado em execucao assistida)
   - persistenceDriver=memory: PENDENTE migrar para Firebase em go-live

- Fase 3.2 (E2E dedicado Pluggy): APROVADO
   - tests/e2e/open-banking-pluggy.spec.ts: passed
   - Ajustes aplicados:
      - autenticacao backend no teste antes do connect-token
      - uso de clientUserId coerente com o userId autenticado
      - validacao explicita para nao aceitar 401/403 no probe de token

- Hardening operacional aplicado
   - CORS backend ajustado para combinar origens padrao + FRONTEND_URL configurado,
     evitando exclusao acidental de origens locais (ex: http://localhost:4173)
    - Preflight validado: OPTIONS /api/auth/login com Origin http://localhost:4173
       retornando 204 com Access-Control-Allow-Origin=http://localhost:4173
   - Webhook secret validado em runtime:
      - POST /api/banking/webhooks/pluggy sem secret -> 401
      - POST /api/banking/webhooks/pluggy?secret=wrong-secret -> 401
      - POST /api/banking/webhooks/pluggy?secret=<valido> -> 202 (received=true)

Bloqueadores objetivos para fechar 100%:

1. Propagar PLUGGY_WEBHOOK_SECRET no ambiente alvo (staging/producao) e repetir a mesma validacao de status HTTP.
2. Habilitar persistencia Firebase e validar restart sem perda de conexoes.

## Validacao operacional complementar (2026-03-12)

Evidencias desta rodada local:

- GET /api/banking/health -> 200
   - providerMode=pluggy
   - pluggyConfigured=true
   - webhookSecretConfigured=false
   - persistenceDriver=memory
   - persistenceReady=true

- POST /api/auth/login -> 200 (token obtido)
- POST /api/banking/migrate/firebase -> 503
   - resultado esperado quando credenciais Firebase Admin nao estao configuradas no runtime

- Webhook Pluggy (runtime atual sem secret configurado):
   - sem secret -> 202
   - secret invalido -> 202
   - secret de exemplo -> 202

Conclusao objetiva:
- Checklist Firebase-first ainda BLOQUEADO no ambiente atual por falta de configuracao de secrets Firebase e PLUGGY_WEBHOOK_SECRET no runtime.
- Assim que as variaveis obrigatorias forem aplicadas no ambiente alvo, repetir os testes das secoes B, C, D e E do checklist para liberar o Go/No-Go.

## Validacao final Firebase-first (2026-03-13)

Resultado apos configuracao correta do Firebase Admin SDK e ajuste no adapter Firestore:

- GET /api/banking/health -> 200
   - providerMode=pluggy
   - pluggyConfigured=true
   - webhookSecretConfigured=true
   - persistenceDriver=firebase
   - persistenceReady=true

- POST /api/banking/migrate/firebase -> 200
   - sourceDriver=firebase
   - targetDriver=firebase
   - migratedUsers=1
   - migratedConnections=0

- Prova operacional de persistencia apos restart -> APROVADA
   - backend iniciado com OPEN_FINANCE_PROVIDER=mock e store Firebase ativo
   - conexao criada via POST /api/banking/connect
   - connectionId preservado apos restart do backend
   - GET /api/banking/connections retornou a mesma conexao apos reinicializacao
   - observacao: a validacao com banco real continua dependendo de consentimento/MFA humano no widget Pluggy

- Webhook Pluggy validado em runtime:
   - sem secret -> 401
   - secret invalido -> 401
   - secret valido -> 202

- Regressao corrigida no backend:
   - causa raiz: chamada repetida de firestore.settings() em multiplas instancias do adapter Firebase
   - status: corrigido com guarda de inicializacao unica e teste unitario dedicado

Conclusao final:
- Estrategia Firebase-first aprovada no ambiente local.
- Open Finance pode operar sem PostgreSQL, com persistencia Firebase ativa e webhook protegido por secret.

## Checklist final de deploy (staging/producao)

Aplicar no backend do ambiente alvo:

- OPEN_FINANCE_PROVIDER=pluggy
- OPEN_FINANCE_STORE_DRIVER=firebase
- OPEN_FINANCE_POSTGRES_ENABLED=false
- PLUGGY_CLIENT_ID=<client_id>
- PLUGGY_CLIENT_SECRET=<client_secret>
- PLUGGY_WEBHOOK_SECRET=<webhook_secret>
- FIREBASE_PROJECT_ID=<project_id>
- FIREBASE_CLIENT_EMAIL=<service_account_email>
- FIREBASE_PRIVATE_KEY=<service_account_private_key>
- FRONTEND_URL=<dominio_frontend>

Sequencia obrigatoria:

1. Atualizar secrets/vars no provider de deploy.
2. Fazer restart/deploy do backend.
3. Validar GET /api/banking/health.
4. Validar webhook com 401/401/202.
5. Validar conexao real no widget Pluggy.
6. Confirmar persistencia apos restart.

Criterio de aceite:

1. persistenceDriver=firebase
2. persistenceReady=true
3. webhookSecretConfigured=true
4. connect-token funcional
5. conexao bancaria real listada apos restart

## Roteiro de validacao manual com banco real

Objetivo:
- Fechar a ultima prova funcional ponta a ponta com consentimento humano real no Pluggy.

Passos:

1. Fazer login no app com usuario de teste controlado.
2. Abrir Open Banking.
3. Gerar connect-token.
4. Escolher um banco suportado no widget Pluggy.
5. Concluir consentimento, autenticacao e MFA no fluxo do banco.
6. Confirmar que a conexao aparece em /api/banking/connections.
7. Reiniciar o backend.
8. Reabrir a tela e confirmar que a mesma conexao continua listada.
9. Disparar sync e validar atualizacao de status/saldo.

Evidencias minimas:

1. print ou payload de /api/banking/health
2. print da conexao criada no frontend
3. resposta de /api/banking/connections antes do restart
4. resposta de /api/banking/connections apos o restart
5. evidencia do webhook com secret valido retornando 202
