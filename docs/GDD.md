ï»¿# v0.8.0 â€” Auditoria TÃ©cnica
- Todos os fluxos crÃ­ticos validados
- Scanner, Dashboard, integraÃ§Ãµes e UX revisados
- Auditoria: ver AUDIT_REPORT_v0.8.0.md

# ðŸŽ® GDD - GLOBAL DESIGN DOCUMENT (Flow Finance)

## Documento de Design e MecÃ¢nicas

**VersÃ£o**: 0.9.1v  
**Data**: 2 de Abril de 2026  
**Escopo**: Flow Finance - Intelligent Cash Flow Management App (iOS/Android/Web)

### Status de Transicao 0.5.2v
- Protocolo iniciado com foco em hardening de dominio e confiabilidade operacional
- Validacao critica concluida com lint, testes unitarios e cobertura de fluxos sensiveis
- Fluxo Open Banking E2E ajustado para evitar falso-negativo de infraestrutura local

### Adendo de Transicao 0.9.1v
- Auditoria tÃ©cnica reforÃ§ada para riscos de XSS, autenticaÃ§Ã£o JWT, quotas de IA e sincronizaÃ§Ã£o multi-dispositivo.
- Fluxos crÃ­ticos priorizados para validaÃ§Ã£o contÃ­nua: cÃ¢mbio, sincronizaÃ§Ã£o de saldo, categorizaÃ§Ã£o IA e persistÃªncia.
- Requisito de consistÃªncia Web/Mobile reforÃ§ado com health check de console e regressÃµes E2E em mÃºltiplos engines.
- Diretriz de arquitetura para v0.9.x: consolidar lÃ³gica duplicada de categorizaÃ§Ã£o em serviÃ§o Ãºnico com cache e fallback.
- Encerramento de transicao: validacao final com lint, cobertura critica >= 98% e E2E verde no recorte da release.

---

## 1. VISÃƒO ESTRATÃ‰GICA

### MissÃ£o
Democratizar a gestÃ£o financeira pessoal atravÃ©s de IA assistente inteligente que transforma dados brutos em insights acionÃ¡veis.

### VisÃ£o
Se tornar o app de finanÃ§a pessoal #1 em uso intuitivo e IA assistiva em portuguÃªs.

### ProposiÃ§Ã£o de Valor
- ðŸ¤– **IA Assistant**: Entende linguagem natural em portuguÃªs
- âš¡ **Velocidade**: TransaÃ§Ã£o em < 2 segundos
- ðŸ” **SeguranÃ§a**: AES-256 encryption, zero cloud exposure
- ðŸ“Š **Insights**: RecomendaÃ§Ãµes automÃ¡ticas baseadas em padrÃµes
- ðŸ¦ **Open Finance Seguro**: ConexÃ£o bancÃ¡ria via backend protegido com Pluggy e fallback controlado

---

## 2. PÃšBLICO-ALVO

### Personas

#### ðŸ‘¤ JoÃ£o (CEO, 35 anos)
- Problema: NÃ£o sabe para onde vai o dinheiro
- SoluÃ§Ã£o: Dashboard com insights automÃ¡ticos
- Features: Smart categorization, trend analysis

#### ðŸ‘¤ Maria (Freelancer, 28)
- Problema: MÃºltiplas contas e difÃ­cil rastrear
- SoluÃ§Ã£o: AgregaÃ§Ã£o de contas + alerts
- Features: Multi-account sync, instant notifications

#### ðŸ‘¤ Pedro (Estudante, 22)
- Problema: Controlar bolsa + mesada + renda extra
- SoluÃ§Ã£o: Interface amigÃ¡vel com IA helper
- Features: Voice input, visual budgeting

---

## 3. MECÃ‚NICAS DE JOGO (Gamification)

### Sistema de Pontos & Streaks
```
AÃ§Ã£o                     Pontos    Streak
+ Nova transaÃ§Ã£o         10 pts    1 dia
+ Meta cumprida          100 pts   7 dias
+ PadrÃ£o identificado    50 pts    30 dias
+ Insight aplicado       75 pts    -
```

### Leaderboards Pessoais
- Maior economia mensal
- Melhor score de saÃºde financeira
- Mais transaÃ§Ãµes categorizadas

### Achievements
- ðŸ† "Organizador" - Categorizar 50 transaÃ§Ãµes
- ðŸ† "Economista" - Atingir meta mensal 3x
- ðŸ† "Vai Corinthians" - Gastar 0 em futebol 30 dias

---

## 4. FLUXOS DE USUÃRIO

