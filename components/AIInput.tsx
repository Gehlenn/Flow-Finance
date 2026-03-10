import React, { useState, useRef, useEffect } from 'react';
import { GeminiService } from '../services/geminiService';
import { Transaction, TransactionType, Category, ReminderData, TransactionData } from '../types';
import { Account, ACCOUNT_TYPE_LABELS } from '../models/Account';
import { interpretText, interpretImage } from '../src/ai/aiInterpreter';
import { 
  X, Mic, Send, Sparkles, Loader2, Check, 
  ImageIcon, Briefcase, TrendingUp,
  ChevronLeft, ChevronRight, Lightbulb, Wallet, ShoppingBag, GraduationCap
} from 'lucide-react';

interface AIInputProps {
  onClose: () => void;
  onAddTransactions: (items: Partial<Transaction>[]) => void;
  onAddReminders: (items: ReminderData[]) => void;
  accounts?: Account[];
  userId?: string;
}

const TIPS = [
  { text: "Gastei 50 reais no Uber hoje", icon: <TrendingUp size={12}/> },
  { text: "Recebi 2500 de salário agora", icon: <Check size={12}/> },
  { text: "Lembrar de pagar luz dia 10", icon: <Lightbulb size={12}/> },
  { text: "Comprei 300 reais em CDB", icon: <TrendingUp size={12}/> },
  { text: "Almoço com cliente deu 120", icon: <Briefcase size={12}/> }
];

