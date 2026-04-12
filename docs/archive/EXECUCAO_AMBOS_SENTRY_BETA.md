# ✅ FLOW FINANCE v0.9.6 - PRONTO PARA SENTRY + BETA TESTING

**Status**: Ambos os processsos estão **100% preparados** para execução

---

## 🎯 O Que Está Pronto

### ✅ **Scripts de Automação** (2)

| Script | Função | Tempo |
|--------|--------|-------|
| `scripts/activate-sentry.mjs` | Configura DSNs e redeploy automático | ~10 min |
| `scripts/beta-testing-coordinator.mjs` | Coleta testers e gera convites | ~10 min |

### ✅ **Guias & Documentação** (5)

| Doc | Para Quem | Propósito |
|-----|-----------|-----------|
| [SENTRY_SETUP_GUIDE.md](../SENTRY_SETUP_GUIDE.md) | Você (tech owner) | Criar projetos Sentry |
| [DIA_2_BETA_TESTING_PLAN.md](DIA_2_BETA_TESTING_PLAN.md) | Testers + Team | Cenários de teste |
| [QUICK_START_AMBOS.md](../../QUICK_START_AMBOS.md) | Quick reference | Como executar ambos |
| [LANCAMENTO_OFICIAL_2026-04-12.md](LANCAMENTO_OFICIAL_2026-04-12.md) | Everyone | Status oficial de lançamento |
| [CHANGELOG.md](../CHANGELOG.md) | Developers | Histórico técnico |

---

## 🚀 Como Executar Ambos (Paralelo)

### **Fase 1: Agora (10 minutos) - Coletar Testers**

```bash
cd "e:\app e jogos criados\Flow-Finance"
node scripts/beta-testing-coordinator.mjs
```

Será perguntado:
```
--- Tester 1 ---
Full name: João Silva
Email: joao@consultorio.com
Business type: consultório
Phone (optional): 11999999999

Add another tester? (y/n): y

[... repeat para mais testers ...]
```

**Resultado**: 
- Testers salvos em `.planning/beta-testers-2026-04-12.json`
- Convites gerados em `.planning/beta-invites-template.txt`
- Feedback form em `.planning/beta-feedback-form-template.txt`

---

### **Fase 2: Você Faz (15 minutos) - Criar Sentry**

Enquanto executa beta coordinator, abra em paralelo:

1. **Ir para**: https://sentry.io/signup/ (ou login se tem)
2. **Criar Projeto 1 (Backend)**:
   - Platform: Node.js
   - Name: `flow-finance-backend`
   - Copiar DSN (vai ser algo como: `https://abc123@def456.ingest.sentry.io/789000`)

3. **Criar Projeto 2 (Frontend)**:
   - Platform: React
   - Name: `flow-finance-frontend`
   - Copiar DSN (vai ser algo como: `https://xyz789@def456.ingest.sentry.io/789001`)

**Total**: ~10 minutos

---

### **Fase 3: Ativar Sentry (10 minutos) - Após ter DSNs**

Quando você tiver os 2 DSNs do Sentry:

```bash
node scripts/activate-sentry.mjs \
  "https://abc123@def456.ingest.sentry.io/789000" \
  "https://xyz789@def456.ingest.sentry.io/789001"
```

Script vai:
1. ✅ Linkar backend Vercel → adicionar SENTRY_DSN → deploy
2. ✅ Linkar frontend Vercel → adicionar VITE_SENTRY_DSN → deploy
3. ✅ Validar `/api/health` → `sentryConfigured: true`

**Resultado**: Sentry ativo em produção

---

### **Fase 4: Enviar Convites Beta (5 minutos)**

1. Abra `.planning/beta-invites-template.txt` (gerado no Fase 1)
2. Crie um Google Form com template de `.planning/beta-feedback-form-template.txt`
3. Adicione URL do form nas invites
4. Envie emails aos testers

**Resultado**: Testers prontos para amanhã (Dia 2)

