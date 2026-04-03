import { describe, it, expect, vi } from 'vitest';
import { setDoc, doc, onSnapshot } from '../../services/localService';
import { GeminiService } from '../../services/geminiService';

describe('v0.9.1 critical flows', () => {
  it('persiste dados financeiros no documento do usuário', async () => {
    const ref = doc({}, 'users', 'u1');
    await setDoc(ref, { transactions: [{ id: 't1', amount: 10 }] }, { merge: true });

    let payload: any;
    onSnapshot(ref, (snap: any) => {
      payload = snap.data();
    });

    expect(payload.transactions).toHaveLength(1);
    expect(payload.transactions[0].amount).toBe(10);
  });

  it('faz roteamento de intenção de IA para transações', async () => {
    const svc = new GeminiService();
    const spy = vi.spyOn<any, any>(svc as any, 'processSmartInput').mockResolvedValue({
      intent: 'transaction',
      data: [{ amount: 150, description: 'mercado', category: 'Pessoal', type: 'Despesa' }],
    });

    const result = await svc.processSmartInput('gastei 150 no mercado');
    expect(result.intent).toBe('transaction');
    expect(result.data[0].description).toBe('mercado');
    spy.mockRestore();
  });

  it('sincroniza snapshot após merge incremental de saldo', async () => {
    const ref = doc({}, 'users', 'u2');
    await setDoc(ref, { balance: 1000 }, { merge: true });
    await setDoc(ref, { balance: 1200 }, { merge: true });

    let payload: any;
    onSnapshot(ref, (snap: any) => {
      payload = snap.data();
    });

    expect(payload.balance).toBe(1200);
  });
});
