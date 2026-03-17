# Deploy Staging Checklist v0.6.8

Data: 2026-03-17
Objetivo: validar o novo hardening de CI/CD antes de promover para production.

## Pre-condicoes

- Branch de release atualizada com as mudancas de `.github/workflows/deploy.yml`.
- Variavel de repositorio `DEPLOY_PLATFORM` definida como um valor valido:
  - `railway` ou
  - `render` ou
  - `aws`
- Secrets da plataforma escolhida preenchidos:
  - Railway: `RAILWAY_TOKEN`
  - Render: `RENDER_API_KEY`, `RENDER_SERVICE_ID`
  - AWS: `AWS_ECS_CLUSTER`, `AWS_ECS_SERVICE`, `AWS_REGION`

## Execucao manual (workflow_dispatch)

1. Abrir GitHub Actions no workflow `Deploy to Production`.
2. Clicar em `Run workflow`.
3. Selecionar `environment=staging`.
4. Executar.

## Evidencias esperadas no log

- Step `Resolve deploy target`: mostra `platform=...`.
- Step `Validate deploy target`: aprovado.
- Step de validacao de secrets da plataforma ativa: aprovado.
- Step `Deployment preflight summary`: exibe resumo sem segredo.
- Step de deploy da plataforma ativa: executado.
- Steps de deploy de outras plataformas: skipped.
- Step de notificacao Slack:
  - webhook configurado: notifica,
  - webhook ausente: skip seguro com mensagem explicita.

## Critério de aprovado

- Workflow finaliza `success` com deploy real em staging.
- Nao existe falso-verde por plataforma/secret ausente.
- Em caso de configuracao invalida, workflow falha cedo com motivo claro.
