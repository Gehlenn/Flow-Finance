# Guia de Build Mobile

## Papel deste documento

Este guia resume a trilha de build mobile do Flow Finance com Capacitor para Android e iOS.

## Estado atual

- frontend web e empacotamento mobile coexistem
- a base mobile depende do build web estar íntegro
- builds nativos continuam dependentes do ambiente do desenvolvedor
- geracao automatica de assets mobile via dependencia NPM foi desativada temporariamente por seguranca

## Nota de seguranca sobre assets

- O projeto removeu `cordova-res` para eliminar vulnerabilidades de alto risco na cadeia de dependencias.
- Ate a liberacao de um caminho upstream comprovadamente seguro, gere assets nativos manualmente:
	- Android: Android Studio > New Image Asset
	- iOS: Xcode > Assets.xcassets
- Registre os arquivos gerados no controle de versao junto com o build correspondente.

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

## Checklist operacional rapido (sem script de assets)

### Android

1. Rodar `npm run build`.
2. Rodar `npx cap sync android`.
3. Abrir o projeto com `npx cap open android`.
4. Atualizar icones/splash em Android Studio (Image Asset), se necessario.
5. Executar build Debug para validacao local.
6. Executar build Release (APK/AAB) quando assinatura estiver pronta.
7. Validar abertura do app, login, dashboard e fluxo de transacao.

### iOS

1. Rodar `npm run build`.
2. Rodar `npx cap sync ios`.
3. Abrir o projeto com `npx cap open ios`.
4. Atualizar icones/splash em Assets.xcassets, se necessario.
5. Executar build no simulador para validacao local.
6. Gerar Archive quando certificados e profiles estiverem corretos.
7. Validar abertura do app, login, dashboard e fluxo de transacao.

### Fechamento da rodada

1. Registrar data, responsavel e resultado do teste.
2. Versionar assets nativos alterados junto com o codigo da rodada.
3. Anotar bloqueios de ambiente separando problema de app vs problema nativo.

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
