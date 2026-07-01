import React, { useState, useRef, useCallback } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import {
  runImportPipeline,
  ImportResult, ImportedTransaction, ImportFormat,
} from '../src/finance/importService';
import { normalizeFromFileImport, draftToTransaction } from '../src/domain/intakeNormalizer';
import { saveMerchantCategoryLearning } from '../src/engines/finance/categorization/aiCategorizerFallback';
import { FinancialEventEmitter } from '../src/events/eventEngine';
import { trackProductEvent } from '../src/app/productAnalytics';
import { VISUAL_SURFACES } from '../src/app/visualSystem';
import { logWarn } from '../src/utils/logger';
import {
  Upload, FileText, FileSpreadsheet, FileScan, X, Check,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, RefreshCw,
  Copy, CheckSquare, Square, Download, Sparkles, Clock,
  ArrowUpRight, ArrowDownRight, Info, ShieldAlert
} from 'lucide-react';
import { SECONDARY_FLOWS_COPY } from '../src/app/secondaryFlowsCopy';

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

const SURFACES = {
  panel: VISUAL_SURFACES.section,
  quiet: VISUAL_SURFACES.quietSection,
  interactive: VISUAL_SURFACES.interactiveCard,
} as const;

export function formatImportedDateLabel(value: unknown): string {
  if (!value || typeof value !== 'string') return 'Data inválida';
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'Data inválida';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function mapImportedItemsToDraftTransactions(items: ImportedTransaction[]): Partial<Transaction>[] {
  return items
    .filter((item) => item.selected && !item.duplicate)
    .map((item) => {
      const draft = normalizeFromFileImport({
        amount: item.raw_amount,
        date: item.raw_date,
        description: item.raw_description,
        merchant: item.merchant,
        type: item.type ?? item.raw_type,
        category: item.category,
        confidence: item.confidence,
        source: 'file',
      });

      return {
        ...draftToTransaction(draft),
        merchant: item.merchant,
        category: item.category,
      } as Partial<Transaction>;
    });
}

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
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Checkbox */}
        <button
          onClick={() => onToggleSelect(index)}
          className={`shrink-0 transition-colors ${item.selected ? 'text-indigo-500' : 'text-slate-300'}`}
        >
          {item.selected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>

        {/* Amount + type indicator */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isDespesa ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'
        }`}>
          {isDespesa
            ? <ArrowDownRight size={15} className="text-rose-500" />
            : <ArrowUpRight size={15} className="text-emerald-500" />
          }
        </div>

        {/* Description + date */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-slate-800 dark:text-white truncate">
            {item.merchant || item.raw_description}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400 font-medium">
              {formatImportedDateLabel(item.raw_date)}
            </span>
            {item.category && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-[0.08em] ${catMeta}`}>
                {item.category}
              </span>
            )}
            {item.duplicate && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                <ShieldAlert size={8} /> Duplicata
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold ${isDespesa ? 'text-rose-500' : 'text-emerald-500'}`}>
            {hideValues ? '••••' : (isDespesa ? '-' : '+') + fmt(item.raw_amount)}
          </p>
          {item.confidence !== undefined && (
            <p className="text-xs font-medium text-slate-300 dark:text-slate-600">
              {Math.round(item.confidence * 100)}%
            </p>
          )}
        </div>

        {/* Expand */}
        <button
          aria-label={`expandir transação ${item.merchant || item.raw_description}`}
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 p-1 text-slate-300 hover:text-slate-500 transition-colors"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Expanded: edit fields */}
      {expanded && (
        <div className="px-4 pb-3 pt-1.5 flex gap-3 border-t border-slate-50 dark:border-slate-700/50 animate-in slide-in-from-top-2 duration-200">
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em] mb-1">Categoria</p>
            <select
              value={item.category ?? Category.PESSOAL}
              onChange={e => onChangeCategory(index, e.target.value as Category)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800 dark:text-white outline-none"
            >
              {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em] mb-1">Tipo</p>
            <select
              value={item.type ?? item.raw_type ?? TransactionType.DESPESA}
              onChange={e => onChangeType(index, e.target.value as TransactionType)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800 dark:text-white outline-none"
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
  const [errorDiagnostic, setErrorDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [learningDiagnostic, setLearningDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [filterDuplicates, setFilterDuplicates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setPhase('detecting');
    setErrorMsg('');
    setErrorDiagnostic(null);
    setLearningDiagnostic(null);
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
        setErrorDiagnostic({
          title: 'Nenhuma transacao foi identificada',
          message: /pdf|ocr|imagem/i.test(res.errors.join(' '))
            ? 'O arquivo parece ser PDF/imagem, mas a extração nao conseguiu obter transacoes aproveitaveis.'
            : 'O arquivo nao trouxe transacoes aproveitaveis no formato esperado.',
          suggestion: /csv|ofx|qfx|separador|cabecalho|coluna/i.test(res.errors.join(' '))
            ? 'Revise o formato, o cabecalho e o separador do arquivo antes de tentar novamente.'
            : 'Tente outro arquivo ou ajuste a exportacao do extrato para um formato suportado.',
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro inesperado.';
      setErrorMsg(message);
      setErrorDiagnostic({
        title: 'Falha ao importar arquivo',
        message: 'O pipeline de importacao interrompeu a leitura antes de concluir.',
        suggestion: /pdf|ocr|imagem/i.test(message)
          ? 'Use uma imagem/PDF mais nítida ou tente um arquivo CSV/OFX direto do banco.'
          : 'Verifique o tipo do arquivo e tente novamente com um extrato suportado.',
      });
      setPhase('error');
    }
  }, [existingTransactions, userId]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handleImport = async () => {
    setPhase('importing');
    const selectedItems = items.filter(i => i.selected && !i.duplicate);
    const toImport = mapImportedItemsToDraftTransactions(items);
    if (toImport.length === 0) { setPhase('preview'); return; }

    await Promise.all(
      selectedItems.map(async (item) => {
        if (!item.merchant || !item.category) return;
        try {
          await saveMerchantCategoryLearning(userId, item.merchant, item.category, 0.95);
        } catch (error) {
          logWarn('[ImportTransactions] Failed to save merchant learning', {
            error,
            merchant: item.merchant,
            category: item.category,
            fallback: 'import-transactions-save-merchant-learning-failed',
          });
          setLearningDiagnostic({
            title: 'Importacao concluida com aprendizado pendente',
            message: 'Os lancamentos foram importados, mas o aprendizado auxiliar de categorias nao foi salvo para todos os itens.',
            suggestion: 'Revise os itens importados ou tente sincronizar o aprendizado novamente mais tarde.',
          });
        }
      })
    );

    onAddTransactions(toImport);
    setImportedCount(toImport.length);
    trackProductEvent('transaction_imported', {
      source: 'import_transactions',
      format: result?.format ?? 'unknown',
      imported_count: toImport.length,
      selected_count: selectedItems.length,
      duplicate_count: duplicateCount,
      error_count: result?.errors.length ?? 0,
    });

    // PART 7 — Emitir evento de importação
    try {
      FinancialEventEmitter.transactionsImported({
        count: toImport.length,
        format: result?.format,
        filename: result?.filename,
        source: 'import',
      });
    } catch { /* non-critical */ }

    setPhase('done');
  };

  const handleReset = () => {
    setPhase('idle');
    setResult(null);
    setItems([]);
    setProgress({ step: '', pct: 0 });
    setErrorMsg('');
    setErrorDiagnostic(null);
    setLearningDiagnostic(null);
    setImportedCount(0);
    setFilterDuplicates(false);
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
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <Download size={20} className="text-sky-500" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white leading-none">
            {SECONDARY_FLOWS_COPY.import.title}
          </h1>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-[0.08em] mt-0.5">
            {SECONDARY_FLOWS_COPY.import.subtitle}
          </p>
        </div>
      </div>

      {/* ── PHASE: idle ─────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <>
          {/* Drop zone */}
          <div
            data-testid="import-idle-state"
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-4 p-6 sm:p-7 rounded-xl border-2 border-dashed cursor-pointer transition-all
              ${isDragging
                ? 'border-sky-400 bg-sky-50 dark:bg-sky-500/10'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300 hover:bg-sky-50/40 dark:hover:bg-sky-500/5'
              }`}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
              <Upload size={28} className="text-sky-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800 dark:text-white text-sm">
                {SECONDARY_FLOWS_COPY.import.dropzoneTitle}
              </p>
              <p className="text-xs text-slate-400 font-medium mt-1">{SECONDARY_FLOWS_COPY.import.dropzoneFormats}</p>
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
                <div key={fmt} className={`${SURFACES.interactive} flex flex-col items-center gap-1.5 p-3`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{meta.label}</p>
                </div>
              );
            })}
          </div>

          {/* Info */}
          <div className={`${SURFACES.quiet} flex items-start gap-3 px-4 py-3`}>
            <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-white">
                Categorizacao assistida para revisar o caixa
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-300 font-medium mt-0.5 leading-relaxed">
                Apos o upload, o Flow organiza entradas e saidas por categoria e estabelecimento. Voce revisa antes de confirmar no caixa.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── PHASE: detecting / parsing ──────────────────────────────────────── */}
      {(phase === 'detecting' || phase === 'parsing') && (
        <div className={`${SURFACES.panel} flex flex-col items-center gap-4 py-8`}>
          <div className="w-12 h-12 bg-sky-50 dark:bg-sky-500/10 rounded-xl flex items-center justify-center">
            <Loader2 size={26} className="text-sky-500 animate-spin" />
          </div>
          <div className="text-center w-full px-6">
            <p className="font-semibold text-slate-800 dark:text-white text-sm">{progress.step || 'Processando…'}</p>
            {/* Progress bar */}
            <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1.5">{progress.pct}%</p>
          </div>
          {progress.pct >= 65 && (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
              <Sparkles size={12} className="text-indigo-500" />
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                Organizando categorias do caixa...
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── PHASE: preview ──────────────────────────────────────────────────── */}
      {phase === 'preview' && result && (
        <>
          {/* Summary bar */}
          <div className={`${SURFACES.panel} overflow-hidden`}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-[0.08em] ${FORMAT_META[result.format].color}`}>
                {FORMAT_META[result.format].icon}
                {FORMAT_META[result.format].label}
              </div>
              <p className="text-xs font-medium text-slate-500 truncate flex-1">{result.filename}</p>
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-400">
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
                  <p className={`text-sm font-semibold ${color}`}>{value}</p>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em] mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => selectAll(true)}
                className="text-xs font-semibold text-indigo-500 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                Selecionar todos
              </button>
              <button onClick={() => selectAll(false)}
                className="text-xs font-semibold text-slate-400 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                Desmarcar todos
              </button>
              {duplicateCount > 0 && (
                <button
                  onClick={() => setFilterDuplicates(f => !f)}
                  className={`ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
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
          <div className={`${SURFACES.panel} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em]">
                {displayItems.length} moviment{displayItems.length !== 1 ? 'os' : 'o'}
              </p>
              <p className="text-xs font-semibold text-slate-400">Toque para expandir e editar</p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {displayItems.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-slate-300">
                  <FileText size={28} />
                  <p className="text-xs font-semibold uppercase tracking-[0.08em]">
                    {filterDuplicates ? 'Todas são duplicatas' : 'Nenhum movimento'}
                  </p>
                </div>
              ) : (
                displayItems.map((item, i) => (
                  <TxRow
                    key={`${item.raw_date}-${item.raw_description}-${item.merchant}`}
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
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-amber-600 dark:text-amber-400 font-medium">{e}</p>
                ))}
              </div>
            </div>
          )}

          {/* Import button */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="w-full bg-sky-600 text-white rounded-xl px-4 py-3.5 flex items-center justify-center gap-3 font-semibold text-sm shadow-none hover:bg-sky-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              Importar {selectedCount} moviment{selectedCount !== 1 ? 'os' : 'o'}
              {!hideValues && (
                <span className="text-white/70 text-xs font-medium ml-1">
                  ({selectedTotal >= 0 ? '+' : ''}{fmt(selectedTotal)})
                </span>
              )}
            </button>
            <button onClick={handleReset}
              className="text-xs text-slate-400 font-medium text-center py-1 flex items-center justify-center gap-1.5">
              <RefreshCw size={10} /> Importar outro arquivo
            </button>
          </div>
        </>
      )}

      {/* ── PHASE: importing ────────────────────────────────────────────────── */}
      {phase === 'importing' && (
        <div className={`${SURFACES.panel} flex flex-col items-center gap-4 py-8`}>
          <Loader2 size={32} className="text-sky-500 animate-spin" />
          <p className="font-semibold text-slate-800 dark:text-white text-sm">Salvando no caixa…</p>
        </div>
      )}

      {/* ── PHASE: done ─────────────────────────────────────────────────────── */}
      {phase === 'done' && (
        <div className={`${SURFACES.panel} flex flex-col items-center gap-4 py-8`}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-emerald-600 shadow-none">
            <Check size={28} className="text-white" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-900 dark:text-white text-base">Importação concluída!</p>
            <p className="text-2xl font-semibold text-emerald-500 mt-1">{importedCount} movimentos</p>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Sinais do caixa atualizados
            </p>
          </div>
          {learningDiagnostic && (
            <div role="status" className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">{learningDiagnostic.title}</p>
              <p className="text-xs font-medium text-amber-800 dark:text-amber-100">{learningDiagnostic.message}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-300">Próximo passo: {learningDiagnostic.suggestion}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg font-semibold text-slate-700 dark:text-white text-sm"
            >
              <Upload size={14} /> Importar mais
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: error ────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/70 shadow-none dark:border-rose-500/20 dark:bg-rose-500/10 flex flex-col items-center gap-4 py-8">
          <div className="w-11 h-11 bg-rose-100 dark:bg-rose-500/20 rounded-xl flex items-center justify-center">
            <AlertTriangle size={22} className="text-rose-500" />
          </div>
          <div className="text-center px-4">
            <p className="font-semibold text-rose-700 dark:text-rose-400 text-sm">Falha na importação</p>
            <p className="text-xs text-rose-500 font-medium mt-1">{errorMsg}</p>
            {errorDiagnostic && (
              <div role="status" className="mt-3 rounded-xl border border-rose-200 bg-white/70 dark:bg-slate-900/60 p-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-600 dark:text-rose-300">{errorDiagnostic.title}</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-rose-700 dark:text-rose-200">{errorDiagnostic.message}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-rose-500 dark:text-rose-300">Próximo passo: {errorDiagnostic.suggestion}</p>
              </div>
            )}
          </div>
          <button onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-lg font-semibold text-slate-700 dark:text-white text-sm shadow-none border border-slate-200 dark:border-slate-700">
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
};

export default ImportTransactionsPage;





