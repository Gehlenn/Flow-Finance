# AI Memory System 2.0

Sistema de aprendizado comportamental para o Flow Finance que permite à IA aprender padrões financeiros do usuário ao longo do tempo.

## 📋 Visão Geral

O AI Memory System 2.0 é um sistema avançado de memória que analisa transações e aprende padrões comportamentais do usuário, tornando a IA mais inteligente e personalizada com o tempo.

## 🧠 Tipos de Memória

### 1. **SPENDING_PATTERN**
Padrões de gastos detectados:
- Gastos em finais de semana
- Gastos durante a semana
- Gastos no início/fim do mês
- Padrões sazonais

### 2. **MERCHANT_CATEGORY**
Comerciantes frequentes:
- Nome do estabelecimento
- Categoria
- Frequência média (visitas/mês)
- Gasto médio por visit
- Total gasto

### 3. **RECURRING_EXPENSE**
Despesas recorrentes:
- Assinaturas
- Pagamentos fixos mensais
- Frequência (diária/semanal/mensal/anual)
- Próxima data esperada
- Nível de confiança

### 4. **USER_BEHAVIOR**
Comportamentos detectados:
- Gastos impulsivos
- Consciente do orçamento
- Gastador de fim de semana
- Comprador online
- Usuário de crédito/débito

### 5. **FINANCIAL_PROFILE**
Perfil financeiro:
- Conservative / Moderate / Aggressive
- Taxa de poupança
- Renda média mensal
- Despesas média mensal
- Tolerância ao risco

### 6. **INCOME_PATTERN**
Padrões de renda:
- Fonte de renda (salário, freelance, investimento)
- Valor médio
- Frequência (semanal, quinzenal, mensal)
- Estabilidade

### 7. **TIME_PATTERN**
Padrões temporais:
- Dia da semana preferencial para gastos
- Períodos do dia
- Categorias por horário

## 🏗️ Arquitetura

```
┌─────────────────────┐
│   Transactions      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Memory Analyzer    │  ← Detecta padrões
│                     │
│  - Spending         │
│  - Merchants        │
│  - Recurring        │
│  - Behaviors        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Memory Engine      │  ← Salva/atualiza
│                     │
│  - Confidence       │
│  - Strength         │
│  - Occurrences      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Memory Store      │  ← localStorage
│                     │
│  - Persistence      │
│  - Decay System     │
│  - Query Engine     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────────┐
│   AI Components                     │
│                                     │
│  - AI CFO (contexto enriquecido)   │
│  - Autopilot (ações personalizadas)│
│  - Orchestrator (aprendizado)      │
│  - Insights (padrões históricos)   │
└─────────────────────────────────────┘
```

## 📊 Memory Entry Structure

```typescript
interface AIMemoryEntry {
  id: string;
  userId: string;
  type: AIMemoryType;
  key: string; // Identifier único
  value: any; // Dado estruturado
  confidence: number; // 0-1 confiança
  strength: number; // 0-100 força do padrão
  occurrences: number; // Quantas vezes observado
  createdAt: number;
  updatedAt: number;
  lastObservedAt: number;
  metadata?: Record<string, any>;
}
```

## 🔄 Memory Lifecycle

### 1. **Creation**
- Mínimo de 3 ocorrências para criar memória
- Confidence inicial baseado na frequência
- Strength inicial: 10 pontos

### 2. **Update**
- Cada observação aumenta occurrences
- Strength aumenta +10 (máx 100)
- Confidence é recalculado (média)
- updatedAt e lastObservedAt atualizados

### 3. **Decay**
- Memórias antigas perdem confidence/strength
- Taxa de decay: 1% por dia
- Janela de relevância: 90 dias
- Memórias abaixo de 20% confidence são deletadas

### 4. **Query**
- Filtros: type, confidence, strength, date range
- Ordenação: strength > confidence > updatedAt
- Limite de resultados configurável

## 🚀 Como Usar

### Atualizar Memórias

```typescript
import { updateAIMemory } from './src/ai/memory';

// Analisa transações e atualiza memórias
const memoriesUpdated = await updateAIMemory(userId, transactions);
console.log(`${memoriesUpdated} memórias atualizadas`);
```

### Consultar Padrões de Gastos

```typescript
import { getSpendingPatterns } from './src/ai/memory';

const patterns = getSpendingPatterns(userId);
patterns.forEach(pattern => {
  console.log(pattern.description);
  // "Você gasta em média R$ 250,00 aos finais de semana"
});
```

### Consultar Comerciantes Frequentes

```typescript
import { getMerchantCategories } from './src/ai/memory';

const merchants = getMerchantCategories(userId);
merchants.forEach(merchant => {
  console.log(`${merchant.merchantName}: ${merchant.frequency} visitas/mês`);
});
```

### Detectar Comportamentos

```typescript
import { hasBehavior, getUserBehaviors } from './src/ai/memory';

if (hasBehavior(userId, 'impulsive_spending')) {
  console.log('Usuário tem padrão de gastos impulsivos');
}

const behaviors = getUserBehaviors(userId);
// [{ behavior: 'impulsive_spending', score: 75, evidence: [...] }]
```

### Consultar Perfil Financeiro

```typescript
import { getFinancialProfile } from './src/ai/memory';

const profile = getFinancialProfile(userId);
if (profile) {
  console.log(`Perfil: ${profile.profile}`); // conservative/moderate/aggressive
  console.log(`Taxa de poupança: ${profile.savingsRate}%`);
}
```

## 🔗 Integrações

### AI Orchestrator

Atualiza memórias automaticamente após processar transações:

```typescript
// Em aiOrchestrator.ts
await updateAIMemory(userId, transactions);
```

