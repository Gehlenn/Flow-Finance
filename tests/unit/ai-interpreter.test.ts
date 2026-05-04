import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ai/aiMemory', () => ({
  getAIMemory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/ai/aiDebugService', () => ({
  logAIDebug: vi.fn(),
}));

import { interpretImage, interpretText } from '../../src/ai/aiInterpreter';

describe('aiInterpreter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs contextual data when text interpretation fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await interpretText(
      'gastei 50',
      'user-1',
      vi.fn().mockRejectedValue(new Error('text failed')),
    );

    expect(result.intent).toBe('unknown');
    expect(warnSpy).toHaveBeenCalledWith(
      '[AI Interpreter] Text interpretation failed:',
      expect.objectContaining({
        userId: 'user-1',
        inputLength: 9,
        error: expect.any(Error),
      }),
    );

    warnSpy.mockRestore();
  });

  it('normalizes invalid model intents to unknown and drops structured data', async () => {
    const result = await interpretText(
      'gastei 50',
      'user-1',
      vi.fn().mockResolvedValue({
        intent: 'something-else',
        data: [{ amount: 50, description: 'Mercado', type: 'expense' }],
      }),
    );

    expect(result.intent).toBe('unknown');
    expect(result.data).toEqual([]);
    expect(result.confidence).toBe(0.1);
  });

  it('logs contextual data when image interpretation fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await interpretImage(
      'data:image/png;base64,abc',
      'image/png',
      'nota fiscal',
      'user-1',
      vi.fn().mockRejectedValue(new Error('image failed')),
    );

    expect(result.intent).toBe('unknown');
    expect(warnSpy).toHaveBeenCalledWith(
      '[AI Interpreter] Image interpretation failed:',
      expect.objectContaining({
        userId: 'user-1',
        mimeType: 'image/png',
        hintLength: 11,
        error: expect.any(Error),
      }),
    );

    warnSpy.mockRestore();
  });
});
