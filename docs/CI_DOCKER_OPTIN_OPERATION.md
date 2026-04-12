# Operação de CI com Docker Opcional

## Papel deste documento

Descrever como o CI se comporta quando as etapas de Docker e deploy externo são tratadas como opt-in.

## Build e testes

Arquivo relacionado:

- `.github/workflows/build.yml`

Comportamento registrado:

- o job de Docker é opcional
- por padrão, a validação principal não depende dele
- a ativação ocorre por variável de repositório específica

## Deploy

Arquivo relacionado:

- `.github/workflows/deploy.yml`

Comportamento registrado:

- o alvo de deploy é controlado por variável de repositório
- quando o alvo não está configurado, o pipeline evita acoplamento desnecessário com infraestrutura externa

## Intenção operacional

Separar:

1. gates centrais de qualidade
2. infraestrutura opcional de publicação

Isso reduz falso negativo em CI quando a plataforma externa não faz parte da validação obrigatória daquele ciclo.

## Leitura correta hoje

Este documento é útil como regra operacional de pipeline, mas a trilha principal atual do projeto está concentrada no Vercel.

## Referências

- [docs/DEPLOYMENT.md](E:\app e jogos criados\Flow-Finance\docs\DEPLOYMENT.md)
- [docs/VERCEL_DEPLOYMENT.md](E:\app e jogos criados\Flow-Finance\docs\VERCEL_DEPLOYMENT.md)
