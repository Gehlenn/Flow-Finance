# 🎯 PASSO A PASSO - Setup Completo (30 min)

## Resumo do que vamos fazer:
1. ✅ Obter API Key do OpenAI
2. ✅ Configurar Firebase
3. ✅ Linkar Vercel
4. ✅ Fazer deploy

---

## PASSO 1: OpenAI API Key (3 min)

1. Visite: **https://platform.openai.com/api/keys**
2. Login na sua conta
3. Clique **"Create new secret key"**
4. Copie o valor que começa com `sk-proj-`
5. **GUARDE COM SEGURANÇA** ⚠️

---

## PASSO 2: Configurar Variáveis Localmente (5 min)

### Windows (PowerShell):
```powershell
npm run setup
```

### macOS/Linux:
```bash
npm run setup
```

**O script vai pedir:**
- OpenAI API Key (cole aqui)
- Firebase Project ID (padrão: komodo-flow)
- Firebase Email (do JSON baixado)
- Backend URL (deixe em branco por enquanto)

✅ Pronto! `.env.local` criado automaticamente

---

## PASSO 3: Instalar Vercel CLI (2 min)

```bash
npm install -g vercel
```

---

## PASSO 4: Login no Vercel (1 min)

```bash
vercel login
```

Escolha:
- **GitHub** (recomendado)
- Ou Email

Aprove no browser quando pedir

---

## PASSO 5: Linkar Projeto (2 min)

```bash
vercel link
```

Assim que perguntar:
```
Set up and deploy? › (y/N) → y
```

Deixe os padrões:
- Framework detected: **Other** ✅
- Root directory: **. (dot)** ✅
- Project name: **flow-finance**

✅ **SEU PROJETO AGORA ESTÁ LINKADO AO VERCEL!**

Vai retornar:
```
✅ Linked to seu-usuario/flow-finance (created .vercelignore)
```

---

## PASSO 6: Adicionar Variáveis de Ambiente (3 min)

Execute cada comando abaixo e tente seguindo as instruções:

```bash
vercel env add OPENAI_API_KEY
```
→ Cole sua chave
→ Escolha **Production, Preview, Development**

```bash
vercel env add FIREBASE_PROJECT_ID
```
→ Digite: komodo-flow

```bash
vercel env add FIREBASE_CLIENT_EMAIL  
```
→ Cole o email do Firebase

```bash
vercel env add VITE_API_PROD_URL
```
→ Deixe em branco por enquanto (você vai atualizar depois com seu backend)

---

## PASSO 7: Testar Build Local (3 min)

```bash
npm run build
```

Se passar (deve mostrar ✓), você está bom pra deploy!

```
✓ built in X.XXs
```

---

## PASSO 8: Deploy em Produção (3 min)

```bash
npm run deploy
```

Você vai ver:
```
✓ Production: https://flow-finance.vercel.app
```

🎉 **PARABÉNS! SEU APP ESTÁ ONLINE!**

---

## VERIFICAR SE FUNCIONOU

Visite:
- **https://flow-finance.vercel.app** ← seu app ao vivo!
- Fazer login
- Testar funcionalidades

---

## ⚠️ SE DER ERRO

### Build falha no Vercel
```bash
# Verificar localmente primeiro
npm run build

# Se passou local, em produção é provavelmente variável de ambiente
vercel env ls  # ver variáveis
```

### Deploy falha
```bash
# Checar logs
vercel logs

# Refazer deploy
vercel deploy --prod
```

### App não carrega no navegador
- Abra DevTools (F12)
- Check: Console → ver erros
- Geralmente é falta de `VITE_API_PROD_URL`

---

## ✅ CHECKLIST FINAL

- [ ] OpenAI API Key obtida
- [ ] npm run setup executado
- [ ] Vercel CLI instalado
- [ ] vercel login funcionou
- [ ] vercel link criou projeto
- [ ] Variáveis de ambiente adicionadas no Vercel
- [ ] npm run build passou
- [ ] npm run deploy funcionou
- [ ] App está online em https://flow-finance.vercel.app

---

## 🎯 PRÓXIMOS PASSOS (Opcional)

1. **Domínio customizado**
   - Vercel Dashboard → Settings → Domains
   - Adicione seu domínio

2. **Backend**
   - Deploy seu backend (Node.js)
   - Atualize `VITE_API_PROD_URL` no Vercel

3. **Monitoramento**
   - Ative Sentry para error tracking
   - Configure analytics

4. **Auto-deploy**
   - Já está ativo! Cada push = novo deploy automático

---

## 📞 DÚVIDAS?

Leia:
- **Português**: `SETUP_GUIA_PT.md`
- **Inglês completo**: `SETUP_GUIDE.md`
- **Apenas Vercel**: `VERCEL_QUICK_START.md`

**Bora! Você consegue! 🚀**