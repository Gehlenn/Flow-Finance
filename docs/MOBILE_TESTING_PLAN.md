# Plano de Testes Mobile

## Papel deste documento

Definir a ordem de validacao mobile sem misturar falhas do app com lacunas do ambiente nativo.

## Situacao conhecida

Bloqueios como JDK, SDK Android, Xcode ou assinatura devem ser tratados como dependencia de ambiente, nao como falha funcional automatica do produto.

## O que pode ser validado sem build nativo completo

- layout em viewport mobile
- navegacao principal
- interacoes centrais
- health de runtime mobile
- integracao com backend quando o ambiente estiver configurado

## O que depende de ambiente nativo completo

- APK
- AAB
- execucao em emulador Android
- execucao em dispositivo fisico
- build e distribuicao iOS

## Plano recomendado

### Etapa 1 - Web mobile

- rodar aplicacao local
- validar viewport mobile
- confirmar ausencia de erro critico de runtime
- executar `npm run health:runtime:mobile`

### Etapa 2 - Empacotamento

- rodar `npm run build`
- rodar `npx cap sync`
- abrir projeto nativo

### Etapa 3 - Build nativo

- Android com JDK e SDK completos
- iOS com Xcode e assinatura quando aplicavel

### Etapa 4 - Validacao funcional

- login
- dashboard
- transacoes
- fluxo principal do produto
- telas administrativas relevantes

## Criterios de saida

1. base web mobile validada
2. sync com Capacitor funcionando
3. build nativo funcionando no ambiente correto
4. fluxo principal validado em contexto mobile

## Referencias

- [MOBILE_BUILD_GUIDE.md](./MOBILE_BUILD_GUIDE.md)
- [MOBILE_TESTING_STATUS.md](./MOBILE_TESTING_STATUS.md)
