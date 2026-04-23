# Guia de Build Mobile

## Papel deste documento

Este guia resume a trilha de build mobile do Flow Finance com Capacitor para Android e iOS.

## Estado atual

- frontend web e empacotamento mobile coexistem
- a base mobile depende do build web estar integro
- builds nativos dependem do ambiente do desenvolvedor
- geracao automatica de assets mobile por dependencia NPM continua desativada por seguranca

## Nota de seguranca sobre assets

O projeto removeu `cordova-res` para evitar vulnerabilidades na cadeia de dependencias.

Enquanto nao houver caminho upstream comprovadamente seguro:

- Android: gerar icones e splash via Android Studio > New Image Asset
- iOS: gerar assets via Xcode > Assets.xcassets
- versionar os assets nativos junto com a rodada correspondente

## Pre-requisitos

Gerais:

- Node.js `18+`
- npm
- Capacitor CLI
- dependencias do projeto instaladas

Android:

- JDK `17+`
- Android Studio
- SDK Android configurado
- variaveis do SDK corretas

iOS:

- macOS
- Xcode
- CocoaPods
- conta Apple Developer quando houver distribuicao

## Fluxo base

```bash
npm run build
npx cap sync
```

Android:

```bash
npx cap open android
```

iOS:

```bash
npx cap open ios
```

## Atalhos existentes

Android:

```bash
npm run build:android
npm run build:android:release
```

iOS:

```bash
npm run build:ios
npm run build:ios:release
```

## Checklist Android

1. rodar `npm run build`
2. rodar `npx cap sync android`
3. abrir com `npx cap open android`
4. atualizar assets nativos se necessario
5. executar build Debug
6. executar build Release quando assinatura estiver pronta
7. validar abertura, login, dashboard e fluxo de transacao

## Checklist iOS

1. rodar `npm run build`
2. rodar `npx cap sync ios`
3. abrir com `npx cap open ios`
4. atualizar assets nativos se necessario
5. executar build no simulador
6. gerar Archive quando certificados e profiles estiverem corretos
7. validar abertura, login, dashboard e fluxo de transacao

## Regra pratica

Quando o build mobile falhar, separar:

1. falha do aplicativo
2. falha do ambiente nativo

Isso evita confundir problema de sistema com regressao do produto.

## Referencias

- [MOBILE_TESTING_PLAN.md](./MOBILE_TESTING_PLAN.md)
- [MOBILE_TESTING_STATUS.md](./MOBILE_TESTING_STATUS.md)
