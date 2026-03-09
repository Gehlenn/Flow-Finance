import React, { useState, useRef, useCallback } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import {
  runImportPipeline, toTransactions, detectFormat,
  ImportResult, ImportedTransaction, ImportFormat,
} from '../src/finance/importService';
import { FinancialEventEmitter } from '../src/events/eventEngine';
import {
  Upload, FileText, FileSpreadsheet, FileScan, X, Check,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, RefreshCw,
  Copy, CheckSquare, Square, Download, Sparkles, Clock,
  ArrowUpRight, ArrowDownRight, Info, ShieldAlert
} from 'lucide-react';

interface ImportTransactionsPageProps {
  transactions: Transaction[];
  userId: string;
  hideValues?: boolean;
  onAddTransactions: (items: Partial<Transaction>[]) => void;
}

type ImportPhase = 'idle' | 'detecting' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const FORMAT_META: Record<ImportFormat, { icon: React.ReactNode; label: string; color: string }> = {
  ofx: {
    icon: <FileText size={14} />,
    label: 'OFX / QFX',
    color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
  },
  csv: {
    icon: <FileSpreadsheet size={14} />,
    label: 'CSV',
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  },
  pdf: {
    icon: <FileScan size={14} />,
    label: 'PDF',
    color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10',
  },
  unknown: {
    icon: <FileText size={14} />,
    label: 'Desconhecido',
    color: 'text-slate-400 bg-slate-50 dark:bg-slate-800',
  },
};

const CATEGORY_COLORS: Record<Category, string> = {
  [Category.PESSOAL]:     'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
  [Category.CONSULTORIO]: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10',
  [Category.NEGOCIO]:     'text-sky-500 bg-sky-50 dark:bg-sky-500/10',
  [Category.INVESTIMENTO]:'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
};

// ─── Transaction Row ──────────────────────────────────────────────────────────

