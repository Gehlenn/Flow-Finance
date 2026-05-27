import React, { useState, useRef, useEffect } from 'react';
import { GeminiService } from '../services/geminiService';
import { Transaction, TransactionType, Category, Reminder, ReminderData, ReminderType, TransactionData } from '../types';
import { Account, ACCOUNT_TYPE_LABELS } from '../models/Account';
import { interpretText, interpretImage } from '../src/ai/aiInterpreter';
import {
  normalizeFromAIText,
  normalizeFromAIImage,
  normalizeManual,
  draftToTransaction,
} from '../src/domain/intakeNormalizer';
import { TransactionDraft, getUncertainFields } from '../src/domain/transactionDraft';
import { logWarn } from '../src/utils/logger';

// Web Speech API â€” not in all browsers/typings
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}
declare const SpeechRecognition: SpeechRecognitionConstructor | undefined;

import { 
  X, Mic, Send, Sparkles, Loader2, Check, 
  ImageIcon, Briefcase, TrendingUp, AlertTriangle,
  ChevronLeft, ChevronRight, Lightbulb, Wallet, ShoppingBag, GraduationCap
} from 'lucide-react';

interface AIInputProps {
  onClose: () => void;
  onAddTransactions: (items: Partial<Transaction>[]) => void;
  onAddReminders: (items: Partial<Reminder>[]) => void;
  accounts?: Account[];
  userId?: string;
}

const REMINDER_TYPE_MAP: Record<string, ReminderType> = {
  pessoal: ReminderType.PESSOAL,
  trabalho: ReminderType.TRABALHO,
  negocio: ReminderType.NEGOCIO,
  'negócio': ReminderType.NEGOCIO,
  investimento: ReminderType.INVESTIMENTO,
  saude: ReminderType.SAUDE,
  'saúde': ReminderType.SAUDE,
};

const REMINDER_PRIORITY_MAP: Record<string, Reminder['priority']> = {
  baixa: 'baixa',
  media: 'media',
  'média': 'media',
  alta: 'alta',
};

const TIPS = [
  { text: "Gastei 50 reais no Uber hoje", icon: <TrendingUp size={12}/> },
  { text: "Recebi 2500 de salário agora", icon: <Check size={12}/> },
  { text: "Lembrar de pagar luz dia 10", icon: <Lightbulb size={12}/> },
  { text: "Comprei 300 reais em CDB", icon: <TrendingUp size={12}/> },
  { text: "Almoço com cliente deu 120", icon: <Briefcase size={12}/> }
];

const AI_INPUT_CLASSES = {
  primaryAction: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
  neutralInput: 'bg-slate-50 dark:bg-slate-800 rounded-2xl',
  neutralSelectable: 'bg-slate-50 dark:bg-slate-800 text-slate-400',
  selectedSelectable: 'bg-slate-900 text-white shadow-md dark:bg-slate-100 dark:text-slate-900',
} as const;

