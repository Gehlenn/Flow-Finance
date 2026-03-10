# AI Task Queue System

Sistema de fila de tarefas de IA para processamento assíncrono e resiliente.

## 📋 Visão Geral

O AI Task Queue é responsável por executar tarefas pesadas de IA de forma assíncrona, sem bloquear a interface do usuário. Ele oferece:

- ✅ **Execução assíncrona** - Tarefas não bloqueiam a UI
- ✅ **Sistema de retry** - Retry automático em caso de falha
- ✅ **Priorização** - Tarefas urgentes são executadas primeiro
- ✅ **Persistência** - Tarefas são salvas no localStorage
- ✅ **Monitoramento** - Interface visual para acompanhar progresso
- ✅ **Event-driven** - Eventos customizados para integração

## 🏗️ Arquitetura

```
┌─────────────────┐
│   UI/Component  │
│                 │
│  enqueueTask()  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  AITaskQueue    │  (Engine principal)
│                 │
│  - Enfileirar   │
│  - Priorizar    │
│  - Cancelar     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   TaskStore     │  (Persistência)
│                 │
│  localStorage   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    AIWorker     │  (Processador)
│                 │
│  - Poll tasks   │
│  - Execute      │
│  - Retry        │
└─────────────────┘
```

## 📦 Tipos de Tarefas

```typescript
enum AITaskType {
  INSIGHT_GENERATION = 'INSIGHT_GENERATION',
  CASHFLOW_SIMULATION = 'CASHFLOW_SIMULATION',
  FINANCIAL_REPORT = 'FINANCIAL_REPORT',
  LEAK_DETECTION = 'LEAK_DETECTION',
  AUTOPILOT_ANALYSIS = 'AUTOPILOT_ANALYSIS',
  RISK_ANALYSIS = 'RISK_ANALYSIS',
  SUBSCRIPTION_DETECTION = 'SUBSCRIPTION_DETECTION',
  SALARY_DETECTION = 'SALARY_DETECTION',
  FIXED_EXPENSE_DETECTION = 'FIXED_EXPENSE_DETECTION',
}
```

## 🚀 Uso Básico

### 1. Inicialização

```typescript
import { aiTaskQueue } from './src/ai/queue';

// No index.tsx (já inicializado automaticamente)
aiTaskQueue.initialize();
```

### 2. Enfileirar Tarefa

```typescript
import { aiTaskQueue, AITaskType, AITaskPriority } from './src/ai/queue';

// Método genérico
const taskId = aiTaskQueue.enqueueTask(
  AITaskType.INSIGHT_GENERATION,
  { transactions, accounts },
  userId,
  {
    priority: AITaskPriority.HIGH,
    maxRetries: 3,
  }
);

// Método de conveniência
const taskId = aiTaskQueue.enqueueInsightGeneration(userId, accounts, transactions);
```

### 3. Monitorar Progresso

```typescript
// Via eventos
window.addEventListener('ai-task-progress', (e: CustomEvent) => {
  const { taskId, status, progress, message } = e.detail;
  console.log(`Task ${taskId}: ${message} (${progress}%)`);
});

window.addEventListener('ai-task-result', (e: CustomEvent) => {
  const { taskId, success, data, error, executionTime } = e.detail;
  if (success) {
    console.log('Resultado:', data);
  }
});

// Via polling
const task = aiTaskQueue.getTask(taskId);
if (task?.status === AITaskStatus.COMPLETED) {
  const result = task.result;
}
```

## 🎯 Prioridades

```typescript
enum AITaskPriority {
  LOW = 0,       // Tarefas não urgentes (simulações)
  NORMAL = 1,    // Tarefas padrão (insights, relatórios)
  HIGH = 2,      // Tarefas importantes (leak detection, riscos)
  URGENT = 3,    // Tarefas críticas (análises em tempo real)
}
```

Tarefas são processadas por:
1. **Prioridade** (maior primeiro)
2. **Tempo de criação** (mais antiga primeiro)

## 🔄 Sistema de Retry

- Retry automático em caso de falha
- Delay exponencial entre tentativas
- Configurável por tarefa (default: 2 retries)
- Falhas permanentes após esgotar retries

## 💾 Persistência

- Tarefas salvas em `localStorage` com chave `flow_ai_task_queue`
- Limpeza automática de tarefas antigas (>24h)
- Limite de 100 tarefas armazenadas

## 📊 Monitoramento UI

```typescript
import AITaskQueueMonitor from './components/dev/AITaskQueueMonitor';

// Em App.tsx ou Dashboard
<AITaskQueueMonitor />
```

