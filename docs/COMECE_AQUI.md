# Comece Aqui

Este é o ponto de entrada mais curto para entender o estado real do Flow Finance sem atravessar toda a base documental.

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

- [README.md](../README.md)
- [README.md (docs)](./README.md)
- [ROADMAP.md](./ROADMAP.md)
- [CHANGELOG.md](./CHANGELOG.md)

### 2. Entender o bloqueio atual

- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)
- [archive/PRODUCTION_RISK_REVIEW_2026-04-11.md](./archive/PRODUCTION_RISK_REVIEW_2026-04-11.md)

### 3. Entender billing e observabilidade

- [EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)
- [SAAS_ARCHITECTURE.md](./SAAS_ARCHITECTURE.md)
- [HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md](./HTTP_CONTRATOS_SENSIVEIS_CONGELADOS_2026-04-11.md)

### 4. Entender a organizacao da documentacao

- [OPERATIONS_README.md](./OPERATIONS_README.md)
- [HISTORICAL_README.md](./HISTORICAL_README.md)
- [AUDIT_AND_EVIDENCE_INDEX.md](./AUDIT_AND_EVIDENCE_INDEX.md)

### 5. Entender o vault do projeto

O vault canônico fica fora do repositório (ver `../README.md`).

## Proxima fila objetiva

1. Fechar configuracao de observabilidade e versao no Vercel.
2. Liberar ou compartilhar o preview protegido.
3. Validar `/health`, `/api/health` e `/api/version` no deploy acessivel.
4. Continuar mantendo repositorio e vault coerentes em PT-BR.

## Regra pratica

Se houver conflito entre texto antigo e codigo atual, o codigo vence e a documentacao deve ser atualizada na mesma passada.