const AIInput: React.FC<AIInputProps> = ({ onClose, onAddTransactions, onAddReminders, accounts = [], userId = 'local' }) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<{ message: string; suggestion?: string } | null>(null);
  const [intakeWarning, setIntakeWarning] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [clickedTipIndex, setClickedTipIndex] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(
    accounts.length > 0 ? accounts[0].id : undefined
  );

  // â”€â”€ Draft review state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Quando confiança for média/baixa, o draft fica aqui para revisão antes de salvar.
  const [pendingDraft, setPendingDraft] = useState<TransactionDraft | null>(null);

  // Estados para modo Manual
  const [manualData, setManualData] = useState({
    description: '',
    amount: '',
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    recurring: false,
    recurrence_type: 'monthly' as 'daily' | 'weekly' | 'monthly',
    recurrence_interval: 1,
  });

  const gemini = useRef(new GeminiService());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const SpeechRecognitionClass: SpeechRecognitionConstructor | undefined =
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      recognitionRef.current = new SpeechRecognitionClass();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const ensureHasGeneratedItems = (count: number, kind: 'transaction' | 'reminder') => {
    if (count > 0) return;
    if (kind === 'transaction') throw new Error('Nenhuma transação foi gerada pela IA');
    throw new Error('Nenhum lembrete foi gerado pela IA');
  };

  const pickSingleTransaction = (items: TransactionData[], origin: 'text' | 'image') => {
    ensureHasGeneratedItems(items.length, 'transaction');
    if (items.length > 1) {
      logWarn('[AIInput] Multiple transactions returned; using the first draft only', {
        origin,
        count: items.length,
        fallback: 'ai-input-single-draft-multiple-transactions',
      });
      setIntakeWarning('A IA detectou múltiplas transações. Neste fluxo, apenas a primeira será usada e você deve revisar antes de salvar.');
    }
    return items[0];
  };

  const handleSuccess = () => {
    setIsLoading(false);
    setIntakeWarning(null);
    setDiagnostic(null);
    setIsSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Persiste um draft aprovado (caminho único de save)
  const commitDraft = (draft: TransactionDraft) => {
    onAddTransactions([draftToTransaction(draft) as Partial<Transaction>]);
    setPendingDraft(null);
    handleSuccess();
  };

  // Decide se exibe revisão ou salva diretamente
  const routeDraft = (draft: TransactionDraft, forceReview = false) => {
    if (draft.confidenceLevel === 'high' && !forceReview) {
      commitDraft(draft);
    } else {
      setIsLoading(false);
      setPendingDraft(draft);
    }
  };

  const handleAIProcess = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    setIntakeWarning(null);
    setDiagnostic(null);
    try {
      const output = await interpretText(
        inputText,
        userId,
        (text) => gemini.current.processSmartInput(text)
      );

      if (output.intent === 'transaction') {
        const txData = output.data as TransactionData[];
        const hasAmbiguousBatch = txData.length > 1;
        const selectedTransaction = pickSingleTransaction(txData, 'text');
        const draft = normalizeFromAIText({
          data: selectedTransaction,
          confidence: output.confidence,
          rawInput: inputText,
          accountId: selectedAccountId,
        });
        routeDraft(draft, hasAmbiguousBatch);
      } else if (output.intent === 'reminder') {
        const reminderData = output.data as ReminderData[];
        ensureHasGeneratedItems(reminderData.length, 'reminder');
        const reminders: Partial<Reminder>[] = reminderData.map((item) => ({
          title: item.title,
          date: item.date,
          amount: item.amount,
          type: REMINDER_TYPE_MAP[item.type?.toLowerCase?.() ?? ''] || ReminderType.PESSOAL,
          priority: REMINDER_PRIORITY_MAP[item.priority?.toLowerCase?.() ?? ''] || 'media',
        }));
        onAddReminders(reminders);
        handleSuccess();
      } else {
        setDiagnostic(output.diagnostic ?? {
          message: 'Nao consegui entender com seguranca o que voce quis registrar.',
          suggestion: 'Use o modo manual ou descreva valor, data e tipo de forma mais direta.',
        });
        setError('Nao consegui entender. Tente ser mais especifico ou use o modo manual.');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      logWarn('[AIInput] Failed to process AI input', {
        error: err,
        fallback: 'ai-input-processing-failed',
      });
      setDiagnostic({
        message: 'A IA nao conseguiu processar este lancamento agora.',
        suggestion: 'Tente novamente em alguns instantes ou use o modo manual.',
      });
      setError("Não consegui entender. Tente ser mais específico ou use o modo manual.");
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIntakeWarning(null);
    setDiagnostic(null);
    const val = parseFloat(manualData.amount);
    if (!manualData.description || isNaN(val)) {
      setError("Preencha a descrição e um valor válido.");
      return;
    }
    const draft = normalizeManual({
      description: manualData.description,
      amount: val,
      type: manualData.type,
      category: manualData.category,
      accountId: selectedAccountId,
      recurring: manualData.recurring,
      recurrenceType: manualData.recurring ? manualData.recurrence_type : undefined,
      recurrenceInterval: manualData.recurring ? manualData.recurrence_interval : undefined,
    });
    // Manual sempre alta confiança â€” salva direto
    onAddTransactions([{
      ...draftToTransaction(draft) as Partial<Transaction>,
      recurring: manualData.recurring,
      recurrence_type: manualData.recurring ? manualData.recurrence_type : undefined,
      recurrence_interval: manualData.recurring ? manualData.recurrence_interval : undefined,
    }]);
    handleSuccess();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setIntakeWarning(null);
    setDiagnostic(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const output = await interpretImage(
          base64,
          file.type,
          inputText,
          userId,
          (b, m, t) => gemini.current.parseFinancialImage(b, m, t)
        );
        const txData = output.data as TransactionData[];
        const hasAmbiguousBatch = txData.length > 1;
        const selectedTransaction = pickSingleTransaction(txData, 'image');
        const draft = normalizeFromAIImage({
          data: selectedTransaction,
          confidence: output.confidence,
          mimeType: file.type,
          accountId: selectedAccountId,
        });
        routeDraft(draft, hasAmbiguousBatch);
      } catch (err) {
        logWarn('[AIInput] Failed to process AI input', {
          error: err,
          fileType: file.type,
          fallback: 'ai-input-processing-failed',
        });
        setDiagnostic({
          message: 'A IA nao conseguiu ler a imagem enviada agora.',
          suggestion: 'Envie uma foto mais nítida ou use o modo manual para registrar os dados.',
        });
        setError("Erro ao ler imagem. Tente uma foto mais nítida.");
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // â”€â”€ Draft Review Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (pendingDraft) {
    const uncertainFields = getUncertainFields(pendingDraft.fieldConfidences ?? {});
    const isUncertain = (field: string) => uncertainFields.includes(field as keyof typeof pendingDraft.fieldConfidences);

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 transition-all">
        <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-500">
                {pendingDraft.confidenceLevel === 'low' ? 'Revisão obrigatória' : 'Confirme os campos'}
              </span>
            </div>
            <button onClick={() => setPendingDraft(null)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 flex flex-col gap-4">
            {diagnostic && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 px-3 py-3 text-amber-950 dark:text-amber-100">
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em]">Diagnóstico de entrada</p>
                <p className="mt-1 text-[10px] font-medium leading-relaxed">{diagnostic.message}</p>
                {diagnostic.suggestion && (
                  <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] opacity-90">
                    Próximo passo: {diagnostic.suggestion}
                  </p>
                )}
              </div>
            )}
            {intakeWarning && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                {intakeWarning}
              </div>
            )}
            <p className="text-[10px] text-slate-400 font-medium">
              {pendingDraft.confidenceLevel === 'low'
                ? 'A IA não conseguiu extrair alguns dados com certeza. Campos destacados precisam de confirmação.'
                : 'Verifique os campos destacados antes de salvar.'}
            </p>

            {/* Descrição */}
            <div className={`rounded-2xl p-3 border ${isUncertain('description') ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-100 dark:border-slate-800'}`}>
              <label className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 block mb-1">
                Descrição {isUncertain('description') && <span className="text-amber-500 ml-1">âš </span>}
              </label>
              <input
                className="w-full text-sm bg-transparent text-slate-800 dark:text-white outline-none"
                value={pendingDraft.description}
                onChange={e => setPendingDraft(d => d ? { ...d, description: e.target.value } : null)}
              />
            </div>

            {/* Valor */}
            <div className={`rounded-2xl p-3 border ${isUncertain('amount') ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-100 dark:border-slate-800'}`}>
              <label className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 block mb-1">
                Valor {isUncertain('amount') && <span className="text-amber-500 ml-1">âš </span>}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full text-sm bg-transparent text-slate-800 dark:text-white outline-none"
                value={pendingDraft.amount}
                onChange={e => setPendingDraft(d => d ? { ...d, amount: parseFloat(e.target.value) || 0 } : null)}
              />
            </div>

            {/* Tipo */}
            <div className="flex gap-2">
              {[TransactionType.DESPESA, TransactionType.RECEITA].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPendingDraft(d => d ? { ...d, type: t } : null)}
                  className={`flex-1 py-2 rounded-2xl text-[9px] font-semibold uppercase tracking-[0.08em] transition-all ${pendingDraft.type === t ? AI_INPUT_CLASSES.primaryAction : AI_INPUT_CLASSES.neutralSelectable}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Categoria */}
            <div className={`rounded-2xl p-3 border ${isUncertain('category') ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-100 dark:border-slate-800'}`}>
              <label className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 block mb-1">
                Categoria {isUncertain('category') && <span className="text-amber-500 ml-1">âš </span>}
              </label>
              <select
                className="w-full text-sm bg-transparent text-slate-800 dark:text-white outline-none"
                value={pendingDraft.category ?? ''}
                onChange={e => setPendingDraft(d => d ? { ...d, category: e.target.value as Category } : null)}
              >
                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setPendingDraft(null)}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-semibold uppercase tracking-[0.08em] ${AI_INPUT_CLASSES.neutralSelectable} transition-all`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => commitDraft(pendingDraft)}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-semibold uppercase tracking-[0.08em] ${AI_INPUT_CLASSES.primaryAction} shadow-md transition-all`}
              >
                Confirmar e Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 transition-all">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header Seletor de Modo */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl">
            <button 
              onClick={() => setMode('ai')} 
              className={`px-6 py-2 rounded-xl text-[9px] font-semibold uppercase tracking-[0.08em] transition-all ${mode === 'ai' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}
            >
              Inteligência Artificial
            </button>
            <button 
              onClick={() => setMode('manual')} 
              className={`px-6 py-2 rounded-xl text-[9px] font-semibold uppercase tracking-[0.08em] transition-all ${mode === 'manual' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}
            >
              Lançamento Manual
            </button>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-8 flex-1">
          {diagnostic && (
            <div role="status" className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-200 text-[10px] font-medium">
              <div className="font-semibold uppercase tracking-[0.08em]">Diagnóstico de entrada</div>
              <div className="mt-1 leading-relaxed">{diagnostic.message}</div>
              {diagnostic.suggestion && (
                <div className="mt-1 uppercase tracking-[0.08em] text-[9px] opacity-90">
                  Próximo passo: {diagnostic.suggestion}
                </div>
              )}
            </div>
          )}
          {intakeWarning && (
            <div role="status" className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/30 rounded-2xl text-amber-600 dark:text-amber-300 text-[10px] font-medium flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" /> {intakeWarning}
            </div>
          )}
          {error && (
            <div role="alert" className="mb-4 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-rose-500 text-[10px] font-medium flex items-center gap-2">
               <X size={14} className="shrink-0" /> {error}
            </div>
          )}

          {/* Seletor de Conta */}
          {accounts.length > 0 && (
            <div className="mb-5">
              <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1 block mb-2">Conta</label>
              <div className="flex gap-2 flex-wrap">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`px-4 py-2 rounded-2xl text-[9px] font-semibold uppercase tracking-[0.08em] transition-all flex items-center gap-1.5 ${selectedAccountId === acc.id ? AI_INPUT_CLASSES.selectedSelectable : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}`}
                  >
                    <Wallet size={12} />
                    {acc.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedAccountId(undefined)}
                  className={`px-4 py-2 rounded-2xl text-[9px] font-semibold uppercase tracking-[0.08em] transition-all ${!selectedAccountId ? 'bg-slate-700 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}`}
                >
                  Sem conta
                </button>
              </div>
            </div>
          )}

          {mode === 'ai' ? (
            <div className="space-y-6">
              {/* Dicas Animadas */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-4">
                  <button onClick={() => setTipIndex(prev => (prev - 1 + TIPS.length) % TIPS.length)} className="text-slate-300 hover:text-slate-500 transition-colors"><ChevronLeft size={16}/></button>
                  <button 
                    onClick={() => {
                      setInputText(TIPS[tipIndex].text);
                      setClickedTipIndex(tipIndex);
                      setTimeout(() => setClickedTipIndex(null), 500);
                    }}
                    className={`flex items-center gap-2 flex-1 justify-center transition-all duration-300 rounded-xl py-1 ${clickedTipIndex === tipIndex ? 'bg-slate-100 dark:bg-slate-800 scale-105 shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
                  >
                    <div className={`transition-colors ${clickedTipIndex === tipIndex ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>{TIPS[tipIndex]?.icon}</div>
                    <p className={`text-[10px] font-medium italic transition-colors ${clickedTipIndex === tipIndex ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>"{TIPS[tipIndex]?.text}"</p>
                  </button>
                  <button onClick={() => setTipIndex(prev => (prev + 1) % TIPS.length)} className="text-slate-300 hover:text-slate-500 transition-colors"><ChevronRight size={16}/></button>
                </div>
              </div>

              {/* Input de Texto */}
              <div className="relative group">
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Diga ou escreva o que aconteceu..."
                  className={`w-full h-40 p-6 ${AI_INPUT_CLASSES.neutralInput} rounded-[2rem] border-2 border-transparent focus:border-slate-300 focus:bg-white dark:focus:bg-slate-800 text-slate-700 dark:text-white font-medium outline-none resize-none transition-all shadow-inner`}
                />
                
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm rounded-[2rem]">
                    <Loader2 className="animate-spin text-slate-600" size={32} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Processando...</p>
                  </div>
                )}

                <div className="absolute bottom-4 right-4 flex gap-2">
                   <button 
                     onClick={() => fileInputRef.current?.click()} 
                     className="p-3 bg-white dark:bg-slate-700 text-slate-400 rounded-2xl shadow-sm hover:text-slate-700"
                     title="Subir Comprovante"
                   >
                     <ImageIcon size={20} />
                   </button>
                   <button 
                     onClick={toggleListening} 
                     className={`p-3 rounded-2xl shadow-sm transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-white dark:bg-slate-700 text-slate-400 hover:text-rose-500'}`}
                     title="Voz"
                   >
                     <Mic size={20} />
                   </button>
                </div>
              </div>

              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

              <button 
                onClick={handleAIProcess}
                disabled={isLoading || !inputText.trim() || isSuccess}
                className={`w-full py-5 rounded-2xl font-semibold text-xs uppercase tracking-[0.08em] shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all duration-500 ${isSuccess ? 'bg-emerald-500 text-white scale-105' : AI_INPUT_CLASSES.primaryAction}`}
              >
                {isSuccess ? (
                  <>
                    <Check size={20} className="animate-bounce" /> Confirmado!
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Confirmar Inteligente
                  </>
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className={`space-y-4 animate-in slide-in-from-right-4 duration-300 ${isSuccess ? 'opacity-0 scale-95 transition-all duration-500' : ''}`}>
              <div className="space-y-2">
                <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Descrição</label>
                <input 
                  type="text" required
                  value={manualData.description}
                  onChange={e => setManualData({...manualData, description: e.target.value})}
                  className={`w-full p-4 ${AI_INPUT_CLASSES.neutralInput} outline-none font-medium text-sm text-slate-800 dark:text-white`}
                  placeholder="Ex: Mercado Mensal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Valor (R$)</label>
                  <input 
                    type="number" step="0.01" required
                    value={manualData.amount}
                    onChange={e => setManualData({...manualData, amount: e.target.value})}
                    className={`w-full p-4 ${AI_INPUT_CLASSES.neutralInput} outline-none font-semibold text-lg text-slate-800 dark:text-white`}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Tipo</label>
                  <select 
                    value={manualData.type}
                    onChange={e => setManualData({...manualData, type: e.target.value as TransactionType})}
                    className={`w-full p-4 ${AI_INPUT_CLASSES.neutralInput} outline-none font-medium text-sm text-slate-800 dark:text-white border-none appearance-none`}
                  >
                    <option value={TransactionType.DESPESA}>Despesa (Saída)</option>
                    <option value={TransactionType.RECEITA}>Receita (Entrada)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Categoria</label>
                <div className="grid grid-cols-2 gap-2">
                   {Object.values(Category).map(cat => (
                     <button
                       key={cat} type="button"
                       onClick={() => setManualData({...manualData, category: cat})}
                       className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${manualData.category === cat ? 'bg-slate-900 text-white border-slate-900 shadow-lg dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400'}`}
                     >
                       <div className="shrink-0">
                         {cat === Category.PESSOAL && <ShoppingBag size={14}/>}
                         {cat === Category.CONSULTORIO && <GraduationCap size={14}/>}
                         {cat === Category.NEGOCIO && <Briefcase size={14}/>}
                         {cat === Category.INVESTIMENTO && <TrendingUp size={14}/>}
                       </div>
                       <span className="text-[8px] font-semibold uppercase tracking-tight truncate">{cat}</span>
                     </button>
                   ))}
                </div>
              </div>

              {/* Recorrência */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <div>
                    <p className="text-[9px] font-semibold text-slate-700 dark:text-white uppercase tracking-[0.08em]">Recorrente</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Repetir automaticamente</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualData({ ...manualData, recurring: !manualData.recurring })}
                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${manualData.recurring ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${manualData.recurring ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {manualData.recurring && (
                  <div className="animate-in slide-in-from-top-2 duration-200 flex gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Frequência</label>
                      <select
                        value={manualData.recurrence_type}
                        onChange={e => setManualData({ ...manualData, recurrence_type: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                        className={`w-full p-3 ${AI_INPUT_CLASSES.neutralInput} outline-none font-medium text-sm text-slate-800 dark:text-white border-none appearance-none`}
                      >
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </div>
                    <div className="w-24 space-y-1">
                      <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">A cada</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={manualData.recurrence_interval}
                        onChange={e => setManualData({ ...manualData, recurrence_interval: Math.max(1, parseInt(e.target.value) || 1) })}
                        className={`w-full p-3 ${AI_INPUT_CLASSES.neutralInput} outline-none font-semibold text-lg text-slate-800 dark:text-white text-center`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={isSuccess}
                className={`w-full py-5 rounded-[1.8rem] font-semibold text-[10px] uppercase tracking-[0.08em] shadow-xl active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 ${isSuccess ? 'bg-emerald-500 text-white scale-105' : AI_INPUT_CLASSES.primaryAction}`}
              >
                {isSuccess ? <Check size={16} className="animate-bounce" /> : 'Salvar Lançamento'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInput;




