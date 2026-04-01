
import React, { useState, useEffect, useRef } from 'react';
import { Landmark, ShieldCheck, Plus, RefreshCw, X, Loader2, Search, Trash2, ExternalLink, ChevronRight } from 'lucide-react';
import { getWorkspaceScopedStorageKey } from '../src/utils/workspaceStorage';

interface BankAccount {
  id: string;
  name: string;
  balance: number;
  status: 'Conectado' | 'Pendente' | 'Erro';
  color: string;
  type: 'bank' | 'broker' | 'crypto';
  lastSynced: string;
  accountNumber?: string;
}

const AVAILABLE_INSTITUTIONS = [
  { name: 'Nubank', color: 'bg-purple-600', type: 'bank' },
  { name: 'Inter', color: 'bg-orange-500', type: 'bank' },
  { name: 'C6 Bank', color: 'bg-zinc-800', type: 'bank' },
  { name: 'Neon', color: 'bg-cyan-500', type: 'bank' },
  { name: 'BTG Pactual', color: 'bg-slate-900', type: 'bank' },
  { name: 'Banco do Brasil', color: 'bg-yellow-400 text-slate-800', type: 'bank' },
  { name: 'Itaú', color: 'bg-orange-600', type: 'bank' },
  { name: 'Bradesco', color: 'bg-red-600', type: 'bank' },
  { name: 'Santander', color: 'bg-red-700', type: 'bank' },
  { name: 'Next', color: 'bg-emerald-500', type: 'bank' },
  { name: 'XP Investimentos', color: 'bg-black', type: 'broker' },
  { name: 'Rico', color: 'bg-indigo-500', type: 'broker' },
  { name: 'Avenue', color: 'bg-blue-900', type: 'broker' },
  { name: 'Binance', color: 'bg-yellow-500 text-slate-900', type: 'crypto' },
  { name: 'Mercado Bitcoin', color: 'bg-orange-400 text-slate-900', type: 'crypto' }
];

const AnimatedNumber: React.FC<{ value: number; hideValues?: boolean; className?: string }> = ({ value, hideValues, className }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;
    const start = prevValue.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = start + (end - start) * progress;
      setDisplayValue(current);
      if (progress < 1) requestAnimationFrame(animate);
      else prevValue.current = end;
    };
    requestAnimationFrame(animate);
  }, [value]);

  if (hideValues) return <span className={className}>R$ ••••</span>;
  return (
    <span className={className}>
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayValue)}
    </span>
  );
};