### AI CFO

Usa memórias para enriquecer o contexto das respostas:

```typescript
// Em aiCFO.ts - buildFinancialContext()
const spendingPatterns = getSpendingPatterns(userId);
const behaviors = getUserBehaviors(userId);
const profile = getFinancialProfile(userId);

// Adiciona ao contexto enviado para a LLM
```

Exemplos de respostas enriquecidas:
- "Com base no seu perfil conservador e taxa de poupança de 25%..."
- "Você costuma gastar mais aos finais de semana (42% das despesas)..."
- "Identificamos um padrão de compras impulsivas..."

### Autopilot

Gera ações personalizadas baseadas em memórias:

```typescript
// Em financialAutopilot.ts
if (hasBehavior(userId, 'impulsive_spending')) {
  actions.push({
    type: 'suggestion',
    title: 'Padrão de compras impulsivas detectado',
    description: 'Tente aguardar 24h antes de compras não-planejadas',
  });
}
```

Tipos de ações geradas:
- **Weekend spending**: Orçamento específico para lazer
- **Impulsive spending**: Sugestão de espera de 24h
- **Multiple subscriptions**: Revisão de assinaturas
- **High-frequency merchants**: Insights sobre visitas frequentes

## 📈 Métricas e Estatísticas

```typescript
import { getMemoryStats } from './src/ai/memory';

const stats = getMemoryStats(userId);
/*
{
  totalMemories: 47,
  byType: {
    SPENDING_PATTERN: 5,
    MERCHANT_CATEGORY: 15,
    RECURRING_EXPENSE: 8,
    USER_BEHAVIOR: 3,
    FINANCIAL_PROFILE: 1,
    ...
  },
  avgConfidence: 0.76,
  avgStrength: 65,
  oldestMemory: 1234567890000,
  newestMemory: 1234567890000,
  lastUpdated: 1234567890000
}
*/
```

## ⚙️ Configuração

### Learning Config

```typescript
import { aiMemoryEngine } from './src/ai/memory';

aiMemoryEngine.setLearningConfig({
  minOccurrences: 3, // Mínimo de observações
  confidenceThreshold: 0.3, // Confidence mínimo
  strengthIncrement: 10, // Aumento por observação
  maxMemoriesPerType: 50, // Limite por tipo
});
```

### Decay Config

```typescript
import { aiMemoryStore } from './src/ai/memory';

aiMemoryStore.setDecayConfig({
  enabled: true,
  decayRate: 0.01, // 1% por dia
  minConfidence: 0.2, // Deletar abaixo de 20%
  timeWindow: 90, // 90 dias de janela
});
```

## 🗄️ Armazenamento

- **Key**: `flow_ai_memory_v2`
- **Local**: localStorage
- **Formato**: JSON array de memórias
- **Limite**: 500 memórias por usuário
- **Limpeza**: Automática (memórias antigas decaem)

## 🔒 Privacidade

- Todas as memórias são armazenadas localmente
- Nenhum dado é enviado para servidores externos
- Usuário pode limpar memórias a qualquer momento
- Decay automático remove padrões antigos

## 🧹 Manutenção

### Limpar Memórias de Usuário

```typescript
import { aiMemoryEngine } from './src/ai/memory';

aiMemoryEngine.clearUserMemories(userId);
```

### Limpar Todas as Memórias

```typescript
import { aiMemoryStore } from './src/ai/memory';

aiMemoryStore.clear();
```

## 📊 Benefícios

1. **AI CFO mais inteligente**: Respostas personalizadas baseadas em histórico
2. **Autopilot proativo**: Ações específicas para o comportamento do usuário
3. **Insights relevantes**: Padrões detectados automaticamente
4. **Aprendizado contínuo**: Melhora com o uso
5. **Privacidade**: Tudo armazenado localmente

## 🔮 Exemplos de Aprendizado

### Depois de 1 mês:
- "Você costuma gastar mais aos sábados"
- "Mercado XYZ é seu comerciante mais frequente"
- "3 assinaturas detectadas"

### Depois de 3 meses:
- "Perfil: Moderate, taxa de poupança de 18%"
- "Padrão de gastos impulsivos detectado (score: 65)"
- "8 estabelecimentos frequentes identificados"
- "Renda estável detectada: R$ 4.500/mês"

### Depois de 6 meses:
- "Você gasta 42% a mais aos finais de semana"
- "15 assinaturas recorrentes (R$ 350/mês)"
- "Comportamento: budget_conscious confirmado"
- "Categoria dominante: Alimentação (32% dos gastos)"

## 🛠️ Debugging

```typescript
// Ver todas as memórias
import { aiMemoryStore } from './src/ai/memory';
console.log(aiMemoryStore.getAllMemories());

// Ver estatísticas
import { getMemoryStats } from './src/ai/memory';
console.log(getMemoryStats(userId));

// Forçar atualização
import { updateAIMemory } from './src/ai/memory';
await updateAIMemory(userId, transactions);
```

## 📄 Arquivos

- `memoryTypes.ts` - Definições de tipos e interfaces
- `AIMemoryStore.ts` - Armazenamento e persistência
- `memoryAnalyzer.ts` - Análise de padrões
- `AIMemoryEngine.ts` - Engine principal de aprendizado
- `index.ts` - Exports públicos

## 🎯 Roadmap

- [ ] Web Workers para análise em background
- [ ] Exportar/importar memórias
- [ ] Dashboard visual de memórias
- [ ] Machine learning para predições
- [ ] Sincronização multi-dispositivo (opcional)
- [ ] Memórias colaborativas (patterns comuns)

## 📝 Licença

Parte do projeto Flow Finance.
