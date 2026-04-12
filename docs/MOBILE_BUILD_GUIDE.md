# Guia de Build Mobile

## Papel deste documento

Este guia resume a trilha de build mobile do Flow Finance com Capacitor para Android e iOS.

## Estado atual

- frontend web e empacotamento mobile coexistem
- a base mobile depende do build web estar íntegro
- builds nativos continuam dependentes do ambiente do desenvolvedor

## Pré-requisitos gerais

- Node.js `18+`
- npm
- Capacitor CLI
- dependências do projeto instaladas

## Android

Requisitos comuns:

- JDK `17+`
- Android Studio
- SDK Android configurado
- variáveis de ambiente do SDK corretas

## iOS

Requisitos comuns:

- macOS
- Xcode
- CocoaPods
- conta Apple Developer quando houver distribuição

## Fluxo base

### 1. Build web

```bash
npm run build
```

### 2. Sincronizar com Capacitor

```bash
npx cap sync
```

### 3. Abrir projeto nativo

Android:

```bash
npx cap open android
```

iOS:

```bash
npx cap open ios
```

## Atalhos úteis

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

## Resultado esperado

### Android

- APK de debug
- APK ou AAB de release, quando o ambiente estiver completo

### iOS

- build via Xcode
- archive e distribuição quando o ambiente estiver completo

## Bloqueios típicos

- JDK ausente ou mal configurado
- SDK Android incompleto
- assinatura de release ausente
- perfis e certificados iOS ausentes

## Regra prática

Quando o build mobile falhar, separar o problema em duas classes:

1. falha do aplicativo
2. falha do ambiente nativo

Isso evita confundir erro de sistema com regressão do produto.

## Referências

- [docs/MOBILE_TESTING_PLAN.md](E:\app e jogos criados\Flow-Finance\docs\MOBILE_TESTING_PLAN.md)
- [docs/MOBILE_TESTING_STATUS.md](E:\app e jogos criados\Flow-Finance\docs\MOBILE_TESTING_STATUS.md)
