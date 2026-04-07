import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Transaction } from '../types';
import { Account } from '../models/Account';
import {
  AICFOResponse, CFOIntent,
  buildFinancialContext,
  analyzeFinancialQuestion,
  generateCFOResponse,
  learnFromConversation,
} from '../src/ai/aiCFO';
import { runAIPipelineSync } from '../src/ai/aiOrchestrator';
import {
  Send, Loader2, BrainCircuit, Sparkles,
  User, Bot, Trash2, ChevronRight, ShieldCheck,
  TrendingUp, Wallet, AlertTriangle, PiggyBank, HelpCircle
} from 'lucide-react';
import { buildProductFinancialIntelligence } from '../src/app/productFinancialIntelligence';
import { AI_CFO_COPY } from '../src/app/assistantCopy';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AICFOProps {
  transactions: Transaction[];
  accounts: Account[];
  userId?: string;
  hideValues: boolean;
}

// ─── Quick prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS: { label: string; question: string; icon: React.ReactNode }[] = [
  { label: 'Posso gastar este mês?', question: 'Tenho espaço no meu orçamento para gastar mais este mês?', icon: <Wallet size={13} /> },
  { label: 'Como economizar?',       question: 'Onde posso cortar gastos para economizar mais?',           icon: <PiggyBank size={13} /> },
  { label: 'Risco nos próximos 30 dias?', question: 'Existe algum risco financeiro nos próximos 30 dias?', icon: <AlertTriangle size={13} /> },
  { label: 'Vale investir agora?',   question: 'Com base no meu saldo atual, vale a pena investir agora?', icon: <TrendingUp size={13} /> },
  { label: 'Resumo do mês',          question: 'Me dá um resumo da minha situação financeira este mês.',   icon: <Sparkles size={13} /> },
];

// ─── Intent badge ─────────────────────────────────────────────────────────────

