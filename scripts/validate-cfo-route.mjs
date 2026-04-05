#!/usr/bin/env node

const baseUrl = (process.env.CFO_BASE_URL || '').trim().replace(/\/$/, '');
const token = (process.env.CFO_TOKEN || '').trim();
const workspaceId = (process.env.CFO_WORKSPACE_ID || '').trim();

function printUsageAndExit() {
  console.error('Uso:');
  console.error('  CFO_BASE_URL=https://api.example.com CFO_TOKEN=<token> CFO_WORKSPACE_ID=<workspaceId> npm run validate:cfo:route');
  process.exit(1);
}

if (!baseUrl || !token || !workspaceId) {
  printUsageAndExit();
}

async function post(path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status: response.status, payload };
}

function assertStatus(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
  }
  console.log(`OK: ${label} -> ${actual}`);
}

async function run() {
  console.log('Validando rota protegida /api/ai/cfo...');

  const noAuth = await post('/api/ai/cfo', { question: 'Posso gastar este mes?' }, {
    'x-workspace-id': workspaceId,
  });
  assertStatus(noAuth.status, 401, 'Sem Authorization deve retornar 401');

  const noWorkspace = await post('/api/ai/cfo', { question: 'Posso gastar este mes?' }, {
    Authorization: `Bearer ${token}`,
  });
  assertStatus(noWorkspace.status, 400, 'Sem x-workspace-id deve retornar 400');

  const invalidIntent = await post('/api/ai/cfo', {
    question: 'Qual meu saldo?',
    intent: 'intent_invalida',
  }, {
    Authorization: `Bearer ${token}`,
    'x-workspace-id': workspaceId,
  });
  assertStatus(invalidIntent.status, 400, 'Intent invalida deve retornar 400');

  const validRequest = await post('/api/ai/cfo', {
    question: 'Posso gastar este mes?',
    context: 'Saldo atual: 2500',
    intent: 'spending_advice',
  }, {
    Authorization: `Bearer ${token}`,
    'x-workspace-id': workspaceId,
  });

  assertStatus(validRequest.status, 200, 'Request valida deve retornar 200');

  if (!validRequest.payload || typeof validRequest.payload.answer !== 'string') {
    throw new Error('Resposta valida sem campo answer');
  }

  console.log('OK: payload contem answer');
  console.log('Validacao finalizada com sucesso.');
}

run().catch((error) => {
  console.error('Falha na validacao da rota CFO:', error.message);
  process.exit(1);
});
