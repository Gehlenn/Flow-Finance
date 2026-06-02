#!/usr/bin/env node

const baseUrl = (process.env.CFO_BASE_URL || '').trim().replace(/\/$/, '');
const token = (process.env.CFO_TOKEN || '').trim();
const workspaceId = (process.env.CFO_WORKSPACE_ID || '').trim();

function printUsageAndExit() {
  process.stderr.write('Uso:\n');
  process.stderr.write('  CFO_BASE_URL=https://api.example.com CFO_TOKEN=<token> CFO_WORKSPACE_ID=<workspaceId> npm run validate:cfo:route\n');
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
  process.stdout.write(`OK: ${label} -> ${actual}\n`);
}

async function run() {
  process.stdout.write('Validando rota protegida /api/ai/cfo...\n');

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

  process.stdout.write('OK: payload contem answer\n');
  process.stdout.write('Validacao finalizada com sucesso.\n');
}

run().catch((error) => {
  process.stderr.write(`Falha na validacao da rota CFO: ${error.message}\n`);
  process.exit(1);
});
