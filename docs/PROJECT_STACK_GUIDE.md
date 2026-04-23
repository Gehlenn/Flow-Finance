# Guia de Stack do Projeto (Fonte Canônica)

## Viés de stack

- `GSD` para escopo, fases, backlog e ordem de execução
- `Superpowers` para suporte (planejamento, review, verificação, debugging)
- `gstack` para QA, automação, canário e verificação pós-deploy
- `context7` quando precisar de documentação atual de bibliotecas/plataformas
- `n8n` quando tocar automações externas ou orquestração de workflow

## Regra prática

Use um workflow principal por vez:

- execução de mudanças e releases: GSD
- verificação e revisão (pontual): Superpowers / gstack
- pesquisa de docs externas: context7
- automação externa: n8n

## Documentos relacionados

- regras do projeto: [FLOW_FINANCE_PROJECT_RULES.md](./FLOW_FINANCE_PROJECT_RULES.md)
- plano de produto: [FLOW_FINANCE_PRODUCT_PLAN.md](./FLOW_FINANCE_PRODUCT_PLAN.md)
- tarefas de execução: [FLOW_FINANCE_CODE_TASKS.md](./FLOW_FINANCE_CODE_TASKS.md)

