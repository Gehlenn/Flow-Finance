import React, { useState, useRef, useCallback } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import { scanReceipt, ScannedReceipt } from '../src/ai/receiptScanner';
import {
  Camera, Upload, X, Check, ScanLine, AlertCircle,
  FileImage, Loader2, RotateCcw, ChevronRight,
  Receipt, CalendarDays, Store, DollarSign,
  CreditCard, Zap, ShieldCheck
} from 'lucide-react';
import { SECONDARY_FLOWS_COPY } from '../src/app/secondaryFlowsCopy';

interface ReceiptScannerPageProps {
  hideValues?: boolean;
  onAddTransaction?: (items: Partial<Transaction>[]) => void;
}

type ScanPhase = 'idle' | 'preview' | 'scanning' | 'review' | 'done' | 'error';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const PAYMENT_LABELS: Record<string, string> = {
  cash:        'Dinheiro',
  credit_card: 'Cartão de Crédito',
  debit_card:  'Cartão de Débito',
  pix:         'Pix',
};

const ReceiptScannerPage: React.FC<ReceiptScannerPageProps> = ({
  hideValues = false,
  onAddTransaction,
}) => {
  const [phase, setPhase]         = useState<ScanPhase>('idle');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl]   = useState<string | null>(null);
  const [scanData, setScanData]   = useState<ScannedReceipt | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string>('');
  const [editData, setEditData]   = useState<Partial<ScannedReceipt>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Selecione um arquivo de imagem (JPG, PNG, WEBP).');
      setPhase('error');
      return;
    }
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setScanData(null);
    setEditData({});
    setPhase('preview');
  }, []);

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

  // ── Scanner ────────────────────────────────────────────────────────────────

  const handleScan = async () => {
    if (!imageFile) return;
    setPhase('scanning');
    setErrorMsg('');
    try {
      const result = await scanReceipt(imageFile);
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Falha na extração');
      }
      setScanData(result.data);
      setEditData({ ...result.data });
      setPhase('review');
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Erro ao escanear recibo.');
      setPhase('error');
    }
  };

  // ── Confirm ────────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    if (!editData.amount) return;
    const tx: Partial<Transaction> = {
      amount:         editData.amount,
      description:    editData.description ?? editData.merchant ?? 'Recibo escaneado',
      merchant:       editData.merchant ?? undefined,
      date:           editData.date ?? new Date().toISOString(),
      type:           editData.type ?? TransactionType.DESPESA,
      category:       editData.category ?? Category.PESSOAL,
      payment_method: editData.payment_method ?? undefined,
      source:         'ai_image',
      confidence_score: editData.confidence ?? 0.7,
    };
    onAddTransaction?.([tx]);
    setConfirmed(true);
    setPhase('done');
  };

  const handleReset = () => {
    setPhase('idle');
    setImageFile(null);
    setImageUrl(null);
    setScanData(null);
    setEditData({});
    setErrorMsg('');
    setConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Confidence badge ───────────────────────────────────────────────────────

  const ConfidenceBadge = ({ v }: { v: number }) => {
    const pct = Math.round(v * 100);
    const color = pct >= 80 ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                : pct >= 50 ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10'
                :             'text-rose-500 bg-rose-50 dark:bg-rose-500/10';
    return (
      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${color}`}>
        {pct}% confiança
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30">
          <Receipt size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">
            {SECONDARY_FLOWS_COPY.scanner.title}
          </h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {SECONDARY_FLOWS_COPY.scanner.subtitle}
          </p>
        </div>
      </div>

      {/* ── PHASE: idle ─────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-4 p-10 rounded-[2rem] border-2 border-dashed cursor-pointer transition-all select-none
            ${isDragging
              ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 scale-[1.01]'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5'
            }`}
        >
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/20 dark:to-violet-500/20 rounded-2xl flex items-center justify-center">
            <ScanLine size={28} className="text-indigo-500" />
          </div>
          <div className="text-center">
            <p className="font-black text-slate-800 dark:text-white text-sm">
              {SECONDARY_FLOWS_COPY.scanner.idleTitle}
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              {SECONDARY_FLOWS_COPY.scanner.idleFormats}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <ShieldCheck size={10} className="text-emerald-500" /> Processado localmente
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* ── PHASE: preview ──────────────────────────────────────────────────── */}
      {phase === 'preview' && imageUrl && (
        <div className="flex flex-col gap-4">
          <div className="relative rounded-[2rem] overflow-hidden bg-slate-900 shadow-2xl">
            <img
              src={imageUrl}
              alt="Recibo selecionado"
              className="w-full max-h-72 object-contain"
            />
            <button
              onClick={handleReset}
              className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <X size={14} />
            </button>
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl">
              <p className="text-[9px] font-black text-white uppercase tracking-widest">
                {imageFile?.name?.slice(0, 28) ?? 'imagem selecionada'}
              </p>
            </div>
          </div>
          <button
            onClick={handleScan}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl p-4 flex items-center justify-center gap-3 font-black text-sm shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98] transition-all"
          >
            <ScanLine size={18} />
            {SECONDARY_FLOWS_COPY.scanner.scanCta}
          </button>
          <button onClick={handleReset} className="text-[10px] text-slate-400 font-bold text-center py-1">
            Escolher outra imagem
          </button>
        </div>
      )}

      {/* ── PHASE: scanning ─────────────────────────────────────────────────── */}
      {phase === 'scanning' && (
        <div className="flex flex-col items-center gap-6 py-10 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
          {imageUrl && (
            <div className="relative w-48 h-36 rounded-2xl overflow-hidden">
              <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-60" />
              {/* Scan line animation */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <div
                  className="absolute left-0 right-0 h-0.5 bg-indigo-400 shadow-[0_0_8px_2px_rgba(99,102,241,0.8)]"
                  style={{ animation: 'scan-line 1.8s ease-in-out infinite', top: '0%' }}
                />
              </div>
              <div className="absolute inset-0 border-2 border-indigo-400/60 rounded-2xl" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Loader2 size={18} className="text-indigo-500 animate-spin" />
            <div>
              <p className="font-black text-slate-800 dark:text-white text-sm">Analisando recibo…</p>
              <p className="text-[9px] text-slate-400 font-bold">Gemini Vision extraindo dados</p>
            </div>
          </div>
          <style>{`
            @keyframes scan-line {
              0%   { top: 0%;   opacity: 1; }
              50%  { top: 100%; opacity: 1; }
              51%  { top: 100%; opacity: 0; }
              52%  { top: 0%;   opacity: 0; }
              53%  { top: 0%;   opacity: 1; }
              100% { top: 0%;   opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* ── PHASE: review ───────────────────────────────────────────────────── */}
      {phase === 'review' && editData && (
        <div className="flex flex-col gap-4">

          {/* Preview + confidence */}
          <div className="flex items-start gap-3 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 p-4">
            {imageUrl && (
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Resultado da análise</p>
              {scanData && <ConfidenceBadge v={scanData.confidence} />}
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold mt-1 leading-relaxed">
                Revise os campos abaixo e confirme para registrar a transação.
              </p>
            </div>
          </div>

          {/* Editable fields */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden">

            {/* Amount */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                <DollarSign size={14} className="text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Valor</p>
                <input
                  type="number"
                  step="0.01"
                  value={editData.amount ?? ''}
                  onChange={e => setEditData(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-transparent font-black text-slate-900 dark:text-white text-sm outline-none mt-0.5"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Merchant */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Store size={14} className="text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estabelecimento</p>
                <input
                  type="text"
                  value={editData.merchant ?? ''}
                  onChange={e => setEditData(d => ({ ...d, merchant: e.target.value }))}
                  className="w-full bg-transparent font-bold text-slate-900 dark:text-white text-sm outline-none mt-0.5"
                  placeholder="Nome do estabelecimento"
                />
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
                <CalendarDays size={14} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Data</p>
                <input
                  type="date"
                  value={editData.date ? editData.date.slice(0, 10) : ''}
                  onChange={e => setEditData(d => ({ ...d, date: new Date(e.target.value).toISOString() }))}
                  className="w-full bg-transparent font-bold text-slate-900 dark:text-white text-sm outline-none mt-0.5"
                />
              </div>
            </div>

            {/* Type */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="w-8 h-8 bg-rose-50 dark:bg-rose-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Zap size={14} className="text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tipo</p>
                <select
                  value={editData.type ?? TransactionType.DESPESA}
                  onChange={e => setEditData(d => ({ ...d, type: e.target.value as TransactionType }))}
                  className="w-full bg-transparent font-bold text-slate-900 dark:text-white text-sm outline-none mt-0.5"
                >
                  <option value={TransactionType.DESPESA}>Despesa</option>
                  <option value={TransactionType.RECEITA}>Receita</option>
                </select>
              </div>
            </div>

            {/* Category */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="w-8 h-8 bg-violet-50 dark:bg-violet-500/10 rounded-xl flex items-center justify-center shrink-0">
                <FileImage size={14} className="text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Categoria</p>
                <select
                  value={editData.category ?? Category.PESSOAL}
                  onChange={e => setEditData(d => ({ ...d, category: e.target.value as Category }))}
                  className="w-full bg-transparent font-bold text-slate-900 dark:text-white text-sm outline-none mt-0.5"
                >
                  {Object.values(Category).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Payment method */}
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-8 h-8 bg-sky-50 dark:bg-sky-500/10 rounded-xl flex items-center justify-center shrink-0">
                <CreditCard size={14} className="text-sky-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Forma de pagamento</p>
                <select
                  value={editData.payment_method ?? ''}
                  onChange={e => setEditData(d => ({ ...d, payment_method: e.target.value as Transaction['payment_method'] }))}
                  className="w-full bg-transparent font-bold text-slate-900 dark:text-white text-sm outline-none mt-0.5"
                >
                  <option value="">Não informado</option>
                  {Object.entries(PAYMENT_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Confirm + redo */}
          <button
            onClick={handleConfirm}
            disabled={!editData.amount}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl p-4 flex items-center justify-center gap-3 font-black text-sm shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={18} />
            Confirmar e Registrar Transação
          </button>
          <button onClick={handleReset} className="w-full flex items-center justify-center gap-2 py-2 text-[10px] text-slate-400 font-bold">
            <RotateCcw size={12} /> Escanear outro recibo
          </button>
        </div>
      )}

      {/* ── PHASE: done ─────────────────────────────────────────────────────── */}
      {phase === 'done' && (
        <div className="flex flex-col items-center gap-5 py-12 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Check size={28} className="text-white" />
          </div>
          <div className="text-center">
            <p className="font-black text-slate-900 dark:text-white text-base">Transação registrada!</p>
            {editData.amount && (
              <p className="text-2xl font-black text-emerald-500 mt-1">
                {hideValues ? '••••' : fmt(editData.amount)}
              </p>
            )}
            {editData.merchant && (
              <p className="text-[10px] text-slate-400 font-bold mt-1">{editData.merchant}</p>
            )}
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-700 rounded-2xl font-black text-slate-700 dark:text-white text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <Camera size={15} /> Escanear outro
          </button>
        </div>
      )}

      {/* ── PHASE: error ────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="flex flex-col items-center gap-4 py-10 bg-rose-50 dark:bg-rose-500/10 rounded-[2rem] border border-rose-100 dark:border-rose-500/20">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-500/20 rounded-2xl flex items-center justify-center">
            <AlertCircle size={22} className="text-rose-500" />
          </div>
          <div className="text-center px-4">
            <p className="font-black text-rose-700 dark:text-rose-400 text-sm">Falha na leitura</p>
            <p className="text-[10px] text-rose-500 font-bold mt-1">{errorMsg}</p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 rounded-2xl font-black text-slate-700 dark:text-white text-sm shadow-sm"
          >
            <RotateCcw size={13} /> Tentar novamente
          </button>
        </div>
      )}

      {/* Tips */}
      {phase === 'idle' && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 p-5">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Dicas para melhor resultado</p>
          <div className="flex flex-col gap-2">
            {[
              { icon: '📸', text: 'Foto nítida e bem iluminada' },
              { icon: '📄', text: 'Documento inteiro visível no frame' },
              { icon: '🔍', text: 'Valores e datas em destaque' },
              { icon: '🤖', text: 'Gemini Vision extrai dados automaticamente' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <span className="text-sm">{icon}</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptScannerPage;