Interface visual mostra:
- Estatísticas (pendentes, processando, concluídas, falhas)
- Lista de tarefas recentes
- Progresso em tempo real
- Tempo de execução
- Erros e retries

## 🛠️ API Reference

### AITaskQueue

```typescript
// Inicializar
aiTaskQueue.initialize(): void

// Enfileirar
aiTaskQueue.enqueueTask(type, payload, userId, options?): string

// Consultar
aiTaskQueue.getTask(taskId): AITask | undefined
aiTaskQueue.getTaskStatus(taskId): AITaskStatus | null
aiTaskQueue.getTaskResult(taskId): any | null

// Gerenciar
aiTaskQueue.cancelTask(taskId): boolean
aiTaskQueue.clearCompletedTasks(userId?): void

// Estatísticas
aiTaskQueue.getQueueStats(): { pending, processing, completed, failed }
aiTaskQueue.getUserTasks(userId): AITask[]

// Métodos de conveniência
aiTaskQueue.enqueueInsightGeneration(userId, accounts, transactions): string
aiTaskQueue.enqueueCashflowSimulation(userId, transactions, horizon?): string
aiTaskQueue.enqueueFinancialReport(userId, transactions, month, year): string
aiTaskQueue.enqueueLeakDetection(userId, transactions): string
aiTaskQueue.enqueueAutopilotAnalysis(userId, accounts, transactions, goals?): string
aiTaskQueue.enqueueRiskAnalysis(userId, accounts, transactions): string
```

### Eventos Customizados

```typescript
// Tarefa enfileirada
'ai-task-enqueued': { taskId, type, priority }

// Progresso da tarefa
'ai-task-progress': { taskId, status, progress, message, timestamp }

// Resultado da tarefa
'ai-task-result': { taskId, success, data?, error?, executionTime, timestamp }
```

## 📝 Exemplo Completo

```typescript
import { aiTaskQueue, AITaskPriority } from './src/ai/queue';

// Componente React
function Dashboard() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);

    // Enfileirar tarefa
    const taskId = aiTaskQueue.enqueueTask(
      AITaskType.INSIGHT_GENERATION,
      { transactions, accounts },
      userId,
      { priority: AITaskPriority.HIGH }
    );

    // Escutar resultado
    const handleResult = (e: CustomEvent) => {
      if (e.detail.taskId === taskId) {
        if (e.detail.success) {
          setResult(e.detail.data);
        }
        setLoading(false);
        window.removeEventListener('ai-task-result', handleResult);
      }
    };

    window.addEventListener('ai-task-result', handleResult);

    // Timeout de segurança
    setTimeout(() => {
      const task = aiTaskQueue.getTask(taskId);
      if (task?.status === AITaskStatus.COMPLETED) {
        setResult(task.result);
      }
      setLoading(false);
    }, 30000); // 30s
  };

  return (
    <div>
      <button onClick={runAnalysis} disabled={loading}>
        {loading ? 'Processando...' : 'Analisar'}
      </button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
```

## 🔧 Configuração

No `index.tsx`:

```typescript
import { aiTaskQueue } from './src/ai/queue';

aiTaskQueue.initialize(); // Inicia worker automaticamente
```

## 📈 Performance

- **Polling interval**: 2s (ajustável em AIWorker)
- **Max tasks stored**: 100 (ajustável em TaskStore)
- **Task TTL**: 24h (ajustável em TaskStore)
- **Default retries**: 2 (configurável por tarefa)

## 🐛 Debugging

```typescript
// Ver todas as tarefas
console.log(taskStore.getAllTasks());

// Ver estatísticas
console.log(aiTaskQueue.getQueueStats());

// Limpar fila
taskStore.clear();
```

## ⚠️ Notas Importantes

1. **Worker é singleton** - Apenas uma instância processa tarefas
2. **Tarefas persistem** - Sobrevivem a reloads da página
3. **Não é queue distribuída** - Apenas local (localStorage)
4. **Limite de localStorage** - ~5-10MB típico
5. **Funções síncronas** - Serviços de IA devem aceitar await se assíncronos

## 🚀 Próximos Passos

- [ ] Adicionar suporte a Web Workers para processamento em thread separada
- [ ] Implementar queue distribuída com backend (opcional)
- [ ] Adicionar métricas de performance (tempo médio, taxa de sucesso)
- [ ] Suporte a pause/resume de tarefas
- [ ] Batching de tarefas similares
- [ ] Cache inteligente de resultados

## 📄 Licença

Parte do projeto Flow Finance.
