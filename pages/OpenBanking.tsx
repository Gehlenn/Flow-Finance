import React, { useState, useEffect, useCallback } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';
import { Transaction } from '../types';
import { Account } from '../models/Account';
import { BankConnection, BRAZILIAN_BANKS, BankOption, SyncResult } from '../models/BankConnection';
import {
  reloadConnections,
  connectBank,
  connectPluggyItem,
  createPluggyConnectToken,
  disconnectBank,
  fullSync,
  formatLastSync,
  getBankingHealth,
  listPluggyConnectors,
  PluggyConnector,
} from '../services/integrations/openBankingService';
import { runBankSync, getSyncStatusSummary, getLastSyncReport, formatSyncDuration } from '../src/finance/bankSyncEngine';
import {
  Building2, Wifi, WifiOff, RefreshCw, Loader2, Plus, X,
  CheckCircle2, AlertCircle, ChevronRight, Zap, Clock,
  ShieldCheck, Unplug, Activity, ArrowUpRight, Sparkles,
  Link2, Database
} from 'lucide-react';

interface OpenBankingProps {
  userId: string;
  transactions: Transaction[];
  accounts: Account[];
  hideValues?: boolean;
  onNewTransactions: (txs: Partial<Transaction>[]) => void;
  onUpdateAccount: (acc: Account) => void;
}

type PageView = 'list' | 'add';

