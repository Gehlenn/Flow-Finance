# Plano de Testes Mobile

## Objetivo

Validar que o Flow Finance opera de forma confiável em contexto mobile sem misturar falhas do app com lacunas do ambiente nativo.

## Situação histórica conhecida

Na trilha anterior, o principal bloqueio foi:

- ausência de JDK no ambiente Windows

Esse tipo de bloqueio deve ser tratado como dependência de ambiente, não como falha funcional do produto.

## O que pode ser validado sem build nativo completo

### Web mobile

- responsividade
- navegação principal
- interações centrais
- comportamento de runtime

### PWA

- carregamento
- comportamento de instalação quando aplicável
- consistência visual em viewport mobile

### Integração com backend

- autenticação
- endpoints principais
- billing e health quando aplicável

## O que depende de ambiente nativo completo

- geração de APK
- geração de AAB
- execução em emulador Android
- execução em dispositivo físico
- distribuição iOS

## Plano recomendado

### Etapa 1 - Base web mobile

- rodar aplicação local
- validar layout e navegação em viewport mobile
- confirmar que não há erro de runtime crítico

### Etapa 2 - Empacotamento

- `npm run build`
- `npx cap sync`
- abrir projeto nativo

### Etapa 3 - Build nativo

- Android com JDK e SDK completos
- iOS com Xcode e assinatura quando aplicável

### Etapa 4 - Validação funcional

- login
- dashboard
- transações
- fluxo principal do produto
- telas administrativas relevantes

## Critérios de saída

1. base web mobile validada
2. sync com Capacitor funcionando
3. build nativo funcionando no ambiente correto
4. fluxo principal validado em contexto mobile

## Referências

- [docs/MOBILE_BUILD_GUIDE.md](E:\app e jogos criados\Flow-Finance\docs\MOBILE_BUILD_GUIDE.md)
- [docs/MOBILE_TESTING_STATUS.md](E:\app e jogos criados\Flow-Finance\docs\MOBILE_TESTING_STATUS.md)
