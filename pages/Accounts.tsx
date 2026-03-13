import React, { useEffect, useState } from 'react';
import { Account, AccountType, ACCOUNT_TYPE_LABELS, DEFAULT_ACCOUNT } from '../models/Account';
import { getAccounts, createAccount, deleteAccount } from '../services/firebaseOptimized';
import { isSyncPermissionError } from '../src/utils/syncError';
import {
  Landmark, Wallet, CreditCard, TrendingUp,
  Plus, Trash2, X, Check, Loader2,
  PiggyBank
} from 'lucide-react';

interface AccountsProps {
  userId: string;
  hideValues: boolean;
}

const ACCOUNT_ICONS: Record<AccountType, React.ReactNode> = {
  bank: <Landmark size={20} />,
  cash: <Wallet size={20} />,
  credit_card: <CreditCard size={20} />,
  investment: <TrendingUp size={20} />,
};

const ACCOUNT_COLORS: Record<AccountType, string> = {
  bank: 'from-blue-500 to-blue-700',
  cash: 'from-emerald-500 to-emerald-700',
  credit_card: 'from-violet-500 to-violet-700',
  investment: 'from-amber-500 to-amber-600',
};

const Accounts: React.FC<AccountsProps> = ({ userId, hideValues }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'cash' as AccountType,
    balance: '',
  });

  const formatVal = (amt: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amt);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const data = await getAccounts(userId);

      // STEP 6: se não houver contas, cria a Carteira padrão
      if (data.length === 0) {
        const defaultAcc: Account = {
          ...DEFAULT_ACCOUNT,
          id: Math.random().toString(36).substr(2, 9),
          user_id: userId,
          created_at: new Date().toISOString(),
        };
        await createAccount(defaultAcc);
        setAccounts([defaultAcc]);
      } else {
        setAccounts(data);
      }
    } catch (error) {
      if (isSyncPermissionError(error)) {
        console.warn('Contas bloqueadas por permissão/autenticação no Firestore:', error);
        setAccounts([]);
      } else {
        console.error('Falha ao carregar contas:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [userId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setIsSaving(true);

    const newAccount: Account = {
      id: Math.random().toString(36).substr(2, 9),
      user_id: userId,
      name: form.name.trim(),
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      currency: 'BRL',
      created_at: new Date().toISOString(),
    };

    try {
      await createAccount(newAccount);
      setAccounts(prev => [...prev, newAccount]);
      setForm({ name: '', type: 'cash', balance: '' });
      setShowForm(false);
    } catch (error) {
      if (isSyncPermissionError(error)) {
        console.warn('Criação de conta bloqueada por permissão/autenticação:', error);
      } else {
        console.error('Falha ao criar conta:', error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (accounts.length <= 1) return; // Sempre manter ao menos 1
    try {
      await deleteAccount(id, userId);
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      if (isSyncPermissionError(error)) {
        console.warn('Remoção de conta bloqueada por permissão/autenticação:', error);
      } else {
        console.error('Falha ao remover conta:', error);
      }
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-700 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Contas</h2>
          <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Suas Carteiras & Bancos</p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
          <Landmark size={22} />
        </div>
      </div>

      {/* Card Saldo Total */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Total</p>
        <p className={`text-3xl font-black tracking-tight ${totalBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
          {hideValues ? '••••••' : formatVal(totalBalance)}
        </p>
        <p className="text-[9px] text-slate-400 mt-1">{accounts.length} conta{accounts.length !== 1 ? 's' : ''} ativa{accounts.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Lista de Contas */}
      <div className="flex flex-col gap-3">
        {accounts.map(account => (
          <div key={account.id} className="bg-white dark:bg-slate-800 rounded-[1.8rem] overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm flex items-stretch">
            <div className={`bg-gradient-to-b ${ACCOUNT_COLORS[account.type]} w-14 flex items-center justify-center text-white shrink-0`}>
              {ACCOUNT_ICONS[account.type]}
            </div>
            <div className="flex-1 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-black text-slate-900 dark:text-white text-sm">{account.name}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ACCOUNT_TYPE_LABELS[account.type]}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className={`font-black text-base ${account.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
                  {hideValues ? '••••' : formatVal(account.balance)}
                </p>
                {accounts.length > 1 && (
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="p-2 text-slate-300 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Botão Adicionar */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-4 rounded-[1.8rem] border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 text-indigo-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
        >
          <Plus size={16} /> Nova Conta
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nova Conta</p>
            <button type="button" onClick={() => setShowForm(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Nubank, Bradesco..."
              className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl outline-none font-bold text-sm text-slate-800 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map(type => (
                <button
                  key={type} type="button"
                  onClick={() => setForm({ ...form, type })}
                  className={`p-3 rounded-2xl border flex items-center gap-2 transition-all text-[9px] font-black uppercase tracking-tight ${form.type === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-700 border-transparent text-slate-400'}`}
                >
                  {ACCOUNT_ICONS[type]}
                  {ACCOUNT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Inicial (R$)</label>
            <input
              type="number" step="0.01"
              value={form.balance}
              onChange={e => setForm({ ...form, balance: e.target.value })}
              placeholder="0,00"
              className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl outline-none font-black text-lg text-slate-800 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Salvar Conta</>}
          </button>
        </form>
      )}

      {/* Empty state extra */}
      {accounts.length === 0 && !isLoading && (
        <div className="flex flex-col items-center py-12 gap-3 text-slate-300">
          <PiggyBank size={40} />
          <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma conta ainda</p>
        </div>
      )}
    </div>
  );
};

export default Accounts;
