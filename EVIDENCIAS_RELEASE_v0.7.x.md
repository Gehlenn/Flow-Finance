# EVIDÊNCIAS DE RELEASE – Flow Finance v0.7.x

## Prints e Logs
- Execução de lint, testes unitários, cobertura crítica e E2E: OK
- Health check backend (`/api/health`): status OK
- Versionamento backend (`/api/version`): v0.7.x
- Fixture Pluggy: autenticação e persistência validadas

## Comandos executados
```bash
npm run lint
npm test
npm run test:coverage:critical
npm run test:e2e
```

## Saídas principais
- Lint: sem erros
- Testes: 141/141 passed
- Cobertura: 99.53% stmts / 98.38% branches
- E2E: Pluggy fixture estável, sem skips indevidos

## Deploy
- Build frontend/backend: sucesso
- Deploy em ambiente alvo: sucesso
- Health check: OK
- Versionamento: OK

---

_Evidências coletadas e validadas em 18/03/2026._
