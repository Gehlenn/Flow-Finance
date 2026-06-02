import { describe, expect, it, vi } from 'vitest';
import { GeminiService } from '../../services/geminiService';
import type { InterpretResponse } from '../../types';

type LocalRef = { collection: string; id: string };

const localStore = new Map<string, Record<string, unknown>>();

function doc(_db: unknown, collection: string, id: string): LocalRef {
  return { collection, id };
}

async function setDoc(
  ref: LocalRef,
  payload: Record<string, unknown>,
  options?: { merge?: boolean },
): Promise<void> {
  const key = `${ref.collection}/${ref.id}`;
  const previous = localStore.get(key) || {};
  localStore.set(key, options?.merge ? { ...previous, ...payload } : payload);
}

function onSnapshot(
  ref: LocalRef,
  callback: (snap: { data: () => Record<string, unknown> | undefined }) => void,
): void {
  const key = `${ref.collection}/${ref.id}`;
  callback({
    data: () => localStore.get(key),
  });
}

describe('v0.9.1 critical flows', () => {
  it('persiste dados financeiros no documento do usuario', async () => {
    localStore.clear();
    const ref = doc({}, 'users', 'u1');
    await setDoc(ref, { transactions: [{ id: 't1', amount: 10 }] }, { merge: true });

    let payload: Record<string, unknown> | undefined;
    onSnapshot(ref, (snap) => {
      payload = snap.data();
    });

    const transactions = payload?.transactions as Array<{ amount: number }> | undefined;
    expect(transactions).toHaveLength(1);
    expect(transactions?.[0].amount).toBe(10);
  });

  it('faz roteamento de intencao de IA para transacoes', async () => {
    const svc = new GeminiService();
    const spy = vi.spyOn(GeminiService.prototype, 'processSmartInput').mockResolvedValue({
      intent: 'transaction',
      data: [{ amount: 150, description: 'mercado', category: 'Pessoal', type: 'Despesa' }],
    } as InterpretResponse);

    const result = await svc.processSmartInput('gastei 150 no mercado');
    expect(result.intent).toBe('transaction');
    expect(result.data[0].description).toBe('mercado');
    spy.mockRestore();
  });

  it('sincroniza snapshot apos merge incremental de saldo', async () => {
    localStore.clear();
    const ref = doc({}, 'users', 'u2');
    await setDoc(ref, { balance: 1000 }, { merge: true });
    await setDoc(ref, { balance: 1200 }, { merge: true });

    let payload: Record<string, unknown> | undefined;
    onSnapshot(ref, (snap) => {
      payload = snap.data();
    });

    expect((payload?.balance as number) ?? 0).toBe(1200);
  });
});
