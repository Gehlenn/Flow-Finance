# 🧪 Dia 2: Beta Testing Plan - Flow Finance v0.9.6

**Data Início**: 13 de Abril de 2026 (Dia 2 do Plano de 10 Dias)  
**Escopo**: Validação funcional de fluxos críticos com usuários selecionados  
**Meta**: Zero bloqueadores para Dia 3 (comunicação em massa)

---

## 📋 Objetivo

Validar que **todas as funcionalidades principais** trabalham conforme esperado em cenários reais. Colher feedback rápido de UX/usabilidade antes de grande audiência.

---

## 👥 Seleção de Testers (Beta)

### Perfil Ideal
- **Quantidade**: 5-10 usuários selecionados
- **O que eles fazem**: Usam fluxo de caixa em seu negócio (consultório, loja, freelancer)
- **Disposição**: Disponível para 30 min de teste + feedback rápido
- **Acesso**: Computador + celular (para testar responsiveness)

### Convite Padrão
```
Assunto: 🚀 Beta Access: Flow Finance v0.9.6

Olá [Nome],

Você foi selecionado para testar o Flow Finance antes do lançamento público!

Link: https://flow-finance-frontend-nine.vercel.app/
Login: Use sua conta (Google ou Microsoft)

Teste por 30 minutos e responda este form com feedback:
[Google Form link aqui]

Obrigado por ajudar, 
Time Flow
```

---

## 🎯 Cenários de Teste (UAT)

### Cenário 1: Onboarding & Login (5 min)

| Passo | Ação | Esperado | Status |
|------|------|----------|--------|
| 1 | Visita https://flow-finance-frontend-nine.vercel.app/ | Carrega em <3s, vê botão de login | [ ] |
| 2 | Clica "Login com Google" | Modal de autenticação abre | [ ] |
| 3 | Faz login com conta Google | Redireciona para Dashboard | [ ] |
| 4 | Vê Dashboard carregado | Saldo, transações, cards visíveis | [ ] |

**Bloqueador Crítico?** SIM
**Rollback se falhar?** SIM

---

### Cenário 2: Dashboard Principal (5 min)

| Passo | Ação | Esperado | Status |
|------|------|----------|--------|
| 1 | Na tela Dashboard | Vê saldo em grande, tendência mensal | [ ] |
| 2 | Scroll para baixo | Vê transações listadas com categorias | [ ] |
| 3 | Clica em 1 transação | Detalhe da transação abre | [ ] |
| 4 | Volta (browser back) | Volta ao Dashboard sem erro | [ ] |

**Bloqueador Crítico?** SIM
**Rollback se falhar?** SIM

---

### Cenário 3: Criar Transação (10 min)

| Passo | Ação | Esperado | Status |
|------|------|----------|--------|
| 1 | Clica no botão "+" (FAB) | Formulário de nova transação abre | [ ] |
| 2 | Preenche: Valor 150.00, Descrição "Café" | Valores aceitam entrada | [ ] |
| 3 | Aguarda 2 segundos | IA categoriza automaticamente em "Alimentação" | [ ] |
| 4 | Clica "Salvar" | Transação aparece na lista | [ ] |
| 5 | Desliga internet (dev tools) | Transação fica "em fila" visualmente | [ ] |
| 6 | Liga internet novamente | Transação sincroniza e marca como "Sincronizado" | [ ] |

**Bloqueador Crítico?** SIM (sync offline)
**Rollback se falhar?** SIM

---

### Cenário 4: Menu de Navegação (3 min)

| Passo | Ação | Esperado | Status |
|------|------|----------|--------|
| 1 | Vê bottom nav no mobile | 5 abas visíveis: Dashboard, Histórico, Fluxo, CFO, Ajustes | [ ] |
| 2 | Clica em "Histórico" | Lista completa de transações com filtros | [ ] |
| 3 | Clica em "Fluxo" | Gráfico de receitas vs saídas por mês | [ ] |
| 4 | Clica em "CFO" (IA) | Chat com assistente carrega | [ ] |
| 5 | Clica em "Ajustes" | Configurações de conta aparecem | [ ] |

**Bloqueador Crítico?** NÃO (navegação é gráfica)
**Rollback se falhar?** NÃO

---

### Cenário 5: IA Consultiva (5 min)

| Passo | Ação | Esperado | Status |
|------|------|----------|--------|
| 1 | Na tela CFO | Chat vazio com caixa de mensagem | [ ] |
| 2 | Digita "Qual foi meu maior gasto este mês?" | Mensagem envia | [ ] |
| 3 | Aguarda 3-5 segundos | IA responde com insight dos dados | [ ] |
| 4 | Digita "Recomenda algo?" | IA dá sugestão consultiva | [ ] |

**Bloqueador Crítico?** NÃO (IA desejável mas não essencial)
**Rollback se falhar?** NÃO

---

### Cenário 6: Upgrade para Pro (5 min) — Se Aplicável

| Passo | Ação | Esperado | Status |
|------|------|----------|--------|
| 1 | Tenta usar recurso Pro (ex: Insights) | Vê "Upgrade agora" prompt | [ ] |
| 2 | Clica "Upgrade" | Stripe checkout abre | [ ] |
| 3 | Testa com cartão de teste Stripe | `4242 4242 4242 4242` | [ ] |
| 4 | Completa checkout | Sucesso, volta ao app, acesso liberado | [ ] |

**Bloqueador Crítico?** NÃO (sandbox test)
**Rollback se falhar?** NÃO (Stripe é optional para beta)

---

### Cenário 7: Mobile Responsiveness (5 min)

