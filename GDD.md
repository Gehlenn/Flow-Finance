# 🎮 GDD - GLOBAL DESIGN DOCUMENT (Flow Finance)

## Documento de Design e Mecânicas

**Versão**: 0.5.1v  
**Data**: 13 de Março de 2026  
**Escopo**: Flow Finance - Intelligent Cash Flow Management App (iOS/Android/Web)

---

## 1. VISÃO ESTRATÉGICA

### Missão
Democratizar a gestão financeira pessoal através de IA assistente inteligente que transforma dados brutos em insights acionáveis.

### Visão
Se tornar o app de finança pessoal #1 em uso intuitivo e IA assistiva em português.

### Proposição de Valor
- 🤖 **IA Assistant**: Entende linguagem natural em português
- ⚡ **Velocidade**: Transação em < 2 segundos
- 🔐 **Segurança**: AES-256 encryption, zero cloud exposure
- 📊 **Insights**: Recomendações automáticas baseadas em padrões
- 🏦 **Open Finance Seguro**: Conexão bancária via backend protegido com Pluggy e fallback controlado

---

## 2. PÚBLICO-ALVO

### Personas

#### 👤 João (CEO, 35 anos)
- Problema: Não sabe para onde vai o dinheiro
- Solução: Dashboard com insights automáticos
- Features: Smart categorization, trend analysis

#### 👤 Maria (Freelancer, 28)
- Problema: Múltiplas contas e difícil rastrear
- Solução: Agregação de contas + alerts
- Features: Multi-account sync, instant notifications

#### 👤 Pedro (Estudante, 22)
- Problema: Controlar bolsa + mesada + renda extra
- Solução: Interface amigável com IA helper
- Features: Voice input, visual budgeting

---

## 3. MECÂNICAS DE JOGO (Gamification)

### Sistema de Pontos & Streaks
```
Ação                     Pontos    Streak
+ Nova transação         10 pts    1 dia
+ Meta cumprida          100 pts   7 dias
+ Padrão identificado    50 pts    30 dias
+ Insight aplicado       75 pts    -
```

### Leaderboards Pessoais
- Maior economia mensal
- Melhor score de saúde financeira
- Mais transações categorizadas

### Achievements
- 🏆 "Organizador" - Categorizar 50 transações
- 🏆 "Economista" - Atingir meta mensal 3x
- 🏆 "Vai Corinthians" - Gastar 0 em futebol 30 dias

---

## 4. FLUXOS DE USUÁRIO

### 4.1 Fluxo: Adicionar Transação

```
┌─ Start ─┐
    │
    ├─ Text Input? ──→ AI Parse ──→ Confirm ──→ Save
    │
    ├─ Voice Input? ──→ Speech Recognition ──→ AI Parse ──→ Save
    │
    ├─ Receipt Photo? ──→ OCR ──→ Extract Data ──→ Confirm ──→ Save
    │
    └─ Manual Entry? ──→ Form Fill ──→ Save
        │
        └─ Dashboard Updated ✓
```

### 4.2 Fluxo: Visualizar Insights

```
┌─ Dashboard ─┐
       │
       ├─ Balance Summary (Renda vs Despesa)
       ├─ Top Categories (Gráfico)
       ├─ Recent Transactions (Lista)
       ├─ Smart Alerts (Warnings)
       │
       └─ "View Insights" ──→ AI Analysis
              │
              ├─ Daily Insights (Pattern detection)
              ├─ Strategic Report (Monthly review)
              ├─ Recommendations (Actionable)
              │
              └─ Apply? ──→ Update Budget
```

### 4.3 Fluxo: Configure Metas

```
┌─ Settings ─┐
      │
      ├─ Monthly Budget
      │  └─ Set by category or total
      │
      ├─ Spending Alerts
      │  └─ Notify when 80% reached
      │
      ├─ Recurring Transactions
      │  └─ Auto-create pattern-based
      │
      └─ AI Assistant Mode
         └─ On/Off voice input
```

---

## 5. ESTRUTURA DE DADOS