const AIInput: React.FC<AIInputProps> = ({ onClose, onAddTransactions, onAddReminders, accounts = [], userId = 'local' }) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [clickedTipIndex, setClickedTipIndex] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(
    accounts.length > 0 ? accounts[0].id : undefined
  );

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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.onresult = (event: any) => {
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

  const handleSuccess = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleAIProcess = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      // Camada 1: AI Interpreter (enriquece com memória + loga debug)
      const output = await interpretText(
        inputText,
        userId,
        (text) => gemini.current.processSmartInput(text)
      );

      if (output.intent === 'transaction') {
        const txData = output.data as TransactionData[];
        const withAccount = txData.map((t) => ({
          ...t,
          account_id: selectedAccountId,
          source: 'ai_text' as const,
          confidence_score: output.confidence,
        }));
        onAddTransactions(withAccount);
      } else if (output.intent === 'reminder') {
        onAddReminders(output.data);
      } else {
        throw new Error('intent desconhecido');
      }
      handleSuccess();
    } catch (err: unknown) {
      console.error('AIInput error', err);
      setError("Não consegui entender. Tente ser mais específico ou use o modo manual.");
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(manualData.amount);
    if (!manualData.description || isNaN(val)) {
      setError("Preencha a descrição e um valor válido.");
      return;
    }
    onAddTransactions([{
      description: manualData.description,
      amount: val,
      type: manualData.type,
      category: manualData.category,
      date: new Date().toISOString(),
      account_id: selectedAccountId,
      source: 'manual',
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
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        // Camada 1: AI Interpreter (image path)
        const output = await interpretImage(
          base64,
          file.type,
          inputText,
          userId,
          (b, m, t) => gemini.current.parseFinancialImage(b, m, t)
        );
        const txData = output.data as TransactionData[];
        const withAccount = txData.map((t) => ({
          ...t,
          account_id: selectedAccountId,
          source: 'ai_image' as const,
          confidence_score: output.confidence,
        }));
        onAddTransactions(withAccount);
        handleSuccess();
      } catch (err) {
        setError("Erro ao ler imagem. Tente uma foto mais nítida.");
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 transition-all">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header Seletor de Modo */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl">
            <button 
              onClick={() => setMode('ai')} 
              className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'ai' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
            >
              Inteligência Artificial
            </button>
            <button 
              onClick={() => setMode('manual')} 
              className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'manual' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
            >
              Lançamento Manual
            </button>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-8 flex-1">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-rose-500 text-[10px] font-bold flex items-center gap-2">
               <X size={14} className="shrink-0" /> {error}
            </div>
          )}

          {/* Seletor de Conta */}
          {accounts.length > 0 && (
            <div className="mb-5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Conta</label>
              <div className="flex gap-2 flex-wrap">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${selectedAccountId === acc.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}`}
                  >
                    <Wallet size={12} />
                    {acc.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedAccountId(undefined)}
                  className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${!selectedAccountId ? 'bg-slate-700 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}`}
                >
                  Sem conta
                </button>
              </div>
            </div>
          )}

          {mode === 'ai' ? (
            <div className="space-y-6">
              {/* Dicas Animadas */}
              <div className="bg-indigo-50/50 dark:bg-indigo-500/10 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/20">
                <div className="flex items-center justify-between gap-4">
                  <button onClick={() => setTipIndex(prev => (prev - 1 + TIPS.length) % TIPS.length)} className="text-indigo-300 hover:text-indigo-500 transition-colors"><ChevronLeft size={16}/></button>
                  <button 
                    onClick={() => {
                      setInputText(TIPS[tipIndex].text);
                      setClickedTipIndex(tipIndex);
                      setTimeout(() => setClickedTipIndex(null), 500);
                    }}
                    className={`flex items-center gap-2 flex-1 justify-center transition-all duration-300 rounded-xl py-1 ${clickedTipIndex === tipIndex ? 'bg-indigo-100 dark:bg-indigo-500/30 scale-105 shadow-sm' : 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`}
                  >
                    <div className={`transition-colors ${clickedTipIndex === tipIndex ? 'text-indigo-600 dark:text-indigo-300' : 'text-indigo-400'}`}>{TIPS[tipIndex]?.icon}</div>
                    <p className={`text-[10px] font-bold italic transition-colors ${clickedTipIndex === tipIndex ? 'text-indigo-700 dark:text-indigo-200' : 'text-slate-500'}`}>"{TIPS[tipIndex]?.text}"</p>
                  </button>
                  <button onClick={() => setTipIndex(prev => (prev + 1) % TIPS.length)} className="text-indigo-300 hover:text-indigo-500 transition-colors"><ChevronRight size={16}/></button>
                </div>
              </div>

              {/* Input de Texto */}
              <div className="relative group">
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Diga ou escreva o que aconteceu..."
                  className="w-full h-40 p-6 bg-slate-50 dark:bg-slate-800 rounded-[2rem] border-2 border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-slate-800 text-slate-700 dark:text-white font-bold outline-none resize-none transition-all shadow-inner"
                />
                
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm rounded-[2rem]">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Processando...</p>
                  </div>
                )}

                <div className="absolute bottom-4 right-4 flex gap-2">
                   <button 
                     onClick={() => fileInputRef.current?.click()} 
                     className="p-3 bg-white dark:bg-slate-700 text-slate-400 rounded-2xl shadow-sm hover:text-indigo-500"
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
                className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all duration-500 ${isSuccess ? 'bg-emerald-500 text-white scale-105' : 'bg-indigo-600 text-white'}`}
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
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <input 
                  type="text" required
                  value={manualData.description}
                  onChange={e => setManualData({...manualData, description: e.target.value})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-bold text-sm text-slate-800 dark:text-white"
                  placeholder="Ex: Mercado Mensal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                  <input 
                    type="number" step="0.01" required
                    value={manualData.amount}
                    onChange={e => setManualData({...manualData, amount: e.target.value})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-black text-lg text-slate-800 dark:text-white"
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                  <select 
                    value={manualData.type}
                    onChange={e => setManualData({...manualData, type: e.target.value as TransactionType})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-bold text-sm text-slate-800 dark:text-white border-none appearance-none"
                  >
                    <option value={TransactionType.DESPESA}>Despesa (Saída)</option>
                    <option value={TransactionType.RECEITA}>Receita (Entrada)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                <div className="grid grid-cols-2 gap-2">
                   {Object.values(Category).map(cat => (
                     <button
                       key={cat} type="button"
                       onClick={() => setManualData({...manualData, category: cat})}
                       className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${manualData.category === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400'}`}
                     >
                       <div className="shrink-0">
                         {cat === Category.PESSOAL && <ShoppingBag size={14}/>}
                         {cat === Category.CONSULTORIO && <GraduationCap size={14}/>}
                         {cat === Category.NEGOCIO && <Briefcase size={14}/>}
                         {cat === Category.INVESTIMENTO && <TrendingUp size={14}/>}
                       </div>
                       <span className="text-[8px] font-black uppercase tracking-tight truncate">{cat}</span>
                     </button>
                   ))}
                </div>
              </div>

              {/* Recorrência */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <div>
                    <p className="text-[9px] font-black text-slate-700 dark:text-white uppercase tracking-widest">Recorrente</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Repetir automaticamente</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualData({ ...manualData, recurring: !manualData.recurring })}
                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${manualData.recurring ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${manualData.recurring ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {manualData.recurring && (
                  <div className="animate-in slide-in-from-top-2 duration-200 flex gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Frequência</label>
                      <select
                        value={manualData.recurrence_type}
                        onChange={e => setManualData({ ...manualData, recurrence_type: e.target.value as any })}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-bold text-sm text-slate-800 dark:text-white border-none appearance-none"
                      >
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </div>
                    <div className="w-24 space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">A cada</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={manualData.recurrence_interval}
                        onChange={e => setManualData({ ...manualData, recurrence_interval: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-black text-lg text-slate-800 dark:text-white text-center"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={isSuccess}
                className={`w-full py-5 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 ${isSuccess ? 'bg-emerald-500 text-white scale-105' : 'bg-slate-900 dark:bg-indigo-600 text-white'}`}
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