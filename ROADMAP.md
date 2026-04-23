# Roadmap (PT-BR)

O roadmap detalhado e consolidado fica em [docs/ROADMAP.md](./docs/ROADMAP.md). Este arquivo existe como resumo executivo rapido para orientar a prioridade de execucao no repo.

## Links oficiais

- Frontend principal: https://flow-finance-frontend-nine.vercel.app/
- Backend principal: https://flow-finance-backend.vercel.app/
- Frontend alternativo: https://flow-finance-xi.vercel.app/

## Direcao do produto

Flow Finance e um SaaS de fluxo de caixa para empresas de servico, com:

- nucleo financeiro simples (caixa, transacoes, receitas previstas/realizadas)
- apoio consultivo por IA (sinais acionaveis, nao "CFO autonomo")
- web e mobile como alvos de primeira classe

## Foco imediato (curto prazo)

1. Fechar o ambiente-alvo no Vercel (variaveis e acesso ao preview).
2. Validar o contrato de saude e versao no deploy acessivel (`/health`, `/api/health`, `/api/version`).
3. Manter billing e observabilidade coerentes (evidencia local ja existe; faltam garantias no destino).

## Criterios para marcar o ciclo como aprovado

- Suite global sem regressao (lint/tests/e2e).
- Deploy acessivel com endpoints de saude e versao respondendo.
- Observabilidade configurada no destino (quando aplicavel) sem quebrar runtime.
- Documentacao do repo e vault canonico coerentes e em PT-BR.

## Referencias

- Roadmap consolidado: [docs/ROADMAP.md](./docs/ROADMAP.md)
- Comece aqui: [docs/COMECE_AQUI.md](./docs/COMECE_AQUI.md)
- Status de deploy: [docs/DEPLOYMENT_STATUS.md](./docs/DEPLOYMENT_STATUS.md)
- Vercel config: [docs/VERCEL_CONFIG.md](./docs/VERCEL_CONFIG.md)
- Evidencia Stripe: [docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md](./docs/EVIDENCIA_OPERACIONAL_STRIPE_SANDBOX_2026-04-12.md)