| Passo | Ação | Esperado | Status |
|------|------|----------|--------|
| 1 | Usa app em iPhone 12 (ou Android) | Layout adequado, sem scroll horizontal | [ ] |
| 2 | Testa orientação landscape | Interface continua usável | [ ] |
| 3 | Testa em iPad/tablet | Distribuição de espaço OK | [ ] |

**Bloqueador Crítico?** NÃO
**Rollback se falhar?** NÃO

---

## 📊 Formulário de Feedback (Google Form)

Envie este form aos 5-10 testers:

```
FLOW FINANCE BETA - FEEDBACK FORM
==================================

1. Nome (opcional): _______

2. Qual foi seu primeiro impacto ao usar o app?
   [ ] Muito positivo
   [ ] Positivo
   [ ] Neutro
   [ ] Negativo

3. Qual funcionalidade mais gostou?
   [ ] Dashboard
   [ ] IA Consultiva
   [ ] Sync Offline
   [ ] Categorização Automática
   [ ] Outro: _______

4. Encontrou algum erro ou comportamento estranho?
   Descreva: ________________

5. Sugestões de melhoria (0-3 prioritárias):
   - ________________
   - ________________
   - ________________

6. Recomendaria para outros?
   [ ] Sim, com entusiasmo
   [ ] Sim, com reservas
   [ ] Talvez
   [ ] Não

7. Disponível para testar novamente amanhã?
   [ ] Sim
   [ ] Não
```

Compile respostas → Padrão de feedback → Priorize top 3 issues para Dia 3.

---

## 🔍 Matriz de Aceite Crítica (Dia 2 Final)

| Critério | Peso | Meta | Actual | Status |
|----------|------|------|--------|--------|
| **Onboarding** | 20% | 100% testers fazem login | n/10 | [ ] |
| **Dashboard** | 20% | 100% testers veem saldo | n/10 | [ ] |
| **Transação Create+Sync** | 30% | 100% testers criam transação | n/10 | [ ] |
| **Navegação** | 15% | 100% testers usam >3 abas | n/10 | [ ] |
| **Mobile OK** | 15% | >80% testers em mobile dizem "OK" | n% | [ ] |

**GO para Dia 3 se**: Todos os 5 critérios críticos em 90%+

---

## 📋 Checklist Execução Dia 2

- [ ] 5-10 testers selecionados e convidados
- [ ] Links de acesso (frontend URL) enviados
- [ ] Google Form de feedback compartilhado
- [ ] Tester 1 começou (monitor por erro em tempo real)
- [ ] Tester 2-5 começaram (aguarde 30 min)
- [ ] Colha respostas do form (por 2 horas)
- [ ] Analyze padrão de feedback
- [ ] If bloqueador crítico: hotfix imediato
- [ ] If tudo OK: Comunique "GO para Dia 3"
- [ ] Documente top 3 pontos de melhoria para Dia 3

---

## 🚨 Plano de Resposta Rápida (Se Erro Crítico)

### Se Onboarding Quebrou
```bash
# Checklist
1. Acesso ao Firebase de produção OK?
2. Vercel env vars (VITE_FIREBASE_*) presentes?
3. CORS configurado?

# Fix
- Revalidar Firebase config
- Redeploy immediato: npx vercel --prod --yes
- Notificar testers: "1 minuto downtime, estamos back"
```

### Se Transações Não Sincronizam
```bash
# Checklist
1. Backend POST /api/transactions respondendo?
2. Autenticação JWT funciona?

# Fix
- Checar logs backend: VERCEL_TARGET_URL=https://... npm run logs
- Rollback bundle se deploy recente quebrou
- Hotfix e redeploy
```

### Se IA Não Responde
```bash
# Checklist
1. Gemini API key configurada?
2. Rate limit atingido?

# Decision
- IA é "nice-to-have" em beta
- Se falha, não bloqueia GO para Dia 3
- Continue com OpenAI fallback ou desative para beta
```

---

## 📞 Suporte Durante Beta

### Para Tester
```
Email de suporte automático:
"Se encontrar um erro, capture screenshot + erro, 
responda este email ou acesse: [Slack/Discord/Forum]

Tempo de resposta esperado: <1 hora"
```

### Para Time Engineering
```
Monitore em tempo real:
- Vercel logs (errors, deployments)
- Form responses (colha a cada 15 min)
- Slack channel #flow-finance-beta
```

---

## ✅ Critério de Sucesso Dia 2

**SUCESSO** se:
- ✅ 5-10 testers completam 70%+ dos cenários
- ✅ Zero erros críticos (onboarding, transação, sync)
- ✅ >70% de "Positivo/Muito Positivo" no NPS
- ✅ Feedback forma padrão claro
- ✅ Nenhum showstopper identificado

**FALHA** se:
- ❌ >30% testers não conseguem fazer login
- ❌ Transações não sincronizam (offline crítico)
- ❌ Dashboard quebrado ou vazio
- ❌ >50% feedback "Negativo"

---

## 📅 Timeline Dia 2

```
08:00 - Preparar convites + form
08:30 - Enviar convites a 5-10 testers
09:00 - Tester 1 começa (monitor ativo)
09:15 - Tester 2-5 começam
10:00 - Checagens rápidas (tudo OK?)
10:30 - Coletar primeiro lote de feedback
11:30 - Análise de padrão
12:00 - Decisão: GO Dia 3 ou Hotfix?
14:00 - Feedback final + relatório
```

---

**Documento criado**: 2026-04-12  
**Revisão esperada**: Dia 2 (13 de Abril)  
**Próximo passo**: Selecionar testers e enviar convites