### Document: Transaction
```typescript
{
  id: string;
  amount: number;
  type: 'Receita' | 'Despesa';
  category: 'Pessoal' | 'Trabalho' | 'Negócio' | 'Investimento';
  description: string;
  date: ISO8601;
  source: 'manual' | 'ai_text' | 'ai_image' | 'import' | 'recurring';
  merchant?: string;
  tags?: string[];
  confidence_score?: number; // 0-1
  recurring?: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly';
  account_id?: string;
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

### Document: Account
```typescript
{
  id: string;
  name: string;
  type: 'Checking' | 'Savings' | 'Credit' | 'Investment';
  balance: number;
  currency: 'BRL' | 'USD' | 'EUR';
  sync_enabled?: boolean;
  last_sync?: ISO8601;
  created_at: ISO8601;
}
```

### Document: Goal
```typescript
{
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  category: string;
  deadline: ISO8601;
  priority: 'low' | 'medium' | 'high';
  created_at: ISO8601;
}
```

### Document: AIMemory
```typescript
{
  userId: string;
  patterns: {
    recurring_expenses: Transaction[];
    habits: Record<string, number>;
    preferences: Record<string, any>;
  };
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

---

## 6. WIREFRAMES & LAYOUTS

### Mobile (iOS/Android)
```
┌──────────────────┐
│  Flow Finance    │  ← Header com branding
├──────────────────┤
│ Balance: R$ 5000 │  ← Balance card
├──────────────────┤
│ 📊 Charts        │  ← Visual insights
├──────────────────┤
│ Recent Txs...    │  ← List
├──────────────────┤
│ [+  AI Input    ]│  ← Action button
│ [⚙️  Settings   ]│
└──────────────────┘
```

### Desktop (Web/PWA)
```
┌─────────────────────────────────────┐
│  🏦 FLOW FINANCE                    │
├──────────┬──────────────────────────┤
│ • Menu   │ Balance: R$ 5000         │
│ • Txs    │ [📊 Charts]              │
│ • Goals  │ [Recent Transactions]    │
│ • AI     │ [AI Insights Card]       │
│          │                          │
│ • About  │ [Action Buttons]         │
└──────────┴──────────────────────────┘
```

---

## 7. SISTEMA DE CORES & DESIGN

### Paleta (Dark Mode Default)
```
Primary:   #6366f1 (Indigo)     - Actions, highlights
Success:   #10b981 (Teal)       - Positive balance, gains
Danger:    #ef4444 (Red)        - Expenses, losses
Warning:   #f59e0b (Amber)      - Alerts, warnings
Dark:      #0f172a (Slate)      - Background
```

### Typography
- Headline: Inter 32px Bold
- Subheading: Inter 20px SemiBold
- Body: Inter 16px Regular
- Label: Inter 12px Medium

---

## 8. COMPONENTES PRINCIPAIS

### 1. Dashboard
**Props**: transactions[], balance, alerts[]  
**Events**: onCreateTransaction, onViewInsights  
**State**: selectedPeriod, viewMode

### 2. AIInput
**Props**: onAddTransaction, onAddReminder  
**Methods**: processText, processVoice, processImage  
**State**: isListening, isSending

### 3. TransactionList
**Props**: transactions[], onEdit, onDelete  
**Filters**: date, category, amount  
**Sort**: Recent, Amount, Category

### 4. Insights
**Props**: dailyInsights[], strategicReport  
**Methods**: applyRecommendation, trackAction  
**State**: selectedInsight

---

## 9. FLUXO DE DADOS (Redux/Zustand)

```
User Input → AI Processing → Local Storage → UI Update
    ↓            ↓                ↓            ↓
Voice/Text   Parse Intent    Encrypt Data   Re-render
Speech/Image  Extract Data    Persist       Dashboard
```

---

## 10. MICROCÓPIAS & TONE OF VOICE

### Tom
- 👍 Amigável, coloquial (você/tu)
- 👍 Otimista ("Que legal!" vs "Erro")
- 👍 Claro e conciso
- ❌ Técnico demais
- ❌ Muito corporativo

### Exemplos
```
❌ "Erro ao processar transação"
✅ "Hm, não consegui entender isso. Tenta novamente?"

❌ "Taxa anual de retorno: 12.34%"
✅ "Você investiu bem! Ganho: 12.34% ao ano"

❌ "Operação concluída com sucesso"
✅ "Pronto! Sua transação foi salva"
```

---

## 11. ROADMAP DE FEATURES

### v0.3 - ✅ CURRENT
- [x] Dashboard básico
- [x] AI Assistant
- [x] Encryption
- [x] Type safety

### v0.4 (15 Mar)
- [ ] CI/CD pipeline
- [ ] Android build
- [ ] Code splitting
- [ ] 100% tests

### v0.5 (30 Mar)
- [ ] Analytics
- [ ] PWA offline
- [ ] Performance monitoring
- [ ] Biometric auth

### v1.0 (15 Apr)
- [ ] Bank sync
- [ ] Budgeting AI
- [ ] Recurring automation
- [ ] Reports export

### v2.0 (Future)
- [ ] Multi-user sharing
- [ ] Investment tracking
- [ ] Tax planning
- [ ] Closed-loop automations

---

## 12. KPIs & SUCCESS METRICS

### User Metrics
- DAU (Daily Active Users) > 1000
- Retention Day 7 > 40%
- Retention Day 30 > 20%

### Engagement
- Avg transactions/user/day > 3
- Avg session duration > 5 min
- Feature adoption > 60%

### Quality
- Crash rate < 0.1%
- AI accuracy > 95%
- Loading time < 2s

---

## 13. ACESSIBILIDADE & COMPLIANCE

### WCAG 2.1 Level AA
- ✅ Color contrast > 4.5:1
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Text sizing

### Compliance
- ✅ LGPD (Brasil)
- ✅ Privacy by design
- ✅ No tracking
- ✅ User data control

---

**Documento Finalizado**: 8 de Março de 2026  
**Próxima Revisão**: v0.4.0
