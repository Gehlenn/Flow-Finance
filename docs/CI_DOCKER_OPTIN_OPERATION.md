# Operacao de CI com Docker Opcional

## Papel deste documento

Este documento registra como o CI trata Docker e deploy externo como trilhas opt-in. A trilha principal atual do projeto continua concentrada no Vercel.

## Build e testes

Arquivo relacionado:

- [.github/workflows/build.yml](E:\app e jogos criados\Flow-Finance\.github\workflows\build.yml)

Comportamento atual:

- o job de Docker e opcional
- a validacao principal nao depende dele por padrao
- a ativacao ocorre com a variavel de repositorio `ENABLE_DOCKER_BUILD=true`
- push de imagem depende de credenciais Docker Hub configuradas

## Deploy externo

Arquivo relacionado:

- [.github/workflows/deploy.yml](E:\app e jogos criados\Flow-Finance\.github\workflows\deploy.yml)

Comportamento atual:

- `DEPLOY_PLATFORM` controla a plataforma externa
- valores suportados pelo workflow: `railway`, `render`, `aws`
- sem `DEPLOY_PLATFORM`, o workflow evita acoplamento com infraestrutura externa

## Intencao operacional

Separar:

1. gates centrais de qualidade
2. build de imagem
3. deploy externo fora da trilha Vercel

Isso reduz falso negativo em CI quando Docker ou outra plataforma nao fazem parte da validacao obrigatoria daquele ciclo.

## Leitura correta

Este documento continua vivo como regra de pipeline, mas nao substitui:

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