### 4.1 Fluxo: Adicionar TransaÃ§Ã£o

```
â”Œâ”€ Start â”€â”
    â”‚
    â”œâ”€ Text Input? â”€â”€â†’ AI Parse â”€â”€â†’ Confirm â”€â”€â†’ Save
    â”‚
    â”œâ”€ Voice Input? â”€â”€â†’ Speech Recognition â”€â”€â†’ AI Parse â”€â”€â†’ Save
    â”‚
    â”œâ”€ Receipt Photo? â”€â”€â†’ OCR â”€â”€â†’ Extract Data â”€â”€â†’ Confirm â”€â”€â†’ Save
    â”‚
    â””â”€ Manual Entry? â”€â”€â†’ Form Fill â”€â”€â†’ Save
        â”‚
        â””â”€ Dashboard Updated âœ“
```

### 4.2 Fluxo: Visualizar Insights

```
â”Œâ”€ Dashboard â”€â”
       â”‚
       â”œâ”€ Balance Summary (Renda vs Despesa)
       â”œâ”€ Top Categories (GrÃ¡fico)
       â”œâ”€ Recent Transactions (Lista)
       â”œâ”€ Smart Alerts (Warnings)
       â”‚
       â””â”€ "View Insights" â”€â”€â†’ AI Analysis
              â”‚
              â”œâ”€ Daily Insights (Pattern detection)
              â”œâ”€ Strategic Report (Monthly review)
              â”œâ”€ Recommendations (Actionable)
              â”‚
              â””â”€ Apply? â”€â”€â†’ Update Budget
```

### 4.3 Fluxo: Configure Metas

```
â”Œâ”€ Settings â”€â”
      â”‚
      â”œâ”€ Monthly Budget
      â”‚  â””â”€ Set by category or total
      â”‚
      â”œâ”€ Spending Alerts
      â”‚  â””â”€ Notify when 80% reached
      â”‚
      â”œâ”€ Recurring Transactions
      â”‚  â””â”€ Auto-create pattern-based
      â”‚
      â””â”€ AI Assistant Mode
         â””â”€ On/Off voice input
```

---

## 5. ESTRUTURA DE DADOS

### Document: Transaction
```typescript
{
  id: string;
  amount: number;
  type: 'Receita' | 'Despesa';
  category: 'Pessoal' | 'Trabalho' | 'NegÃ³cio' | 'Investimento';
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
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Flow Finance    â”‚  â† Header com branding
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Balance: R$ 5000 â”‚  â† Balance card
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ ðŸ“Š Charts        â”‚  â† Visual insights
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Recent Txs...    â”‚  â† List
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ [+  AI Input    ]â”‚  â† Action button
â”‚ [âš™ï¸  Settings   ]â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Desktop (Web/PWA)
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  ðŸ¦ FLOW FINANCE                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ â€¢ Menu   â”‚ Balance: R$ 5000         â”‚
â”‚ â€¢ Txs    â”‚ [ðŸ“Š Charts]              â”‚
â”‚ â€¢ Goals  â”‚ [Recent Transactions]    â”‚
â”‚ â€¢ AI     â”‚ [AI Insights Card]       â”‚
â”‚          â”‚                          â”‚
â”‚ â€¢ About  â”‚ [Action Buttons]         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
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
User Input â†’ AI Processing â†’ Local Storage â†’ UI Update
    â†“            â†“                â†“            â†“
Voice/Text   Parse Intent    Encrypt Data   Re-render
Speech/Image  Extract Data    Persist       Dashboard
```

---

## 10. MICROCÃ“PIAS & TONE OF VOICE

### Tom
- ðŸ‘ AmigÃ¡vel, coloquial (vocÃª/tu)
- ðŸ‘ Otimista ("Que legal!" vs "Erro")
- ðŸ‘ Claro e conciso
- âŒ TÃ©cnico demais
- âŒ Muito corporativo

### Exemplos
```
âŒ "Erro ao processar transaÃ§Ã£o"
âœ… "Hm, nÃ£o consegui entender isso. Tenta novamente?"

âŒ "Taxa anual de retorno: 12.34%"
âœ… "VocÃª investiu bem! Ganho: 12.34% ao ano"

âŒ "OperaÃ§Ã£o concluÃ­da com sucesso"
âœ… "Pronto! Sua transaÃ§Ã£o foi salva"
```

---

## 11. ROADMAP DE FEATURES

### v0.3 - âœ… CURRENT
- [x] Dashboard bÃ¡sico
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
- âœ… Color contrast > 4.5:1
- âœ… Keyboard navigation
- âœ… Screen reader support
- âœ… Text sizing

