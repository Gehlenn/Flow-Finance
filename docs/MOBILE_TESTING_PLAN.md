# 📱 Plano de Testes Móveis - Flow Finance v0.1.0

**Data**: 8 de Março de 2026  
**Status**: ⚠️ BLOQUEADO - JDK não instalado  
**Objetivo**: Validar que o Flow Finance funciona corretamente em dispositivos móveis (Android/iOS)

---

## 🚨 BLOQUEADO: Ambiente de Build Android

### ❌ Problema Identificado
- **JDK não instalado** no sistema Windows
- **Chocolatey falhou** devido a permissões administrativas
- **Build Android impossível** sem JDK 17+

### 🔧 Soluções Possíveis
1. **Instalar Android Studio** (inclui JDK embutido)
2. **Instalar JDK manualmente** via download direto
3. **Usar WSL2** com Ubuntu para desenvolvimento
4. **Configurar CI/CD** (GitHub Actions, etc.)

---

## ✅ Testes Que Podemos Fazer Agora

### **Teste 1: Validação do Build Web**
- [x] Build Vite funciona (`npm run build`)
- [x] Arquivos gerados em `dist/`
- [x] Capacitor sync funciona
- [x] Estrutura Android criada

### **Teste 2: Validação da Configuração**
- [x] `capacitor.config.ts` correto
- [x] Plugins configurados (SplashScreen, etc.)
- [x] Permissões Android documentadas
- [x] App ID e versão corretos

### **Teste 3: Testes Unitários**
```bash
npm run test          # Vitest
npm run type-check    # TypeScript
```

### **Teste 4: Testes de Integração**
- [ ] Backend API responde
- [ ] Firebase Auth funciona
- [ ] Sentry captura erros
- [ ] PWA funciona no browser

---

## 🎯 Plano de Contingência

### **Opção A: Instalar Android Studio**
```bash
# Download: https://developer.android.com/studio
# Instalar com JDK embutido
# Configurar ANDROID_HOME
# Retry: npx cap build android
```

### **Opção B: Usar Emulador Web**
```bash
# Testar PWA no Chrome DevTools
# Simular mobile device
# Validar responsive design
npm run dev
```

### **Opção C: Build na Cloud**
```bash
# GitHub Actions com macOS runner
# Build iOS e Android
# Deploy automático
```

---

## 📊 Status Atual

```
✅ Capacitor: Configurado e sincronizado
✅ Build Web: Funcionando (Vite)
✅ Estrutura Android: Criada
❌ JDK: Não instalado
❌ Build APK: Bloqueado
❌ Testes Dispositivo: Impossível
```

---

## 🚀 Próximas Ações Recomendadas

1. **Imediato**: Instalar Android Studio ou JDK
2. **Alternativo**: Configurar testes web mobile
3. **Futuro**: Setup CI/CD para builds automáticos

**Resultado**: Ambiente preparado, mas bloqueado por dependências do sistema.

