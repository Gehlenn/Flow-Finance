# Runtime Guard

Sistema de proteção em runtime para o Flow Finance, responsável por detectar e recuperar automaticamente de falhas críticas da aplicação.

## 🛡️ Proteções Implementadas

### 1. API Guard
Monitora saúde do backend e detecta quando API está offline.

- Health check periódico (`/health`)
- Modo fallback automático quando API falha
- Rate limiting para evitar spam de requests
- Emite evento `api-offline` para componentes reagirem

### 2. Chunk Guard
Detecta falhas ao carregar chunks dinâmicos do Vite.

- Intercepta erros globais de import
- Detecta "Failed to fetch dynamically imported module"
- Mostra notificação visual para usuário
- Recarrega aplicação automaticamente após falha
- Limpa cache do service worker antes de reload

### 3. Service Worker Guard
Valida consistência do cache do service worker.

- Detecta caches desatualizados
- Limpa automaticamente caches antigos
- Força atualização de service workers registrados
- Versão esperada: `flow-finance-v3`

### 4. Version Guard
Monitora inconsistências de versão entre frontend e backend.

- Compara versão local com `/api/version`
- Notifica usuário quando há mismatch
- Oferece botão para atualizar imediatamente
- Rate limiting de 5 minutos entre checks

## 📦 Uso

### Inicialização Automática

O Runtime Guard é inicializado automaticamente em `index.tsx` antes do render do React:

```typescript
import { initializeRuntimeGuard } from './src/runtime';

await initializeRuntimeGuard({
  apiHealthCheckInterval: 60000,    // 1 minuto
  versionCheckInterval: 300000,     // 5 minutos
  enableChunkRetry: true,
  enableAutoReload: true,
});
```

### Uso Manual

```typescript
import { 
  checkAPIHealth, 
  isAPIOffline,
  checkAppVersion,
  validateServiceWorker 
} from './src/runtime';

// Verificar saúde da API
const apiStatus = await checkAPIHealth();
if (apiStatus.status === 'warning') {
  console.warn('API está offline');
}

// Checar se está em modo fallback
if (isAPIOffline()) {
  // Mostrar UI offline ou cache local
}

// Validar versão
const versionStatus = await checkAppVersion();

// Validar service worker
const swStatus = await validateServiceWorker();
```

## 🎯 Fluxo de Recuperação

### Chunk Loading Error
1. Erro detectado → Notificação visual aparecer
2. Aguarda 2s → Limpa cache do SW
3. Recarrega página automaticamente
4. Chunks atualizados são baixados

### API Offline
1. Health check falha → Modo fallback ativado
2. Evento `api-offline` disparado
3. Componentes escutam evento e adaptam UI
4. Retries automáticos a cada 30s

### Version Mismatch
1. Backend retorna versão diferente → Notificação aparece
2. Usuário clica "Atualizar Agora" → Reload
3. Nova versão carregada do servidor

### Service Worker Stale Cache
1. Cache antigo detectado → Limpeza automática
2. Service workers forçados a atualizar
3. Próximo request busca assets atualizados

## 🔧 Configuração

```typescript
interface RuntimeConfig {
  apiHealthCheckInterval?: number;   // ms entre checks de API
  versionCheckInterval?: number;     // ms entre checks de versão
  enableChunkRetry?: boolean;        // habilitar retry de chunks
  enableAutoReload?: boolean;        // recarregar automaticamente
}
```

## 🚨 UI de Erro Crítico

Quando múltiplos guards falham, uma tela modal é exibida:

- Lista todos os problemas detectados
- Oferece botão "Recarregar Aplicação"
- Overlay full-screen com backdrop blur
- Não pode ser fechado (forçar reload)

## 📊 Monitoramento

```typescript
import { getGuardStatus } from './src/runtime';

const status = getGuardStatus();
console.log('Initialized:', status.initialized);
console.log('Config:', status.config);
```

## 🎨 Notificações Visuais

Todas as notificações são injetadas via DOM puro (sem dependência de React):

- **Chunk Error**: Gradiente roxo, ícone de alerta, auto-reload
- **Version Mismatch**: Gradiente rosa, botão de atualização
- **Critical Error**: Modal full-screen vermelho, lista de erros

## ✅ Cobertura de Cenários

- ✅ Deploy novo com chunks diferentes (404)
- ✅ Backend offline durante uso
- ✅ Service worker cache antigo
- ✅ Frontend/backend em versões diferentes
- ✅ Network intermitente
- ✅ CDN failure temporário

## 🔐 Segurança

- Não expõe informações sensíveis em logs
- Rate limiting para evitar DDoS acidental
- Fallback gracioso em todos os cenários
- Não bloqueia inicialização mesmo com falhas
