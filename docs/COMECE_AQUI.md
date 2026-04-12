# Comece Aqui

Este e o ponto de entrada mais curto para entender o estado real do Flow Finance sem atravessar toda a base documental.

## Estado atual

- Versao documental: `0.9.6.1v`
- Data de referencia: `2026-04-12`
- Estado do ciclo: `bloqueado`
- Suite global: `verde`
- Bloqueio principal: fechamento incompleto do ambiente alvo no Vercel

## Links oficiais

- Frontend principal: [https://flow-finance-frontend-nine.vercel.app/](https://flow-finance-frontend-nine.vercel.app/)
- Backend principal: [https://flow-finance-backend.vercel.app/](https://flow-finance-backend.vercel.app/)
- Frontend alternativo: [https://flow-finance-xi.vercel.app/](https://flow-finance-xi.vercel.app/)

## Se voce precisa se orientar agora

### 1. Entender o projeto e o estado real

- [README.md](E:\app e jogos criados\Flow-Finance\README.md)
- [docs/README.md](E:\app e jogos criados\Flow-Finance\docs\README.md)
- [docs/ROADMAP.md](E:\app e jogos criados\Flow-Finance\docs\ROADMAP.md)
- [docs/CHANGELOG.md](E:\app e jogos criados\Flow-Finance\docs\CHANGELOG.md)

### 2. Entender o bloqueio atual

- [docs/DEPLOYMENT_STATUS.md](E:\app e jogos criados\Flow-Finance\docs\DEPLOYMENT_STATUS.md)
- [docs/VERCEL_CONFIG.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_CONFIG.md)
- [docs/archive/PRODUCTION_RISK_REVIEW_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\archive\PRODUCTION_RISK_REVIEW_2026-04-11.md)

### 3. Entender billing e observabilidade

- [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](E:\app e jogos criados\Flow-Finance\docs\EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- [docs/SAAS_ARCHITECTURE.md](E:\app e jogos criados\Flow-Finance\docs\SAAS_ARCHITECTURE.md)
- [docs/HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md](E:\app e jogos criados\Flow-Finance\docs\HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md)

### 4. Entender a organizacao da documentacao

- [docs/OPERATIONS_README.md](E:\app e jogos criados\Flow-Finance\docs\OPERATIONS_README.md)
- [docs/HISTORICAL_README.md](E:\app e jogos criados\Flow-Finance\docs\HISTORICAL_README.md)
- [docs/AUDIT_AND_EVIDENCE_INDEX.md](E:\app e jogos criados\Flow-Finance\docs\AUDIT_AND_EVIDENCE_INDEX.md)

### 5. Entender o vault do projeto

- [Project Rules.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Project Rules.md)
- [Product Plan.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Product Plan.md)
- [Code Tasks.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Code Tasks.md)
- [Documentation Map.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Documentation Map.md)
- [Operational Context.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Operational Context.md)
- [Release Status.md](E:\app e jogos criados\Flow-Finance\obsidian-vault\Flow\Release Status.md)

## Proxima fila objetiva

1. Fechar configuracao de observabilidade e versao no Vercel.
2. Liberar ou compartilhar o preview protegido.
3. Validar `/health`, `/api/health` e `/api/version` no deploy acessivel.
4. Continuar mantendo repositorio e vault coerentes em PT-BR.

## Regra pratica

Se houver conflito entre texto antigo e codigo atual, o codigo vence e a documentacao deve ser atualizada na mesma passada.