### Compliance
- âœ… LGPD (Brasil)
- âœ… Privacy by design
- âœ… No tracking
- âœ… User data control

---

**Documento Finalizado**: 8 de MarÃ§o de 2026  
**PrÃ³xima RevisÃ£o**: v0.4.0

# v0.8.0 â€” Auditoria TÃ©cnica
- Todos os fluxos crÃ­ticos validados
- Scanner, Dashboard, integraÃ§Ãµes e UX revisados
- Auditoria: ver AUDIT_REPORT_v0.8.0.md

# ðŸŽ® GDD - GLOBAL DESIGN DOCUMENT (Flow Finance)

## Documento de Design e MecÃ¢nicas

**VersÃ£o**: 0.5.2v  
**Data**: 14 de MarÃ§o de 2026  
**Escopo**: Flow Finance - Intelligent Cash Flow Management App (iOS/Android/Web)

### Status de Transicao 0.5.2v
- Protocolo iniciado com foco em hardening de dominio e confiabilidade operacional
- Validacao critica concluida com lint, testes unitarios e cobertura de fluxos sensiveis
- Fluxo Open Banking E2E ajustado para evitar falso-negativo de infraestrutura local

---

## 1. VISÃƒO ESTRATÃ‰GICA

### MissÃ£o
Democratizar a gestÃ£o financeira pessoal atravÃ©s de IA assistente inteligente que transforma dados brutos em insights acionÃ¡veis.

### VisÃ£o
Se tornar o app de finanÃ§a pessoal #1 em uso intuitivo e IA assistiva em portuguÃªs.

### ProposiÃ§Ã£o de Valor
- ðŸ¤– **IA Assistant**: Entende linguagem natural em portuguÃªs
- âš¡ **Velocidade**: TransaÃ§Ã£o em < 2 segundos
- ðŸ” **SeguranÃ§a**: AES-256 encryption, zero cloud exposure
- ðŸ“Š **Insights**: RecomendaÃ§Ãµes automÃ¡ticas baseadas em padrÃµes
- ðŸ¦ **Open Finance Seguro**: ConexÃ£o bancÃ¡ria via backend protegido com Pluggy e fallback controlado

---

## 2. PÃšBLICO-ALVO

### Personas

#### ðŸ‘¤ JoÃ£o (CEO, 35 anos)
- Problema: NÃ£o sabe para onde vai o dinheiro
- SoluÃ§Ã£o: Dashboard com insights automÃ¡ticos
- Features: Smart categorization, trend analysis

#### ðŸ‘¤ Maria (Freelancer, 28)
- Problema: MÃºltiplas contas e difÃ­cil rastrear
- SoluÃ§Ã£o: AgregaÃ§Ã£o de contas + alerts
- Features: Multi-account sync, instant notifications

#### ðŸ‘¤ Pedro (Estudante, 22)
- Problema: Controlar bolsa + mesada + renda extra
- SoluÃ§Ã£o: Interface amigÃ¡vel com IA helper
- Features: Voice input, visual budgeting

---

## 3. MECÃ‚NICAS DE JOGO (Gamification)

### Sistema de Pontos & Streaks
```
AÃ§Ã£o                     Pontos    Streak
+ Nova transaÃ§Ã£o         10 pts    1 dia
+ Meta cumprida          100 pts   7 dias
+ PadrÃ£o identificado    50 pts    30 dias
+ Insight aplicado       75 pts    -
```

### Leaderboards Pessoais
- Maior economia mensal
- Melhor score de saÃºde financeira
- Mais transaÃ§Ãµes categorizadas

### Achievements
- ðŸ† "Organizador" - Categorizar 50 transaÃ§Ãµes
- ðŸ† "Economista" - Atingir meta mensal 3x
- ðŸ† "Vai Corinthians" - Gastar 0 em futebol 30 dias

---

## 4. FLUXOS DE USUÃRIO

### 4.1 Fluxo: Adicionar TransaÃ§Ã£o

```
â”Œâ”€ Start â”€â”
    â”‚
    â”œâ”€ Text Input? â”€â”€â†’ AI Parse â”€â”€â†’ Confirm â”€â”€â†’ Save
    â”‚
    â”œâ”€ Voice Input? â”€â”€â†’ Speech Recognition â”€â”€â†’ AI Parse â”€â”€â†’ Save
    â”‚
    â”œâ”€ Receipt Photo? â”€â”€â†’ OCR â”€â”€â†’ Extract Data â”€â”€â†’ Confirm â”€â”€â†’ Save
    â”‚
    â””â”€ Manual Entry? â”€â”€â†’ Form Fill â”€â”€â†’ Save
        â”‚
        â””â”€ Dashboard Updated âœ“
```