const INTENT_LABEL: Record<CFOIntent, { label: string; color: string }> = {
  spending_advice:     { label: 'Gasto',       color: 'bg-rose-100 dark:bg-rose-500/10 text-rose-600' },
  budget_question:     { label: 'Orçamento',   color: 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600' },
  risk_question:       { label: 'Risco',       color: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600' },
  savings_question:    { label: 'Economia',    color: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600' },
  investment_question: { label: 'Investimento',color: 'bg-violet-100 dark:bg-violet-500/10 text-violet-600' },
  general_finance:     { label: 'Geral',       color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
};

// ─── Message bubble ───────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'cfo';
  text: string;
  intent?: CFOIntent;
  timestamp: string;
}

const UserBubble: React.FC<{ msg: Message }> = ({ msg }) => (
  <div className="flex justify-end gap-3 animate-in slide-in-from-right-4 duration-300">
    <div className="max-w-[80%]">
      <div className="bg-indigo-600 text-white px-5 py-3.5 rounded-[1.8rem] rounded-tr-lg shadow-md shadow-indigo-500/20">
        <p className="text-sm font-bold leading-relaxed">{msg.text}</p>
      </div>
      <p className="text-[8px] text-slate-400 mt-1 text-right font-bold">
        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0 mt-1">
      <User size={15} className="text-indigo-600 dark:text-indigo-400" />
    </div>
  </div>
);

const CFOBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const intentStyle = msg.intent ? INTENT_LABEL[msg.intent] : null;
  return (
    <div className="flex gap-3 animate-in slide-in-from-left-4 duration-300">
      <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shrink-0 mt-1 shadow-md shadow-indigo-500/20">
        <BrainCircuit size={15} className="text-white" />
      </div>
      <div className="max-w-[85%]">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-5 py-4 rounded-[1.8rem] rounded-tl-lg shadow-sm">
          {intentStyle && (
            <span className={`inline-block text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-2 ${intentStyle.color}`}>
              {intentStyle.label}
            </span>
          )}
          <p className="text-sm text-slate-700 dark:text-slate-200 font-bold leading-relaxed whitespace-pre-line">{msg.text}</p>
        </div>
        <div className="flex items-center gap-2 mt-1 ml-1">
          <ShieldCheck size={9} className="text-emerald-500" />
          <p className="text-[7px] text-slate-400 font-bold">Consultivo · Não constitui garantia financeira</p>
        </div>
      </div>
    </div>
  );
};

const TypingBubble: React.FC = () => (
  <div className="flex gap-3 animate-in fade-in duration-300">
    <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shrink-0">
      <BrainCircuit size={15} className="text-white" />
    </div>
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-5 py-4 rounded-[1.8rem] rounded-tl-lg shadow-sm flex items-center gap-2">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest ml-1">Analisando seus dados...</p>
    </div>
  </div>
);

// ─── Welcome screen ───────────────────────────────────────────────────────────

const WelcomeScreen: React.FC<{ onPrompt: (q: string) => void }> = ({ onPrompt }) => (
  <div className="flex flex-col items-center gap-6 py-6 px-2 animate-in fade-in duration-500">
    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/30">
      <BrainCircuit size={36} className="text-white" />
    </div>
    <div className="text-center">
      <h3 className="text-xl font-black text-slate-900 dark:text-white">{AI_CFO_COPY.welcomeTitle}</h3>
      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">{AI_CFO_COPY.welcomeSubtitle}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-bold leading-relaxed max-w-xs">
        {AI_CFO_COPY.welcomeDescription}
      </p>
    </div>

    <div className="w-full flex flex-col gap-2">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Sugestões rápidas</p>
      {QUICK_PROMPTS.map(p => (
        <button
          key={p.question}
          onClick={() => onPrompt(p.question)}
          className="w-full flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all active:scale-[0.98] group text-left"
        >
          <span className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
            {p.icon}
          </span>
          <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200">{p.label}</span>
          <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
        </button>
      ))}
    </div>

    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl w-full">
      <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
      <p className="text-[8px] text-slate-400 font-bold leading-relaxed">
        Suas informações são processadas via backend seguro com controles de autenticação, quota e rate limit.
      </p>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const AICFO: React.FC<AICFOProps> = ({ transactions, accounts, userId = 'local', hideValues }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Pipeline de análise financeira (contexto para o CFO)
  const pipeline = useMemo(() => runAIPipelineSync(transactions, userId), [transactions, userId]);
  const intelligence = useMemo(
    () => buildProductFinancialIntelligence({ userId, accounts, transactions }),
    [accounts, transactions, userId]
  );
  const financialContext = useMemo(
    () => buildFinancialContext(
      accounts,
      transactions,
      pipeline.financial_state.cashflow_prediction,
      pipeline.insights,
      userId,
      intelligence,
    ),
    [accounts, transactions, pipeline, userId, intelligence]
  );

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substr(2, 9),
      role: 'user',
      text: question.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Detectar intent
    const intent = analyzeFinancialQuestion(question);

    // Aprender padrões da conversa em background
    learnFromConversation(userId, question, intent).catch(e => {
      console.error('Erro ao aprender a partir da conversa:', e);
    });

    try {
      const response = await generateCFOResponse(question, financialContext, intent);
      const cfoMsg: Message = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'cfo',
        text: response.answer,
        intent,
        timestamp: response.timestamp,
      };
      setMessages(prev => [...prev, cfoMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        role: 'cfo',
        text: 'Com base nos seus dados, não consegui processar esta consulta agora. Tente novamente.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-700">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-5 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0 relative overflow-hidden mb-4">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl font-black text-white tracking-tight leading-none">{AI_CFO_COPY.headerTitle}</h2>
          <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1">{AI_CFO_COPY.headerSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="w-9 h-9 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              title="Limpar conversa"
            >
              <Trash2 size={15} />
            </button>
          )}
          <div className="w-9 h-9 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white">
            <BrainCircuit size={18} />
          </div>
        </div>
      </div>

      {/* Snapshot financeiro rápido */}
      <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
        {[
          { label: 'Saldo', value: intelligence.context.cashflowForecast.currentBalance },
          { label: '7 dias', value: intelligence.context.cashflowForecast.in7Days },
          { label: '30 dias', value: intelligence.context.cashflowForecast.in30Days },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 text-center">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className={`text-xs font-black mt-0.5 ${value >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
              {hideValues ? '••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 shrink-0">
        <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-[8px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
          Confiança {Math.round(intelligence.context.confidence.overall * 100)}%
        </span>
        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
          Recorrências {intelligence.recurringCount}
        </span>
        {intelligence.dominantCategoryLabel && (
          <span className="px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 text-[8px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">
            {intelligence.dominantCategoryLabel}
          </span>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-2 min-h-0">
        {messages.length === 0
          ? <WelcomeScreen onPrompt={sendMessage} />
          : messages.map(msg =>
              msg.role === 'user'
                ? <UserBubble key={msg.id} msg={msg} />
                : <CFOBubble key={msg.id} msg={msg} />
            )
        }
        {isLoading && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 mt-3 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-lg flex items-end gap-3 p-3 pl-5">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={AI_CFO_COPY.inputPlaceholder}
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400 placeholder:font-normal py-2 max-h-32"
          style={{ scrollbarWidth: 'none' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="w-11 h-11 bg-indigo-600 disabled:bg-slate-100 dark:disabled:bg-slate-700 text-white disabled:text-slate-300 dark:disabled:text-slate-500 rounded-2xl flex items-center justify-center transition-all active:scale-90 disabled:scale-100 shrink-0 shadow-md shadow-indigo-500/20 disabled:shadow-none"
        >
          {isLoading
            ? <Loader2 size={18} className="animate-spin" />
            : <Send size={18} />
          }
        </button>
      </div>

      {/* Quick prompts inline (quando há mensagens) */}
      {messages.length > 0 && !isLoading && (
        <div className="shrink-0 mt-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {QUICK_PROMPTS.map(p => (
            <button
              key={p.question}
              onClick={() => sendMessage(p.question)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-[9px] font-black text-slate-500 dark:text-slate-400 whitespace-nowrap hover:border-indigo-200 hover:text-indigo-600 transition-all shrink-0"
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AICFO;
