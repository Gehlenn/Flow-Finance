import { beforeEach, describe, expect, it, vi } from 'vitest';

const logWarnMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => logWarnMock(...args),
}));

describe('ai cfo conversation store', () => {
  beforeEach(() => {
    localStorage.clear();
    logWarnMock.mockReset();
    vi.resetModules();
  });

  it('persiste e recupera conversa por usuario e workspace ativo', async () => {
    const store = await import('../../src/ai/cfoConversationStore');

    localStorage.setItem('active_workspace_id', 'ws-1');
    store.saveCFOConversation('user-1', [
      {
        id: 'm-1',
        role: 'user',
        text: 'Posso pagar a semana?',
        timestamp: '2026-05-14T10:00:00.000Z',
      },
    ]);

    localStorage.setItem('active_workspace_id', 'ws-2');
    store.saveCFOConversation('user-1', [
      {
        id: 'm-2',
        role: 'assistant',
        text: 'Seu caixa confirma cobertura para 7 dias.',
        timestamp: '2026-05-14T10:01:00.000Z',
      },
    ]);

    localStorage.setItem('active_workspace_id', 'ws-1');
    const ws1Messages = store.loadCFOConversation('user-1');
    expect(ws1Messages).toHaveLength(1);
    expect(ws1Messages[0]?.id).toBe('m-1');

    localStorage.setItem('active_workspace_id', 'ws-2');
    const ws2Messages = store.loadCFOConversation('user-1');
    expect(ws2Messages).toHaveLength(1);
    expect(ws2Messages[0]?.id).toBe('m-2');
  });

  it('limpa apenas a conversa do usuario no workspace ativo', async () => {
    const store = await import('../../src/ai/cfoConversationStore');

    localStorage.setItem('active_workspace_id', 'ws-1');
    store.saveCFOConversation('user-a', [
      {
        id: 'a-1',
        role: 'user',
        text: 'Resumo do caixa',
        timestamp: '2026-05-14T10:05:00.000Z',
      },
    ]);
    store.saveCFOConversation('user-b', [
      {
        id: 'b-1',
        role: 'user',
        text: 'Qual o risco da semana?',
        timestamp: '2026-05-14T10:06:00.000Z',
      },
    ]);

    store.clearCFOConversation('user-a');

    expect(store.loadCFOConversation('user-a')).toEqual([]);
    expect(store.loadCFOConversation('user-b')).toHaveLength(1);
  });

  it('retorna vazio e registra warning quando storage esta corrompido', async () => {
    const store = await import('../../src/ai/cfoConversationStore');

    localStorage.setItem('active_workspace_id', 'ws-corrupt');
    localStorage.setItem('flow_ai_cfo_conversation:ws-corrupt:user-corrupt', '{bad');

    const messages = store.loadCFOConversation('user-corrupt');

    expect(messages).toEqual([]);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[CFO Conversation Store] Failed to load conversation; returning empty list',
      expect.objectContaining({
        storageKey: 'flow_ai_cfo_conversation:ws-corrupt:user-corrupt',
        error: expect.any(Error),
        fallback: 'cfo-conversation-load-failed',
      }),
    );
  });
});