### 4.2 Fluxo: Visualizar Insights

```
â”Œâ”€ Dashboard â”€â”
       â”‚
       â”œâ”€ Balance Summary (Renda vs Despesa)
       â”œâ”€ Top Categories (GrÃ¡fico)
       â”œâ”€ Recent Transactions (Lista)
       â”œâ”€ Smart Alerts (Warnings)
       â”‚
       â””â”€ "View Insights" â”€â”€â†’ AI Analysis
              â”‚
              â”œâ”€ Daily Insights (Pattern detection)
              â”œâ”€ Strategic Report (Monthly review)
              â”œâ”€ Recommendations (Actionable)
              â”‚
              â””â”€ Apply? â”€â”€â†’ Update Budget
```

### 4.3 Fluxo: Configure Metas

```
â”Œâ”€ Settings â”€â”
      â”‚
      â”œâ”€ Monthly Budget
      â”‚  â””â”€ Set by category or total
      â”‚
      â”œâ”€ Spending Alerts
      â”‚  â””â”€ Notify when 80% reached
      â”‚
      â”œâ”€ Recurring Transactions
      â”‚  â””â”€ Auto-create pattern-based
      â”‚
      â””â”€ AI Assistant Mode
         â””â”€ On/Off voice input
```

---

## 5. ESTRUTURA DE DADOS

### Document: Transaction
```typescript
{
  id: string;
  amount: number;
  type: 'Receita' | 'Despesa';
  category: 'Pessoal' | 'Trabalho' | 'NegÃ³cio' | 'Investimento';
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
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Flow Finance    â”‚  â† Header com branding
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Balance: R$ 5000 â”‚  â† Balance card
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ ðŸ“Š Charts        â”‚  â† Visual insights
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Recent Txs...    â”‚  â† List
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ [+  AI Input    ]â”‚  â† Action button
â”‚ [âš™ï¸  Settings   ]â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Desktop (Web/PWA)
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  ðŸ¦ FLOW FINANCE                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ â€¢ Menu   â”‚ Balance: R$ 5000         â”‚
â”‚ â€¢ Txs    â”‚ [ðŸ“Š Charts]              â”‚
â”‚ â€¢ Goals  â”‚ [Recent Transactions]    â”‚
â”‚ â€¢ AI     â”‚ [AI Insights Card]       â”‚
â”‚          â”‚                          â”‚
â”‚ â€¢ About  â”‚ [Action Buttons]         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
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
User Input â†’ AI Processing â†’ Local Storage â†’ UI Update
    â†“            â†“                â†“            â†“
Voice/Text   Parse Intent    Encrypt Data   Re-render
Speech/Image  Extract Data    Persist       Dashboard
```

---

## 10. MICROCÃ“PIAS & TONE OF VOICE

### Tom
- ðŸ‘ AmigÃ¡vel, coloquial (vocÃª/tu)
- ðŸ‘ Otimista ("Que legal!" vs "Erro")
- ðŸ‘ Claro e conciso
- âŒ TÃ©cnico demais
- âŒ Muito corporativo

### Exemplos
```
âŒ "Erro ao processar transaÃ§Ã£o"
âœ… "Hm, nÃ£o consegui entender isso. Tenta novamente?"

âŒ "Taxa anual de retorno: 12.34%"
âœ… "VocÃª investiu bem! Ganho: 12.34% ao ano"

âŒ "OperaÃ§Ã£o concluÃ­da com sucesso"
âœ… "Pronto! Sua transaÃ§Ã£o foi salva"
```

---

## 11. ROADMAP DE FEATURES

### v0.3 - âœ… CURRENT
- [x] Dashboard bÃ¡sico
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
- âœ… Color contrast > 4.5:1
- âœ… Keyboard navigation
- âœ… Screen reader support
- âœ… Text sizing

### Compliance
- âœ… LGPD (Brasil)
- âœ… Privacy by design
- âœ… No tracking
- âœ… User data control

---

**Documento Finalizado**: 8 de MarÃ§o de 2026  
**PrÃ³xima RevisÃ£o**: v0.4.0


## Addendum v0.9.1 â€” Regras crÃ­ticas
- CategorizaÃ§Ã£o IA automÃ¡tica apenas com limiar mÃ­nimo de confianÃ§a.
- Regras determinÃ­sticas tÃªm precedÃªncia sobre fallback IA.
- Toda persistÃªncia deve ser obrigatoriamente workspace-scoped.