---

## ⏱️ **Timeline Total**

```
Agora:           10 min → node scripts/beta-testing-coordinator.mjs
Paralelo:        15 min → Criar 2 projetos Sentry
Depois:          10 min → node scripts/activate-sentry.mjs DSN1 DSN2
Enviar convites:  5 min → Colar DSNs nas invites + enviar
────────────────────────────────────────────
Total:          ~40 minutos

Resultado:
✅ Sentry ativo
✅ Beta testers prontos
✅ Tudo pronto para Dia 2
```

---

## 📚 Arquivos Gerados (Automaticamente)

Após executar os scripts, você terá:

```
.planning/
├── beta-testers-2026-04-12.json        ← Lista de testers + status
├── beta-invites-template.txt            ← Emails personalizados
└── beta-feedback-form-template.txt      ← Template de survey

docs/
├── SENTRY_SETUP_GUIDE.md                ← Como criar projetos
├── DIA_2_BETA_TESTING_PLAN.md          ← Cenários de teste
├── LANCAMENTO_OFICIAL_2026-04-12.md    ← Status oficial
└── ...
```

---

## ✅ Checklist Paralelo

```
BETA TESTING (Script - 10 min):
  [ ] node scripts/beta-testing-coordinator.mjs
  [ ] Adicione 5-10 testers
  [ ] Salvar testers JSON

SENTRY (Manual - 15 min):
  [ ] Ir para sentry.io
  [ ] Criar projeto Backend
  [ ] Criar projeto Frontend  
  [ ] Copiar 2 DSNs

ATIVAR SENTRY (Script - 10 min):
  [ ] node scripts/activate-sentry.mjs DSN1 DSN2
  [ ] Aguarde 2 deploys
  [ ] Validar sentryConfigured: true

ENVIAR CONVITES (Manual - 5 min):
  [ ] Criar Google Form
  [ ] Colar URL do form nas invites
  [ ] Enviar emails aos testers
```

---

## 🎊 Próximos Status

### Após Completar Ambos:
```
✅ v0.9.6 LIVE em produção
✅ Sentry monitorando crashes
✅ Beta testers convidados
✅ Feedback form pronto
✅ Sistema de coleta ready
✅ Dia 2 agendado

🔄 Próximo: Aguardar testers começarem + coletar feedback
```

### GO Dia 3 (Comunicação em Massa) Quando:
- ✅ 5+ testers completarem testes
- ✅ 90%+ conseguem fazer login
- ✅ 90%+ conseguem criar transação
- ✅ 90%+ conseguem sincronizar
- ✅ Zero erros críticos

---

## 🚨 Se Algo Der Errado

### Se Sentry DSN inválido
```
Script falhará no deploy. 
→ Verificar DSN no Sentry dashboard
→ Copiar novamente (completo)
→ Executar script de novo
```

### Se Tester não consegue fazer login
```
→ Verificar Firebase config em Vercel
→ Verificar CORS backend
→ Check logs: VERCEL_TARGET_URL=... npm run logs
→ Hotfix imediato se crítico
```

### Se transação não sincroniza
```
→ Critical blocker
→ Check backend POST /api/transactions
→ Rollback deploy se necessário
→ Entrar em contato comigo
```

---

## 📞 Próximo Passo: Sua Escolha

### 🟢 Opção A: Começar Agora
```
Responda: "Pronto"
→ Vou listar testers que você pode usar como template
→ Você executa scripts
```

### 🟢 Opção B: Eu Executo Para Você
```
Responda: Nomes/emails dos testers
→ Eu executo coordinator
→ Você fornece DSNs Sentry
→ Eu executo activate-sentry
```

### 🟢 Opção C: Esperar Mais
```
Responda: "Depois"
→ Documentos ficarão prontos
→ Scripts prontos para quando você quiser
```

**Qual você escolhe?** 👇

---

**Status Final**: Tudo pronto, aguardando suas instruções
