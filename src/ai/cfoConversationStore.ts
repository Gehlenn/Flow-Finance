import { logWarn } from '../utils/logger';
import { getActiveWorkspaceScopedStorageKey } from '../utils/workspaceStorage';

export interface CFOConversationExplainability {
  reasons_used: string[];
  evidence: {
    confirmed_cash?: string;
    forecast_30d?: string;
    month_result?: string;
    data_quality_note?: string;
    base_sufficiency: 'strong' | 'limited';
  };
  confidence_band: 'low' | 'medium' | 'high';
}

export interface CFOConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  intent?: string;
  timestamp: string;
  diagnostic?: {
    kind: 'ai_unavailable';
    message: string;
    suggestion?: string;
  };
  explainability?: CFOConversationExplainability;
}

interface CFOConversationPayload {
  version: number;
  updatedAt: string;
  messages: CFOConversationMessage[];
}

const STORAGE_BASE_KEY = 'flow_ai_cfo_conversation';
const STORAGE_VERSION = 1;
const MAX_STORED_MESSAGES = 80;

function getConversationStorageKey(userId: string): string {
  const normalizedUserId = userId?.trim() || 'local';
  return `${getActiveWorkspaceScopedStorageKey(STORAGE_BASE_KEY)}:${normalizedUserId}`;
}

function normalizeMessages(messages: CFOConversationMessage[]): CFOConversationMessage[] {
  return messages
    .filter((message) => message && typeof message.text === 'string' && message.text.length > 0)
    .slice(-MAX_STORED_MESSAGES)
    .map((message) => ({
      id: String(message.id || ''),
      role: message.role === 'user' ? 'user' : 'assistant',
      text: String(message.text),
      intent: message.intent,
      timestamp: message.timestamp,
      diagnostic: message.diagnostic,
      explainability: message.explainability,
    }));
}

export function loadCFOConversation(userId: string): CFOConversationMessage[] {
  const storageKey = getConversationStorageKey(userId);

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Partial<CFOConversationPayload>;
    if (!parsed || !Array.isArray(parsed.messages)) {
      return [];
    }

    return normalizeMessages(parsed.messages as CFOConversationMessage[]);
  } catch (error) {
    logWarn('[CFO Conversation Store] Failed to load conversation; returning empty list', {
      storageKey,
      error,
      fallback: 'cfo-conversation-load-failed',
    });
    return [];
  }
}

export function saveCFOConversation(userId: string, messages: CFOConversationMessage[]): void {
  const storageKey = getConversationStorageKey(userId);

  try {
    const normalizedMessages = normalizeMessages(messages);
    const payload: CFOConversationPayload = {
      version: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      messages: normalizedMessages,
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    logWarn('[CFO Conversation Store] Failed to save conversation; keeping in-memory state', {
      storageKey,
      error,
      fallback: 'cfo-conversation-save-failed',
    });
  }
}

export function clearCFOConversation(userId: string): void {
  const storageKey = getConversationStorageKey(userId);

  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    logWarn('[CFO Conversation Store] Failed to clear conversation storage key', {
      storageKey,
      error,
      fallback: 'cfo-conversation-clear-failed',
    });
  }
}

