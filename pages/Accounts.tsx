import React, { useState } from 'react';
import { Account, AccountType, ACCOUNT_TYPE_LABELS } from '../models/Account';
import { logWarn } from '../src/utils/logger';
import {
  Landmark, Wallet, CreditCard, TrendingUp,
  Plus, Trash2, X, Check, Loader2,
  PiggyBank
} from 'lucide-react';

interface AccountsProps {
  userId: string;
  hideValues: boolean;
  activeWorkspaceName?: string | null;
  activeTenantName?: string | null;
  activeWorkspaceRole?: 'owner' | 'admin' | 'member' | 'viewer' | null;
  accounts: Account[];
  onCreateAccount: (account: { name: string; type: AccountType; balance: number }) => Promise<void>;
  onDeleteAccount: (accountId: string) => void;
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

function buildBalanceErrorDiagnostic(): { title: string; message: string; suggestion: string } {
  return {
    title: 'Saldo inicial invalido',
    message: 'O valor informado nao pode ser convertido em moeda.',
    suggestion: 'Digite um numero valido como 0,00, 123,45 ou 1.234,56.',
  };
}

function buildCreateAccountDiagnostic(): { title: string; message: string; suggestion: string } {
  return {
    title: 'Falha ao criar conta',
    message: 'Nao foi possivel salvar a conta agora.',
    suggestion: 'Confirme a sessao, tente novamente e verifique se o workspace aceita novas contas.',
  };
}
const Accounts: React.FC<AccountsProps> = ({ hideValues, activeWorkspaceName, activeTenantName, activeWorkspaceRole, accounts, onCreateAccount, onDeleteAccount }) => {
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceDiagnostic, setBalanceDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [createAccountDiagnostic, setCreateAccountDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const canEdit = activeWorkspaceRole !== 'viewer';

  const [form, setForm] = useState({
    name: '',
    type: 'cash' as AccountType,
    balance: '',
  });

  const openForm = () => {
    setForm({ name: '', type: 'cash', balance: '' });
    setBalanceError(null);
    setBalanceDiagnostic(null);
    setCreateAccountDiagnostic(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setForm({ name: '', type: 'cash', balance: '' });
    setBalanceError(null);
    setBalanceDiagnostic(null);
    setCreateAccountDiagnostic(null);
    setShowForm(false);
  };

  const parsePtBRBalance = (val: string): number | null => {
    if (!val.trim()) return 0;
    // Aceitar pt-BR: 1.234,56 ou 1234,56 ou 1234.56
    const normalized = val.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    if (isNaN(parsed)) return null;
    return parsed;
  };

  const formatVal = (amt: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amt);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const parsedBalance = parsePtBRBalance(form.balance);
    if (parsedBalance === null) {
      const diagnostic = buildBalanceErrorDiagnostic();
      setBalanceError(diagnostic.title);
      setBalanceDiagnostic(diagnostic);
      setCreateAccountDiagnostic(null);
      return;
    }
    setBalanceError(null);
    setBalanceDiagnostic(null);
    setCreateAccountDiagnostic(null);
    setIsSaving(true);

    try {
      await onCreateAccount({
        name: form.name.trim(),
        type: form.type,
        balance: parsedBalance,
      });
      closeForm();
    } catch (error) {
      logWarn('[Accounts] Failed to create account', {
        error,
        fallback: 'accounts-create-account-failed',
      });
      setCreateAccountDiagnostic(buildCreateAccountDiagnostic());
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    if (accounts.length <= 1) return;
    onDeleteAccount(id);
  };

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-700 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-500 p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Caixa e contas</h2>
          <p className="text-xs font-black text-white/70 uppercase tracking-widest mt-1.5">Carteiras, bancos e saldo consolidado</p>
          <p className="text-xs font-black text-white/80 uppercase tracking-widest mt-2">
            Workspace: {activeWorkspaceName || 'Carregando workspace'}
          </p>
          <p className="text-xs font-black text-white/70 uppercase tracking-widest mt-1">
            Tenant: {activeTenantName || 'Tenant ativo'} · Role: {activeWorkspaceRole || 'member'}
          </p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
          <Landmark size={22} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Saldo consolidado</p>
        <p className={`text-3xl font-black tracking-tight ${totalBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
          {hideValues ? '••••••' : formatVal(totalBalance)}
        </p>
        <p className="text-xs text-slate-400 mt-1">{accounts.length} conta{accounts.length !== 1 ? 's' : ''} ativa{accounts.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex flex-col gap-3">
        {accounts.map(account => (
          <div key={account.id} className="bg-white dark:bg-slate-800 rounded-[1.8rem] overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm flex items-stretch">
            <div className={`bg-gradient-to-b ${ACCOUNT_COLORS[account.type]} w-14 flex items-center justify-center text-white shrink-0`}>
              {ACCOUNT_ICONS[account.type]}
            </div>
            <div className="flex-1 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-black text-slate-900 dark:text-white text-sm">{account.name}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{ACCOUNT_TYPE_LABELS[account.type]}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className={`font-black text-base ${account.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
                  {hideValues ? '••••' : formatVal(account.balance)}
                </p>
                {accounts.length > 1 && canEdit && (
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

      {!showForm && canEdit ? (
      <button type="button" onClick={openForm}
          className="w-full py-4 rounded-[1.8rem] border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 text-indigo-500 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
        >
          <Plus size={16} /> Nova conta de caixa
        </button>
      ) : canEdit ? (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Nova conta de caixa</p>
            <button type="button" onClick={closeForm} aria-label="Fechar" className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
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
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map(type => (
                <button
                  key={type} type="button"
                  onClick={() => setForm({ ...form, type })}
                  className={`p-3 rounded-2xl border flex items-center gap-2 transition-all text-xs font-black uppercase tracking-tight ${form.type === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-700 border-transparent text-slate-400'}`}
                >
                  {ACCOUNT_ICONS[type]}
                  {ACCOUNT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Inicial (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.balance}
              onChange={e => { setForm({ ...form, balance: e.target.value }); setBalanceError(null); setBalanceDiagnostic(null); setCreateAccountDiagnostic(null); }}
              placeholder="0,00"
              className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl outline-none font-black text-lg text-slate-800 dark:text-white"
            />
            {balanceError && <p className="text-xs text-rose-500 font-bold ml-1">{balanceError}</p>}
            {balanceDiagnostic && (
              <div role="status" className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 p-3 space-y-1">
                <p className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">{balanceDiagnostic.title}</p>
                <p className="text-xs font-bold text-rose-700 dark:text-rose-100">{balanceDiagnostic.message}</p>
                <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-300">Proximo passo: {balanceDiagnostic.suggestion}</p>
              </div>
            )}
            {createAccountDiagnostic && (
              <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-1">
                <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">{createAccountDiagnostic.title}</p>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-100">{createAccountDiagnostic.message}</p>
                <p className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">Proximo passo: {createAccountDiagnostic.suggestion}</p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Salvar Conta</>}
          </button>
        </form>
      ) : (
        <div className="w-full py-4 rounded-[1.8rem] border border-slate-200 dark:border-slate-700 text-slate-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
          Workspace em modo leitura
        </div>
      )}

      {accounts.length === 0 && (
        <div className="flex flex-col items-center py-12 gap-3 text-slate-300">
          <PiggyBank size={40} />
          <p className="text-xs font-black uppercase tracking-widest">Nenhuma conta ainda</p>
        </div>
      )}
    </div>
  );
};

export default Accounts;