const TxRow: React.FC<{
  item: ImportedTransaction;
  index: number;
  hideValues: boolean;
  onToggleSelect: (i: number) => void;
  onChangeCategory: (i: number, cat: Category) => void;
  onChangeType: (i: number, type: TransactionType) => void;
}> = ({ item, index, hideValues, onToggleSelect, onChangeCategory, onChangeType }) => {
  const [expanded, setExpanded] = useState(false);
  const catMeta = CATEGORY_COLORS[item.category ?? Category.PESSOAL];
  const isDespesa = (item.type ?? item.raw_type) === TransactionType.DESPESA;

  return (
    <div className={`border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors ${
      item.duplicate ? 'opacity-60 bg-amber-50/30 dark:bg-amber-500/5' : ''
    } ${!item.selected ? 'opacity-40' : ''}`}>

      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggleSelect(index)}
          className={`shrink-0 transition-colors ${item.selected ? 'text-indigo-500' : 'text-slate-300'}`}
        >
          {item.selected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>

        {/* Amount + type indicator */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isDespesa ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'
        }`}>
          {isDespesa
            ? <ArrowDownRight size={15} className="text-rose-500" />
            : <ArrowUpRight size={15} className="text-emerald-500" />
          }
        </div>

        {/* Description + date */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-800 dark:text-white truncate">
            {item.merchant || item.raw_description}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[8px] text-slate-400 font-bold">
              {new Date(item.raw_date).toLocaleDateString('pt-BR')}
            </span>
            {item.category && (
              <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ${catMeta}`}>
                {item.category}
              </span>
            )}
            {item.duplicate && (
              <span className="flex items-center gap-0.5 text-[7px] font-black text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                <ShieldAlert size={8} /> Duplicata
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className={`text-sm font-black ${isDespesa ? 'text-rose-500' : 'text-emerald-500'}`}>
            {hideValues ? '••••' : (isDespesa ? '-' : '+') + fmt(item.raw_amount)}
          </p>
          {item.confidence !== undefined && (
            <p className="text-[7px] font-bold text-slate-300 dark:text-slate-600">
              {Math.round(item.confidence * 100)}%
            </p>
          )}
        </div>

        {/* Expand */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 p-1 text-slate-300 hover:text-slate-500 transition-colors"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Expanded: edit fields */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 flex gap-3 border-t border-slate-50 dark:border-slate-700/50 animate-in slide-in-from-top-2 duration-200">
          <div className="flex-1">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Categoria</p>
            <select
              value={item.category ?? Category.PESSOAL}
              onChange={e => onChangeCategory(index, e.target.value as Category)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-1.5 text-[10px] font-bold text-slate-800 dark:text-white outline-none"
            >
              {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo</p>
            <select
              value={item.type ?? item.raw_type ?? TransactionType.DESPESA}
              onChange={e => onChangeType(index, e.target.value as TransactionType)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-1.5 text-[10px] font-bold text-slate-800 dark:text-white outline-none"
            >
              <option value={TransactionType.DESPESA}>Despesa</option>
              <option value={TransactionType.RECEITA}>Receita</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ImportTransactionsPage: React.FC<ImportTransactionsPageProps> = ({
  transactions: existingTransactions,
  userId,
  hideValues = false,
  onAddTransactions,
}) => {
  const [phase, setPhase]           = useState<ImportPhase>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult]         = useState<ImportResult | null>(null);
  const [items, setItems]           = useState<ImportedTransaction[]>([]);
  const [progress, setProgress]     = useState<{ step: string; pct: number }>({ step: '', pct: 0 });
  const [errorMsg, setErrorMsg]     = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [filterDuplicates, setFilterDuplicates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setPhase('detecting');
    setErrorMsg('');
    setProgress({ step: 'Iniciando…', pct: 0 });

    try {
      const res = await runImportPipeline(
        file,
        existingTransactions,
        userId,
        (step, pct) => setProgress({ step, pct })
      );

      setResult(res);
      setItems(res.transactions);
      setPhase(res.errors.length > 0 && res.transactions.length === 0 ? 'error' : 'preview');
      if (res.errors.length > 0 && res.transactions.length === 0) {
        setErrorMsg(res.errors.join(' '));
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Erro inesperado.');
      setPhase('error');
    }
  }, [existingTransactions, userId]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleSelect = (i: number) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item));

  const selectAll = (v: boolean) =>
    setItems(prev => prev.map(item => ({ ...item, selected: v })));

  const changeCategory = (i: number, cat: Category) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, category: cat } : item));

  const changeType = (i: number, type: TransactionType) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, type } : item));

  // ── Import confirm ─────────────────────────────────────────────────────────

  const handleImport = () => {
    setPhase('importing');
    const toImport = toTransactions(items);
    if (toImport.length === 0) { setPhase('preview'); return; }

    onAddTransactions(toImport);
    setImportedCount(toImport.length);

    // PART 7 — Emitir evento de importação
    FinancialEventEmitter.transactionsImported({
      count: toImport.length,
      format: result?.format,
      filename: result?.filename,
      source: 'import',
    });

    setPhase('done');
  };

  const handleReset = () => {
    setPhase('idle');
    setResult(null);
    setItems([]);
    setProgress({ step: '', pct: 0 });
    setErrorMsg('');
    setImportedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  const selectedCount = items.filter(i => i.selected && !i.duplicate).length;
  const duplicateCount = items.filter(i => i.duplicate).length;
  const displayItems = filterDuplicates ? items.filter(i => !i.duplicate) : items;

  const selectedTotal = items
    .filter(i => i.selected && !i.duplicate)
    .reduce((s, i) => {
      const isDespesa = (i.type ?? i.raw_type) === TransactionType.DESPESA;
      return s + (isDespesa ? -i.raw_amount : i.raw_amount);
    }, 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-11 h-11 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/30">
          <Download size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">
            Importar Extrato
          </h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            OFX · CSV · PDF — com classificação por IA
          </p>
        </div>
      </div>

      {/* ── PHASE: idle ─────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <>
          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-5 p-10 rounded-[2rem] border-2 border-dashed cursor-pointer transition-all
              ${isDragging
                ? 'border-sky-400 bg-sky-50 dark:bg-sky-500/10 scale-[1.01]'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300 hover:bg-sky-50/40 dark:hover:bg-sky-500/5'
              }`}
          >
            <div className="w-16 h-16 bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-500/20 dark:to-indigo-500/20 rounded-2xl flex items-center justify-center">
              <Upload size={28} className="text-sky-500" />
            </div>
            <div className="text-center">
              <p className="font-black text-slate-800 dark:text-white text-sm">
                Arraste o arquivo ou toque para selecionar
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-1">OFX · QFX · CSV · TSV · PDF</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx,.qfx,.csv,.tsv,.txt,.pdf"
              onChange={onFileChange}
              className="hidden"
            />
          </div>

          {/* Format cards */}
          <div className="grid grid-cols-3 gap-3">
            {(['ofx', 'csv', 'pdf'] as ImportFormat[]).map(fmt => {
              const meta = FORMAT_META[fmt];
              return (
                <div key={fmt} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{meta.label}</p>
                </div>
              );
            })}
          </div>

          {/* Info */}
          <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl">
            <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] font-black text-indigo-700 dark:text-indigo-300">
                Classificação automática por IA
              </p>
              <p className="text-[8px] text-indigo-500 font-bold mt-0.5 leading-relaxed">
                Após o upload, o Gemini classifica automaticamente cada transação por categoria e estabelecimento. Você pode revisar e editar antes de confirmar.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── PHASE: detecting / parsing ──────────────────────────────────────── */}
      {(phase === 'detecting' || phase === 'parsing') && (
        <div className="flex flex-col items-center gap-5 py-12 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
          <div className="w-14 h-14 bg-sky-50 dark:bg-sky-500/10 rounded-2xl flex items-center justify-center">
            <Loader2 size={26} className="text-sky-500 animate-spin" />
          </div>
          <div className="text-center w-full px-8">
            <p className="font-black text-slate-800 dark:text-white text-sm">{progress.step || 'Processando…'}</p>
            {/* Progress bar */}
            <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="text-[8px] text-slate-400 font-bold mt-1.5">{progress.pct}%</p>
          </div>
          {progress.pct >= 65 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl">
              <Sparkles size={12} className="text-indigo-500" />
              <p className="text-[8px] font-black text-indigo-600 dark:text-indigo-400">
                Gemini classificando categorias…
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── PHASE: preview ──────────────────────────────────────────────────── */}
      {phase === 'preview' && result && (
        <>
          {/* Summary bar */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest ${FORMAT_META[result.format].color}`}>
                {FORMAT_META[result.format].icon}
                {FORMAT_META[result.format].label}
              </div>
              <p className="text-[10px] font-bold text-slate-500 truncate flex-1">{result.filename}</p>
              <div className="flex items-center gap-1 text-[8px] font-black text-slate-400">
                <Clock size={9} />
                {result.parse_time_ms}ms
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700">
              {[
                { label: 'Encontradas',   value: result.total_found,   color: 'text-slate-900 dark:text-white' },
                { label: 'Selecionadas',  value: selectedCount,         color: 'text-indigo-500' },
                { label: 'Duplicatas',    value: duplicateCount,        color: duplicateCount > 0 ? 'text-amber-500' : 'text-slate-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white dark:bg-slate-800 px-3 py-3 text-center">
                  <p className={`text-sm font-black ${color}`}>{value}</p>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => selectAll(true)}
                className="text-[8px] font-black text-indigo-500 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                Selecionar todos
              </button>
              <button onClick={() => selectAll(false)}
                className="text-[8px] font-black text-slate-400 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-xl">
                Desmarcar todos
              </button>
              {duplicateCount > 0 && (
                <button
                  onClick={() => setFilterDuplicates(f => !f)}
                  className={`ml-auto text-[8px] font-black px-3 py-1.5 rounded-xl transition-colors ${
                    filterDuplicates
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 dark:bg-amber-500/10 text-amber-500'
                  }`}
                >
                  {filterDuplicates ? 'Ver todas' : 'Ocultar duplicatas'}
                </button>
              )}
            </div>
          </div>

          {/* Transaction list */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {displayItems.length} transaç{displayItems.length !== 1 ? 'ões' : 'ão'}
              </p>
              <p className="text-[9px] font-black text-slate-400">Toque para expandir e editar</p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {displayItems.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-slate-300">
                  <FileText size={28} />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    {filterDuplicates ? 'Todas são duplicatas' : 'Nenhuma transação'}
                  </p>
                </div>
              ) : (
                displayItems.map((item, i) => (
                  <TxRow
                    key={i}
                    index={items.indexOf(item)}
                    item={item}
                    hideValues={hideValues}
                    onToggleSelect={toggleSelect}
                    onChangeCategory={changeCategory}
                    onChangeType={changeType}
                  />
                ))
              )}
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-100 dark:border-amber-500/20">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-[8px] text-amber-600 dark:text-amber-400 font-bold">{e}</p>
                ))}
              </div>
            </div>
          )}

          {/* Import button */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white rounded-2xl p-4 flex items-center justify-center gap-3 font-black text-sm shadow-xl shadow-sky-500/25 hover:shadow-sky-500/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              Importar {selectedCount} transaç{selectedCount !== 1 ? 'ões' : 'ão'}
              {!hideValues && (
                <span className="text-white/70 text-[10px] font-bold ml-1">
                  ({selectedTotal >= 0 ? '+' : ''}{fmt(selectedTotal)})
                </span>
              )}
            </button>
            <button onClick={handleReset}
              className="text-[10px] text-slate-400 font-bold text-center py-1 flex items-center justify-center gap-1.5">
              <RefreshCw size={10} /> Importar outro arquivo
            </button>
          </div>
        </>
      )}

      {/* ── PHASE: importing ────────────────────────────────────────────────── */}
      {phase === 'importing' && (
        <div className="flex flex-col items-center gap-4 py-12 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
          <Loader2 size={32} className="text-sky-500 animate-spin" />
          <p className="font-black text-slate-800 dark:text-white text-sm">Salvando transações…</p>
        </div>
      )}

      {/* ── PHASE: done ─────────────────────────────────────────────────────── */}
      {phase === 'done' && (
        <div className="flex flex-col items-center gap-5 py-12 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Check size={28} className="text-white" />
          </div>
          <div className="text-center">
            <p className="font-black text-slate-900 dark:text-white text-base">Importação concluída!</p>
            <p className="text-2xl font-black text-emerald-500 mt-1">{importedCount} transações</p>
            <p className="text-[9px] text-slate-400 font-bold mt-1">
              Insights e Autopilot atualizam automaticamente
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-2xl font-black text-slate-700 dark:text-white text-sm"
            >
              <Upload size={14} /> Importar mais
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: error ────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="flex flex-col items-center gap-4 py-10 bg-rose-50 dark:bg-rose-500/10 rounded-[2rem] border border-rose-100 dark:border-rose-500/20">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-500/20 rounded-2xl flex items-center justify-center">
            <AlertTriangle size={22} className="text-rose-500" />
          </div>
          <div className="text-center px-4">
            <p className="font-black text-rose-700 dark:text-rose-400 text-sm">Falha na importação</p>
            <p className="text-[10px] text-rose-500 font-bold mt-1">{errorMsg}</p>
          </div>
          <button onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 rounded-2xl font-black text-slate-700 dark:text-white text-sm shadow-sm">
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
};

export default ImportTransactionsPage;
