import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateCFOResponse } from '../../src/ai/aiCFO';
import { getAIDebugLogs, clearAIDebugLogs } from '../../src/ai/aiDebugService';
import { GeminiService } from '../../services/geminiService';

describe('generateCFOResponse debug logging', () => {
  beforeEach(() => {
    clearAIDebugLogs();
    vi.restoreAllMocks();
  });

  it('registra debug quando a resposta do CFO vem vazia', async () => {
    vi.spyOn(GeminiService.prototype, 'generateCFO').mockResolvedValueOnce({ answer: '' });

    const response = await generateCFOResponse(
      'Posso gastar esta semana?',
      'contexto',
      'spending_advice',
    );

    expect(response.answer).toContain('Nao foi possivel gerar uma resposta');
    const logs = getAIDebugLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].input).toBe('Posso gastar esta semana?');
    expect(logs[0].intent).toBe('spending_advice');
    expect(logs[0].error).toContain('empty fallback');
  });
});
