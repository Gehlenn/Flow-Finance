# 🚀 Executar Ambos: Sentry + Beta Testing

## Opção 1: SENTRY (Quando tiver DSNs)

### 1.1 Você cria projetos Sentry
- Vá para: https://sentry.io/signup/ (se precisa conta)
- Crie 2 projetos: Backend (Node.js) + Frontend (React)
- Copie os 2 DSNs

### 1.2 Eu configuro automaticamente
```bash
node scripts/activate-sentry.mjs \
  "https://your_backend_dsn@ingest.sentry.io/backend_id" \
  "https://your_frontend_dsn@ingest.sentry.io/frontend_id"
```

**Tempo**: ~15 minutos (setup + 2 deploys)

---

## Opção 2: BETA TESTING (Começar AGORA)

### 2.1 Executar coordenador de beta
```bash
node scripts/beta-testing-coordinator.mjs
```

Este script vai:
1. Perguntar nome/email de cada tester (interativo)
2. Gerar emails de convite personalizados
3. Criar template de feedback
4. Salvar em `.planning/beta-testers-2026-04-12.json`

**Tempo**: ~10 minutos (5-10 testers)

---

## Opção 3: AMBOS EM PARALELO

### Timeline Recomendada

```
Agora (Próximos 10 min):
  ✅ Executar: node scripts/beta-testing-coordinator.mjs
  • Coletar nomes/emails dos 5-10 testers
  • Gerar invites e feedback forms

Enquanto isso (Próximos 15 min):
  🔧 Você em paralelo:
  • Criar 2 projetos em sentry.io
  • Copiar DSNs

Depois (Próximos 10 min):
  ✅ Executar: node scripts/activate-sentry.mjs DSN1 DSN2
  • Configurar Vercel
  • Deploy backend + frontend
  • Validar health check

Resultado (30-40 min total):
  ✅ Sentry ativo
  ✅ Beta testers prontos para convite
```

---

## 🎬 COMEÇAR AGORA

### Comando para Beta Testing

```bash
cd "e:\app e jogos criados\Flow-Finance"
node scripts/beta-testing-coordinator.mjs
```

Responda às perguntas interativas:
- Tester 1 name: _____
- Tester 1 email: _____
- Business type: _____
- Continuar adicionando? y/n

---

## 📋 Checklist Execução

**Fase 1 (Beta Coordinator - 10 min)**
- [ ] Execute script Beta
- [ ] Adicione 5-10 testers com emails
- [ ] Salve tester list

**Fase 2 (Sentry Setup - 15 min) - PARALELO**
- [ ] Crie conta/login Sentry
- [ ] Crie projeto Backend
- [ ] Crie projeto Frontend
- [ ] Copie 2 DSNs

**Fase 3 (Sentry Activation - 10 min)**
- [ ] Execute: `node scripts/activate-sentry.mjs DSN1 DSN2`
- [ ] Aguarde 2 deploys
- [ ] Validar: `sentryConfigured: true`

**Fase 4 (Beta Convites - 5 min)**
- [ ] Abra `.planning/beta-invites-template.txt`
- [ ] Copie emails
- [ ] Crie Google Form de feedback
- [ ] Envie convites aos testers

---

## Status Após Ambos

✅ Sentry ativo em produção  
✅ Beta testers com invites prontos  
✅ Formulário de feedback pronto  
✅ Timeline para Dia 2 (amanhã): 09:00 testers começam

**GO para próxima fase quando:**
- Sentry health check mostre `sentryConfigured: true`
- Pelo menos 3 testers confirmarem recebimento do convite
