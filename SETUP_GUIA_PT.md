# 🚀 GUIA RÁPIDO - Flow Finance Setup (Português)

## 1️⃣ Obter OpenAI API Key

### Passo 1: Acesse OpenAI Platform
- URL: https://platform.openai.com/api/keys
- Login com sua conta

### Passo 2: Criar Chave
- Clique "Create new secret key"
- Copie a chave (começa com `sk-proj-`)
- ⚠️ Guarde com segurança

### Passo 3: Adicione ao .env.local
```env
OPENAI_API_KEY=your_openai_api_key_here
```

**Custo**: ~$0.03 por 1K tokens (muito barato)

---

## 2️⃣ Configurar Firebase

### Opção A: Admin Key (Recomendado para Backend)

1. Acesse: https://console.firebase.google.com
2. Projeto: `komodo-flow`
3. **Project Settings** → **Service Accounts**
4. Clique **Generate New Private Key**
5. Salve o arquivo JSON

6. Extraia do JSON:
   ```env
   FIREBASE_PROJECT_ID=komodo-flow
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@komodo-flow.iam.gserviceaccount.com
   ```

### Opção B: Web Config (Frontend)
```env
VITE_FIREBASE_API_KEY=your_firebase_web_api_key_here
VITE_FIREBASE_PROJECT_ID=komodo-flow
VITE_FIREBASE_AUTH_DOMAIN=komodo-flow.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=komodo-flow.firebasestorage.app
```

---

## 3️⃣ Linkar Conta Vercel (5 minutos)

### Passo 1: Instalar Vercel CLI
```bash
npm install -g vercel
```

### Passo 2: Fazer Login
```bash
vercel login
```
- Escolha **GitHub** ou **Email**
- Aprove no browser

### Passo 3: Linkar Projeto
```bash
vercel link
```
- Responda:**"Set up and deploy?"** → **Yes**
- **Framework**: Other
- **Root directory**: .
- **Project name**: flow-finance

✅ **Pronto! Seu projeto está linkado!**

### Passo 4: Adicionar Variáveis de Ambiente

**Via CLI (Rápido):**
```bash
vercel env add OPENAI_API_KEY
# Digite sua chave
# Escolha: Production + Preview
```

Repita para:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `VITE_API_PROD_URL`

**Via Dashboard:**
1. https://vercel.com/dashboard
2. Selecione `flow-finance`
3. **Settings** → **Environment Variables**
4. Clique **Add**
5. Preencha as variáveis

---

## 4️⃣ Deploy

### Testar Localmente
```bash
npm run build
npm run dev
```
Visite: http://localhost:3078

### Deploy em Preview (Staging)
```bash
npm run deploy:preview
```
Visite URL fornecida

### Deploy em Produção
```bash
npm run deploy
```
Visite: https://flow-finance.vercel.app

---

## 5️⃣ Checklist Final

### ✅ Setup Local
- [ ] npm install
- [ ] .env.local criado com:
  - [ ] OPENAI_API_KEY
  - [ ] FIREBASE_PROJECT_ID
  - [ ] FIREBASE_CLIENT_EMAIL
  - [ ] VITE_API_PROD_URL

### ✅ Vercel
- [ ] CLI instalado
- [ ] Projeto linkado (`vercel link`)
- [ ] Variáveis de ambiente adicionadas
- [ ] Test deploy: `npm run deploy:preview` ✅

### ✅ Deploy
- [ ] Build local passa: `npm run build` ✅
- [ ] Preview funciona
- [ ] Produção deployada

---

## 🎯 URLs Importantes

| Serviço | URL |
|---------|-----|
| OpenAI | https://platform.openai.com |
| Firebase | https://console.firebase.google.com |
| Vercel | https://vercel.com/dashboard |
| App (Dev) | http://localhost:3078 |
| App (Prod) | https://flow-finance.vercel.app |

---

## 💡 Dicas

1. **Guardar Chaves com Segurança**
   - Nunca commit `.env.local` no Git
   - Já está em `.gitignore` ✅

2. **Testar Tudo Localmente**
   - Antes de fazer deploy
   - Evita surpresas em produção

3. **Monitorar Custos**
   - OpenAI: ~$0.03 por 1K tokens
   - Firebase: Grátis até 1GB/mês
   - Vercel: 100GB bandwidth grátis

4. **Auto-Deploy do GitHub**
   - Vercel configura automaticamente
   - Cada push = novo deploy

---

## ❓ Problemas Comuns

### OpenAI retorna erro 401
- Chave está correta?
- Tem créditos na conta?
- Não foi revogada?

### Firebase não conecta
- FIREBASE_PROJECT_ID está certo?
- EMAIL está certo?
- PRIVATE_KEY tem `\n` para quebras de linha?

### Deploy falha no Vercel
- `npm run build` funciona localmente?
- Variáveis de ambiente estão todas setadas?
- Node.js >= 18?

---

## 📞 Próximos Passos

1. ✅ Setup OpenAI
2. ✅ Setup Firebase
3. ✅ Linkar Vercel
4. ✅ Fazer deploy
5. ✅ Testar em produção
6. 🔄 Integrar mais funcionalidades

Qualquer dúvida, check:
- `SETUP_GUIDE.md` (completo)
- `VERCEL_QUICK_START.md` (Vercel)

**Bora programar! 🚀**