const OpenFinance: React.FC<{
  hideValues?: boolean;
  activeWorkspaceId?: string | null;
  activeWorkspaceName?: string | null;
}> = ({ hideValues = false, activeWorkspaceId, activeWorkspaceName }) => {
  const storageKey = getWorkspaceScopedStorageKey('flow_bank_accounts', activeWorkspaceId);
  const [banks, setBanks] = useState<BankAccount[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Nubank', balance: 12450.50, status: 'Conectado', color: 'bg-purple-600', type: 'bank', lastSynced: new Date().toISOString() },
      { id: '2', name: 'XP Investimentos', balance: 89300.20, status: 'Conectado', color: 'bg-black', type: 'broker', lastSynced: new Date().toISOString() }
    ];
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setBanks(saved ? JSON.parse(saved) : []);
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(banks));
  }, [banks, storageKey]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const totalBalance = banks.reduce((acc, bank) => acc + bank.balance, 0);

  const handleConnect = (inst: typeof AVAILABLE_INSTITUTIONS[0]) => {
    setIsConnecting(true);
    setTimeout(() => {
      const newAcc: BankAccount = {
        id: Math.random().toString(36).substr(2, 9),
        name: inst.name,
        balance: Math.floor(Math.random() * 50000) + 1000,
        status: 'Conectado',
        color: inst.color,
        type: inst.type as any,
        lastSynced: new Date().toISOString(),
        accountNumber: `${Math.floor(Math.random() * 9999)}-${Math.floor(Math.random() * 9)}`
      };
      setBanks(prev => [...prev, newAcc]);
      setIsConnecting(false);
      setIsModalOpen(false);
    }, 2000);
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente desconectar esta conta? Os dados de saldo não serão mais sincronizados.")) {
      setBanks(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleSyncAll = () => {
    setIsSyncingAll(true);
    setTimeout(() => {
      setBanks(prev => prev.map(b => ({
        ...b,
        balance: b.balance + (Math.random() * 100 - 50), // Simulate small fluctuation
        lastSynced: new Date().toISOString()
      })));
      setIsSyncingAll(false);
    }, 1500);
  };

  const filtered = AVAILABLE_INSTITUTIONS.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
      {/* Header Padronizado */}
      <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Contas</h2>
          <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Ecossistema Open Finance</p>
          <p className="text-[8px] font-black text-white/80 uppercase tracking-widest mt-2">
            Workspace: {activeWorkspaceName || 'Carregando workspace'}
          </p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
          <Landmark size={22} />
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-7 text-white overflow-hidden relative shadow-2xl">
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-300 bg-white/5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest backdrop-blur-md border border-white/5">
              <ShieldCheck size={10} /> Patrimônio Consolidado
            </div>
            <button 
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className={`p-2.5 bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-xl hover:bg-white/20 transition-all active:scale-95 ${isSyncingAll ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div>
            <AnimatedNumber 
              value={totalBalance} 
              hideValues={hideValues} 
              className="text-4xl font-black text-white block tracking-tighter" 
            />
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
              {isSyncingAll ? 'Sincronizando saldos...' : 'Dados Sincronizados via Open Finance'}
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            disabled={isConnecting}
            className={`w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all ${isConnecting ? 'opacity-70 scale-[0.98]' : 'hover:scale-[1.02] active:scale-95'}`}
          >
            {isConnecting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Conectando...
              </>
            ) : (
              <>
                <Plus size={14} strokeWidth={3} /> Conectar Nova Conta
              </>
            )}
          </button>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600 rounded-full -mr-16 -mt-16 blur-3xl opacity-20"></div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {banks.map((bank) => (
          <div key={bank.id} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between group transition-all hover:shadow-md relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${bank.color} rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-inner`}>
                {bank.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">{bank.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${bank.status === 'Conectado' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                  <span className="text-[7px] uppercase font-black text-slate-400 tracking-widest">{bank.status}</span>
                  <span className="text-[7px] text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">{bank.type}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <AnimatedNumber value={bank.balance} hideValues={hideValues} className="text-sm font-black text-slate-900 dark:text-white tracking-tight" />
              <div className="flex items-center gap-3">
                <p className="text-[7px] text-slate-300 dark:text-slate-600 font-mono">
                   Ult. sync: {new Date(bank.lastSynced).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
                <button 
                  onClick={() => handleDelete(bank.id)}
                  className="p-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                  title="Desconectar conta"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {banks.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma conta conectada</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-lg z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
             <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Conectar Instituição</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all"><X size={20} /></button>
             </div>
             <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Procure por Banco ou Corretora..."
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none outline-none font-bold text-slate-700 dark:text-white text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 pb-4">
                   {filtered.map(inst => (
                     <button
                       key={inst.name}
                       onClick={() => handleConnect(inst)}
                       disabled={isConnecting}
                       className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-transparent hover:border-indigo-500/20 hover:bg-white dark:hover:bg-slate-700 transition-all flex items-center gap-3 text-left group"
                     >
                       <div className={`w-10 h-10 ${inst.color} rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
                         {inst.name.charAt(0)}
                       </div>
                       <div className="min-w-0">
                         <p className="text-[9px] font-black text-slate-800 dark:text-white uppercase truncate">{inst.name}</p>
                         <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{inst.type}</p>
                       </div>
                     </button>
                   ))}
                </div>
             </div>
             {isConnecting && (
               <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-50">
                 <Loader2 size={40} className="animate-spin text-indigo-600" />
                 <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">Autenticando via Open Finance...</p>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenFinance;