// ─── Status pill ──────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: BankConnection['connection_status'] }> = ({ status }) => {
  const map = {
    connected:    { label: 'Conectado',    cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500' },
    disconnected: { label: 'Desconectado', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',           dot: 'bg-slate-400' },
    syncing:      { label: 'Sincronizando',cls: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',                 dot: 'bg-sky-500 animate-pulse' },
    error:        { label: 'Erro',         cls: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',             dot: 'bg-rose-500' },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

// ─── Bank logo circle ─────────────────────────────────────────────────────────

const BankLogo: React.FC<{ bank: BankOption | BankConnection; size?: 'sm' | 'md' | 'lg' }> = ({ bank, size = 'md' }) => {
  const logo = 'bank_name' in bank ? bank.bank_logo : bank.logo;
  const color = 'bank_name' in bank ? bank.bank_color : bank.color;
  const sizes = { sm: 'w-9 h-9 text-lg', md: 'w-12 h-12 text-2xl', lg: 'w-16 h-16 text-3xl' };
  return (
    <div
      className={`${sizes[size]} rounded-2xl flex items-center justify-center shrink-0 shadow-sm`}
      style={{ backgroundColor: color ? `${color}18` : '#6366f118', border: `1.5px solid ${color ?? '#6366f1'}30` }}
    >
      <span>{logo ?? '🏦'}</span>
    </div>
  );
};

// ─── Connected bank card ──────────────────────────────────────────────────────

const BankCard: React.FC<{
  conn: BankConnection;
  isSyncing: boolean;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
  lastResult?: SyncResult;
}> = ({ conn, isSyncing, onSync, onDisconnect, lastResult }) => {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-[2rem] border transition-all duration-300 overflow-hidden
      ${conn.connection_status === 'error'
        ? 'border-rose-200 dark:border-rose-500/30'
        : 'border-slate-100 dark:border-slate-700'
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 p-5">
        <BankLogo bank={conn} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-slate-900 dark:text-white text-sm leading-none">{conn.bank_name}</p>
            <StatusPill status={isSyncing ? 'syncing' : conn.connection_status} />
          </div>

          <div className="flex items-center gap-1.5 mt-1.5">
            <Clock size={9} className="text-slate-400" />
            <p className="text-[9px] text-slate-400 font-bold">
              Última sync: {formatLastSync(conn.last_sync)}
            </p>
          </div>

          {lastResult && lastResult.transactions_imported > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <Sparkles size={9} className="text-emerald-500" />
              <p className="text-[8px] text-emerald-600 dark:text-emerald-400 font-black">
                +{lastResult.transactions_imported} transações importadas
              </p>
            </div>
          )}

          {conn.connection_status === 'error' && conn.error_message && (
            <p className="text-[8px] text-rose-500 font-bold mt-1 truncate">{conn.error_message}</p>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={() => onSync(conn.id)}
          disabled={isSyncing}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 text-[9px] font-black text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
        >
          {isSyncing
            ? <Loader2 size={13} className="animate-spin" />
            : <RefreshCw size={13} />
          }
          {isSyncing ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>

        <div className="w-px bg-slate-100 dark:bg-slate-700" />

        {!confirmDisconnect ? (
          <button
            onClick={() => setConfirmDisconnect(true)}
            className="px-5 flex items-center justify-center gap-1.5 text-[9px] font-black text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
          >
            <Unplug size={13} />
          </button>
        ) : (
          <div className="flex items-center">
            <button
              onClick={() => onDisconnect(conn.id)}
              className="px-3 flex items-center gap-1 text-[8px] font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors py-3.5"
            >
              <X size={11} /> Desconectar
            </button>
            <button
              onClick={() => setConfirmDisconnect(false)}
              className="px-2 text-[8px] font-black text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors py-3.5"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Bank picker grid ─────────────────────────────────────────────────────────

const BankPicker: React.FC<{
  connectedIds: Set<string>;
  connecting: string | null;
  onConnect: (bank: BankOption) => void;
  pluggyEnabled: boolean;
  pluggyConnectToken: string | null;
  pluggyConnectors: PluggyConnector[];
  onPluggySuccess: (data: unknown) => void;
  onPluggyError: (error: unknown) => void;
  onBack: () => void;
}> = ({
  connectedIds,
  connecting,
  onConnect,
  pluggyEnabled,
  pluggyConnectToken,
  pluggyConnectors,
  onPluggySuccess,
  onPluggyError,
  onBack,
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="w-9 h-9 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
      >
        <ChevronRight size={16} className="rotate-180" />
      </button>
      <div>
        <p className="font-black text-slate-900 dark:text-white text-sm leading-none">Conectar Banco</p>
        <p className="text-[8px] text-slate-400 font-bold mt-0.5">Escolha seu banco para sincronizar</p>
      </div>
    </div>

    {/* Security notice */}
    <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
      <ShieldCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-[9px] font-black text-emerald-700 dark:text-emerald-300">
          {pluggyEnabled ? 'Conexão segura Pluggy ativa' : 'Conexão segura simulada'}
        </p>
        <p className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 leading-relaxed">
          {pluggyEnabled
            ? 'Token gerado no backend e credenciais protegidas no servidor. Nenhum CLIENT_ID/SECRET é exposto no navegador.'
            : 'Ambiente de demonstração com dados fictícios. Nenhuma credencial bancária real é solicitada.'}
        </p>
      </div>
    </div>

    {pluggyEnabled && pluggyConnectToken && (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
        <p className="text-[9px] font-black text-slate-700 dark:text-slate-200 mb-2">Conectar com Pluggy Connect</p>
        <div className="w-full [&>button]:w-full [&>button]:rounded-xl [&>button]:bg-indigo-600 [&>button]:hover:bg-indigo-700 [&>button]:text-white [&>button]:font-black [&>button]:text-xs [&>button]:py-3 [&>button]:transition-colors">
          <PluggyConnect
            connectToken={pluggyConnectToken}
            includeSandbox
            allowFullscreen={false}
            onSuccess={onPluggySuccess as any}
            onError={onPluggyError as any}
            connectorIds={pluggyConnectors.slice(0, 30).map((c) => c.id)}
          />
        </div>
      </div>
    )}

    {/* Bank grid */}
    <div className="grid grid-cols-2 gap-3">
      {BRAZILIAN_BANKS.map(bank => {
        const isConnected = connectedIds.has(bank.id);
        const isConnecting = connecting === bank.id;
        return (
          <button
            key={bank.id}
            onClick={() => !isConnected && !isConnecting && onConnect(bank)}
            disabled={isConnected || !!connecting}
            className={`relative flex flex-col items-center gap-3 p-4 rounded-[1.5rem] border transition-all active:scale-[0.97]
              ${isConnected
                ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5 opacity-70 cursor-not-allowed'
                : isConnecting
                ? 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 scale-[0.98]'
                : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
              }`}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
              style={{ backgroundColor: `${bank.color}15`, border: `1.5px solid ${bank.color}30` }}
            >
              {bank.logo}
            </div>
            <p className="text-[9px] font-black text-slate-700 dark:text-slate-200 text-center leading-tight">{bank.name}</p>

            {/* Status overlay */}
            {isConnected && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
              </div>
            )}
            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-800/80 rounded-[1.5rem]">
                <Loader2 size={20} className="text-indigo-500 animate-spin" />
              </div>
            )}
          </button>
        );
      })}
    </div>

    {/* Future providers */}
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Conectores disponíveis</p>
      <div className="flex gap-2 flex-wrap">
        {(pluggyConnectors.length
          ? pluggyConnectors.slice(0, 10).map((c) => c.name)
          : ['Pluggy', 'Belvo', 'TrueLayer'])
          .map(p => (
          <span key={p} className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-[8px] font-black text-slate-400 uppercase tracking-widest">
            {p}
          </span>
          ))}
      </div>
      <p className="text-[8px] text-slate-400 font-bold mt-2 leading-relaxed">
        {pluggyEnabled
          ? 'Fluxo real Pluggy ativo: o widget gera Item e o backend registra a conexão com segurança.'
          : 'A arquitetura provider permite integrar qualquer API Open Banking sem reescrever o código.'}
      </p>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const OpenBankingPage: React.FC<OpenBankingProps> = ({
  userId,
  transactions,
  accounts,
  hideValues = false,
  onNewTransactions,
  onUpdateAccount,
}) => {
  const [view, setView] = useState<PageView>('list');
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [connectingBank, setConnectingBank] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, SyncResult>>({});
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pluggyEnabled, setPluggyEnabled] = useState(false);
  const [pluggyConnectToken, setPluggyConnectToken] = useState<string | null>(null);
  const [pluggyConnectors, setPluggyConnectors] = useState<PluggyConnector[]>([]);

  const reload = useCallback(async () => {
    const fresh = await reloadConnections(userId);
    setConnections(fresh);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Auto-refresh last_sync labels every 30s
  useEffect(() => {
    const t = setInterval(() => {
      void reload();
    }, 30000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    let cancelled = false;

    const loadPluggyData = async () => {
      const health = await getBankingHealth();
      const isAvailable = Boolean(health?.providerMode === 'pluggy' && health?.pluggyConfigured);

      if (cancelled) return;

      setPluggyEnabled(isAvailable);
      if (!isAvailable) {
        setPluggyConnectToken(null);
        return;
      }

      const [connectors, token] = await Promise.all([
        listPluggyConnectors(),
        createPluggyConnectToken(userId).catch(() => null),
      ]);

      if (cancelled) return;
      setPluggyConnectors(connectors);
      setPluggyConnectToken(token);
    };

    if (view === 'add') {
      loadPluggyData().catch((err) => console.error('Falha ao carregar Pluggy:', err));
    }

    return () => {
      cancelled = true;
    };
  }, [userId, view]);

  const normalizeBankId = (value: string): string => (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'pluggy-bank'
  );

  const handlePluggySuccess = async (payload: unknown) => {
    const data = payload as { item?: { id?: string; connector?: { name?: string } } };
    const itemId = data?.item?.id;

    if (!itemId) {
      console.error('Pluggy success sem itemId:', payload);
      return;
    }

    const connectorName = data?.item?.connector?.name || 'Pluggy';
    const bankId = normalizeBankId(connectorName);
    setConnectingBank(bankId);

    try {
      setActionError(null);
      await connectPluggyItem(bankId, userId, itemId);
      await reload();
      setView('list');
      setPluggyConnectToken(await createPluggyConnectToken(userId));
    } catch (err) {
      setActionError('Falha ao conectar com Pluggy. Verifique autenticação e tente novamente.');
      console.error('Falha ao registrar item Pluggy no backend:', err);
    } finally {
      setConnectingBank(null);
    }
  };

  const handlePluggyError = (error: unknown) => {
    setActionError('Conexão Pluggy cancelada ou inválida. Tente novamente.');
    console.error('Erro no Pluggy Connect:', error);
  };

  // ── Connect ────────────────────────────────────────────────────────────────

  const handleConnect = async (bank: BankOption) => {
    setConnectingBank(bank.id);
    try {
      setActionError(null);
      await connectBank(bank.id, userId);
      await reload();
      setView('list');
    } catch (err: any) {
      setActionError('Não foi possível conectar no banco real. Verifique login/token e tente novamente.');
      console.error('Connect failed:', err);
    } finally {
      setConnectingBank(null);
    }
  };

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const handleDisconnect = async (id: string) => {
    await disconnectBank(id);
    await reload();
  };

  // ── Sync single ────────────────────────────────────────────────────────────

  const handleSync = async (id: string) => {
    if (syncingIds.has(id)) return;
    setSyncingIds(prev => new Set([...prev, id]));
    await reload(); // show syncing status
    try {
      setActionError(null);
      const result = await fullSync(
        id,
        transactions,
        accounts,
        userId,
        onNewTransactions,
        onUpdateAccount,
      );
      if (result.error) {
        setActionError(result.error);
      }
      setLastResults(prev => ({ ...prev, [id]: result }));
    } finally {
      setSyncingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      await reload();
    }
  };

  // ── Sync all ───────────────────────────────────────────────────────────────

  const handleSyncAll = async () => {
    const connected = connections.filter(c => c.connection_status !== 'error');
    if (!connected.length) return;
    setSyncAllLoading(true);
    try {
      await Promise.all(connected.map(c => handleSync(c.id)));
    } finally {
      setSyncAllLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const connectedIds = new Set(connections.map(c => {
    // Extract bank id from bank_name for the picker
    const found = BRAZILIAN_BANKS.find(b => b.name === c.bank_name);
    return found?.id ?? '';
  }));

  const totalImported = Object.values(lastResults).reduce((s, r) => (s as number) + (r as SyncResult).transactions_imported, 0) as number;
  const anyConnected = connections.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-slate-900/20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 50%), radial-gradient(circle at 20% 80%, #8b5cf6 0%, transparent 50%)'
        }} />
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Open Banking</h2>
          <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mt-1.5">
            {connections.length} banco{connections.length !== 1 ? 's' : ''} conectado{connections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
          <Building2 size={20} />
        </div>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-2 px-4 py-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold leading-relaxed">{actionError}</p>
        </div>
      )}

      {/* View: Add bank */}
      {view === 'add' && (
        <BankPicker
          connectedIds={connectedIds}
          connecting={connectingBank}
          onConnect={handleConnect}
          pluggyEnabled={pluggyEnabled}
          pluggyConnectToken={pluggyConnectToken}
          pluggyConnectors={pluggyConnectors}
          onPluggySuccess={handlePluggySuccess}
          onPluggyError={handlePluggyError}
          onBack={() => setView('list')}
        />
      )}

      {/* View: List */}
      {view === 'list' && (
        <>
          {/* Stats bar — shown when at least one bank is connected */}
          {anyConnected && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Bancos',        value: connections.length,  icon: <Building2 size={14} className="text-indigo-500" />,  bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                { label: 'Importadas',    value: totalImported,        icon: <Database size={14} className="text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                { label: 'Erros',         value: connections.filter(c => c.connection_status === 'error').length, icon: <AlertCircle size={14} className="text-rose-400" />, bg: 'bg-rose-50 dark:bg-rose-500/10' },
              ].map(({ label, value, icon, bg }) => (
                <div key={label} className={`flex flex-col items-center gap-1.5 p-3 ${bg} rounded-2xl`}>
                  {icon}
                  <p className="text-base font-black text-slate-900 dark:text-white leading-none">{value}</p>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Sync all */}
          {anyConnected && (
            <button
              onClick={handleSyncAll}
              disabled={syncAllLoading || syncingIds.size > 0}
              className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {syncAllLoading
                ? <Loader2 size={17} className="animate-spin" />
                : <RefreshCw size={17} />
              }
              {syncAllLoading ? 'Sincronizando todos…' : 'Sincronizar Todos os Bancos'}
            </button>
          )}

          {/* Bank cards */}
          {connections.map(conn => (
            <BankCard
              key={conn.id}
              conn={conn}
              isSyncing={syncingIds.has(conn.id)}
              onSync={handleSync}
              onDisconnect={handleDisconnect}
              lastResult={lastResults[conn.id]}
            />
          ))}

          {/* Empty state */}
          {!anyConnected && (
            <div className="flex flex-col items-center gap-5 py-14 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/20 dark:to-violet-500/20 rounded-2xl flex items-center justify-center">
                <Building2 size={28} className="text-indigo-500" />
              </div>
              <div className="text-center px-6">
                <p className="font-black text-slate-800 dark:text-white text-sm">Nenhum banco conectado</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">
                  Conecte sua conta para sincronizar transações automaticamente com classificação por IA
                </p>
              </div>
              <button
                onClick={() => setView('add')}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/25"
              >
                <Plus size={16} /> Conectar Banco
              </button>
            </div>
          )}

          {/* Add button when already have connections */}
          {anyConnected && (
            <button
              onClick={() => setView('add')}
              className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:border-indigo-300 hover:text-indigo-500 dark:hover:border-indigo-500/40 transition-colors group"
            >
              <div className="w-9 h-9 border-2 border-dashed border-current rounded-xl flex items-center justify-center">
                <Plus size={16} />
              </div>
              <p className="font-black text-[11px] uppercase tracking-widest">Adicionar banco</p>
            </button>
          )}

          {/* Architecture note */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={12} className="text-slate-400" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Arquitetura modular</p>
            </div>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
              Cada banco usa um <span className="text-indigo-500">IBankProvider</span> independente. Para integrar Pluggy, Belvo ou TrueLayer, basta implementar a interface e registrá-la — zero mudanças na UI.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {[
                { name: 'MockBankProvider', status: 'Ativo', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
                { name: 'PluggyProvider',   status: pluggyEnabled ? 'Ativo' : 'Parcial', color: pluggyEnabled ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
                { name: 'BelvoProvider',    status: 'Futuro', color: 'text-slate-400 bg-slate-100 dark:bg-slate-700' },
                { name: 'TrueLayerProvider',status: 'Futuro', color: 'text-slate-400 bg-slate-100 dark:bg-slate-700' },
              ].map(p => (
                <div key={p.name} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${p.color}`}>
                  <Activity size={8} />
                  <span className="text-[7px] font-black uppercase tracking-widest">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OpenBankingPage;
