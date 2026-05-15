import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ReminderType, type Reminder, Transaction } from '../types';
import { Account } from '../models/Account';
import { makeId } from '../src/utils/helpers';
import {
  CFOIntent,
  buildFinancialContext,
  analyzeFinancialQuestion,
  generateCFOResponse,
  learnFromConversation,
  type AICFOExplainability,
} from '../src/ai/aiCFO';
import { logWarn } from '../src/utils/logger';
import { runAIPipelineSync } from '../src/ai/aiOrchestrator';
import {
  Send, Loader2, BrainCircuit, Sparkles,
  User, Bot, Trash2, ChevronRight, ShieldCheck,
  TrendingUp, Wallet, AlertTriangle, PiggyBank, HelpCircle
} from 'lucide-react';
import { buildProductFinancialIntelligence } from '../src/app/productFinancialIntelligence';
import { AI_CFO_COPY } from '../src/app/assistantCopy';
import { canAccessFeature } from '../src/app/monetizationPlan';
import type { Tab } from '../hooks/useNavigationTabs';
import { clearCFOConversation, loadCFOConversation, saveCFOConversation, type CFOConversationMessage } from '../src/ai/cfoConversationStore';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AICFOProps {
  transactions: Transaction[];
  accounts: Account[];
  userId?: string;
  workspacePlan?: 'free' | 'pro';
  hideValues: boolean;
  onNavigateToTab?: (tab: Tab) => void;
  onCreateReminder?: (reminder: Partial<Reminder>) => void;
}

// ─── Quick prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS: { label: string; question: string; icon: React.ReactNode }[] = [
  { label: 'Posso pagar a semana?', question: 'Posso pagar a semana?', icon: <Wallet size={13} /> },
  { label: 'Qual o risco da semana?', question: 'Qual o risco da semana?', icon: <AlertTriangle size={13} /> },
  { label: 'O que entra até o mês fechar?', question: 'O que entra até o mês fechar?', icon: <TrendingUp size={13} /> },
  { label: 'O que vence agora?', question: 'O que vence agora?', icon: <HelpCircle size={13} /> },
  { label: 'Resumo do caixa', question: 'Resumo do caixa', icon: <Sparkles size={13} /> },
  { label: 'Onde cortar hoje?', question: 'Onde cortar hoje?', icon: <PiggyBank size={13} /> },
];

// ─── Intent badge ─────────────────────────────────────────────────────────────

const INTENT_LABEL: Record<CFOIntent, { label: string; color: string }> = {
  spending_advice:  { label: 'Gasto', color: 'bg-rose-100 dark:bg-rose-500/10 text-rose-600' },
  cash_position: { label: 'Caixa', color: 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600' },
  risk_question:    { label: 'Risco', color: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600' },
  receivables_question:{ label: 'Recebiveis', color: 'bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600' },
  savings_question: { label: 'Economia', color: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600' },
  monthly_summary:  { label: 'Resumo', color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
};

const CONFIDENCE_BAND_LABEL: Record<AICFOExplainability['confidence_band'], string> = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
};

const RESPONSE_DEPTH_LABEL: Record<'standard' | 'reduced', string> = {
  standard: 'Profundidade normal',
  reduced: 'Profundidade reduzida',
};

// ─── Message bubble ───────────────────────────────────────────────────────────

type Message = Omit<CFOConversationMessage, 'intent'> & {
  intent?: CFOIntent;
};

const buildConversationLearningDiagnostic = (): { title: string; message: string; suggestion: string } => ({
  title: 'Aprendizado da conversa indisponivel',
  message: 'Nao foi possivel atualizar o aprendizado do CFO em segundo plano agora.',
  suggestion: 'Envie uma nova pergunta ou tente novamente quando a conexao do workspace estiver estável.',
});

function buildResponseReminder(message: Message): Partial<Reminder> {
  const highPriority = message.intent === 'risk_question' || message.intent === 'cash_position';
  return {
    title: message.intent === 'risk_question'
      ? 'Acompanhar risco do CFO'
      : message.intent === 'cash_position'
        ? 'Revisar posicao de caixa indicada pelo CFO'
        : 'Revisar recomendacao do CFO',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    type: ReminderType.NEGOCIO,
    priority: highPriority ? 'alta' : 'media',
    completed: false,
  };
}


const UserBubble: React.FC<{ msg: Message }> = ({ msg }) => (
  <div className="flex justify-end gap-3 animate-in slide-in-from-right-4 duration-300">
    <div className="max-w-[80%]">
      <div className="bg-indigo-600 text-white px-5 py-3.5 rounded-[1.8rem] rounded-tr-lg shadow-md shadow-indigo-500/20">
        <p className="text-sm leading-relaxed text-slate-100">{msg.text}</p>
      </div>
      <p className="text-xs text-slate-400 mt-1 text-right">
        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0 mt-1">
      <User size={15} className="text-indigo-600 dark:text-indigo-400" />
    </div>
  </div>
);

const AssistantBubble: React.FC<{ msg: Message; onCreateReminder?: (reminder: Partial<Reminder>) => void; onNavigateToTab?: (tab: Tab) => void; }> = ({ msg, onCreateReminder, onNavigateToTab }) => {
  const intentStyle = msg.intent ? INTENT_LABEL[msg.intent] : null;
  return (
    <div className="flex gap-3 animate-in slide-in-from-left-4 duration-300">
      <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shrink-0 mt-1 shadow-md shadow-indigo-500/20">
        <BrainCircuit size={15} className="text-white" />
      </div>
      <div className="max-w-[85%]">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-5 py-4 rounded-[1.8rem] rounded-tl-lg shadow-sm">
          {intentStyle && (
            <span className={`inline-block text-xs font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full mb-2 ${intentStyle.color}`}>
              {intentStyle.label}
            </span>
          )}
          {msg.diagnostic && (
            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="text-xs font-semibold uppercase tracking-[0.08em]">Diagnóstico da IA</p>
              <p className="mt-1 text-xs leading-relaxed">{msg.diagnostic.message}</p>
              {msg.diagnostic.suggestion && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] opacity-90">
                  Próximo passo: {msg.diagnostic.suggestion}
                </p>
              )}
            </div>
          )}
          {msg.explainability && (
            <div className="mb-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-300">Base da resposta</p>
              <ul className="mt-1 space-y-1">
                {msg.explainability.reasons_used.map(reason => (
                  <li key={reason} className="text-xs text-slate-600 dark:text-slate-300">• {reason}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Sinais usados</p>
              <div className="mt-1 grid gap-1">
                {Object.entries(msg.explainability.evidence)
                  .filter(([, value]) => Boolean(value))
                  .map(([key, value]) => (
                    <p key={key} className="text-xs text-slate-600 dark:text-slate-300">
                      {key.replace(/_/g, ' ')}: {String(value)}
                    </p>
                  ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                Nivel de confianca desta resposta: {CONFIDENCE_BAND_LABEL[msg.explainability.confidence_band]}
              </p>
            </div>
          )}
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">{msg.text}</p>
          {msg.responseDepth && (
            <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.08em] ${
              msg.responseDepth === 'reduced'
                ? 'text-amber-600 dark:text-amber-300'
                : 'text-emerald-600 dark:text-emerald-300'
            }`}>
              {RESPONSE_DEPTH_LABEL[msg.responseDepth]}
            </p>
          )}
          {msg.role === 'assistant' && (onCreateReminder || onNavigateToTab) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {onCreateReminder && (
                <button
                  type="button"
                  onClick={() => onCreateReminder(buildResponseReminder(msg))}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Sparkles size={14} />
                  Criar lembrete
                </button>
              )}
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('flow')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-indigo-700"
                >
                  <Wallet size={14} />
                  Ver fluxo
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 ml-1">
          <ShieldCheck size={9} className="text-emerald-500" />
          <p className="text-xs text-slate-400">Consultivo · Não constitui garantia financeira</p>
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
      <p className="text-xs text-slate-400 uppercase tracking-[0.08em] ml-1">Lendo dados do workspace...</p>
    </div>
  </div>
);

// ─── Welcome screen ───────────────────────────────────────────────────────────

const WelcomeScreen: React.FC<{
  onPrompt: (q: string) => void;
  prompts: { label: string; question: string; icon: React.ReactNode }[];
}> = ({ onPrompt, prompts }) => (
  <div className="flex flex-col items-center gap-6 py-6 px-2 animate-in fade-in duration-500">
    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/30">
      <BrainCircuit size={36} className="text-white" />
    </div>
    <div className="text-center">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{AI_CFO_COPY.welcomeTitle}</h3>
      <p className="text-xs font-semibold text-indigo-500 uppercase tracking-[0.08em] mt-1">{AI_CFO_COPY.welcomeSubtitle}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed max-w-xs">
        {AI_CFO_COPY.welcomeDescription}
      </p>
    </div>

    <div className="w-full flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em] text-center mb-1">Perguntas rápidas do caixa</p>
      {prompts.map(p => (
        <button
          key={p.question}
          onClick={() => onPrompt(p.question)}
          className="w-full flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all active:scale-[0.98] group text-left"
        >
          <span className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
            {p.icon}
          </span>
          <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{p.label}</span>
          <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
        </button>
      ))}
    </div>

    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl w-full">
      <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
      <p className="text-xs text-slate-400 leading-relaxed">
        Respostas consultivas com base nos seus dados reais. Nao substituem analise ou orientacao especializada.
      </p>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const AICFO: React.FC<AICFOProps> = ({
  transactions,
  accounts,
  userId = 'local',
  workspacePlan = 'free',
  hideValues,
  onNavigateToTab,
  onCreateReminder,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [learningDiagnostic, setLearningDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canUseRichAiContext = canAccessFeature(workspacePlan, 'aiRichConsultant');
  const scopedTransactions = useMemo(
    () => (canUseRichAiContext ? transactions : transactions.slice(0, 60)),
    [canUseRichAiContext, transactions],
  );
  const quickPrompts = useMemo(
    () => (canUseRichAiContext ? QUICK_PROMPTS : QUICK_PROMPTS.slice(0, 3)),
    [canUseRichAiContext],
  );

  // Pipeline de análise financeira (contexto para o CFO)
  const pipeline = useMemo(() => runAIPipelineSync(scopedTransactions, userId), [scopedTransactions, userId]);
  const intelligence = useMemo(
    () => buildProductFinancialIntelligence({ userId, accounts, transactions: scopedTransactions }),
    [accounts, scopedTransactions, userId]
  );
  const financialContext = useMemo(
    () => buildFinancialContext(
      accounts,
      scopedTransactions,
      pipeline.financial_state.cashflow_prediction,
      pipeline.insights,
      userId,
      intelligence,
    ),
    [accounts, scopedTransactions, pipeline, userId, intelligence]
  );

  const hasStrongGrounding = accounts.length > 0 && transactions.length >= 3;

  useEffect(() => {
    const storedMessages = loadCFOConversation(userId).map((message) => ({
      ...message,
      intent: message.intent as CFOIntent | undefined,
    }));
    setMessages(storedMessages);
  }, [userId]);

  useEffect(() => {
    saveCFOConversation(userId, messages);
  }, [messages, userId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMsg: Message = {
      id: makeId(),
      role: 'user',
      text: question.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setLearningDiagnostic(null);

    // Detectar intent
    const intent = analyzeFinancialQuestion(question);

    // Aprender padrões da conversa em background
    learnFromConversation(userId, question, intent).catch(e => {
      logWarn('[AICFO] Failed to learn from conversation', {
        error: e,
        fallback: 'aicfo-learn-from-conversation-failed',
      });
      setLearningDiagnostic(buildConversationLearningDiagnostic());
    });

    try {
      const response = await generateCFOResponse(question, financialContext, intent);
        const cfoMsg: Message = {
          id: makeId(),
          role: 'assistant',
          text: response.answer,
          intent,
          responseDepth: response.response_depth,
          timestamp: response.timestamp,
          diagnostic: response.diagnostic,
          explainability: response.explainability,
        };
      setMessages(prev => [...prev, cfoMsg]);
    } catch (error) {
      logWarn('[AICFO] Failed to generate CFO response', {
        error,
        fallback: 'aicfo-generate-response-failed',
      });
      setMessages(prev => [...prev, {
        id: makeId(),
        role: 'assistant',
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

  const clearChat = () => {
    setMessages([]);
    clearCFOConversation(userId);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-700">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-500 p-5 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0 relative overflow-hidden mb-4">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl font-semibold text-white tracking-tight leading-none">{AI_CFO_COPY.headerTitle}</h2>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-[0.08em] mt-1">{AI_CFO_COPY.headerSubtitle}</p>
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

      {learningDiagnostic && (
        <div role="status" className="mb-4 rounded-2xl border border-amber-100 bg-amber-50/80 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-600">{learningDiagnostic.title}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{learningDiagnostic.message}</p>
          <p className="mt-1 text-xs font-semibold text-amber-500">{learningDiagnostic.suggestion}</p>
        </div>
      )}

      {/* Snapshot financeiro rápido */}
      <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
        {[
          { label: 'Saldo', value: intelligence.context.cashflowForecast.currentBalance },
          { label: '7 dias', value: intelligence.context.cashflowForecast.in7Days },
          { label: '30 dias', value: intelligence.context.cashflowForecast.in30Days },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em]">{label}</p>
            <p className={`text-xs font-semibold mt-0.5 ${value >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
              {hideValues ? '••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
            </p>
          </div>
        ))}
      </div>

      {!canUseRichAiContext && (
        <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-600">Modo Free</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            O apoio financeiro IA segue disponivel no Free com contexto essencial. No Pro, as respostas ganham mais profundidade historica e leitura de cenarios.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4 shrink-0">
        <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-xs font-semibold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-300">
          Confiança {Math.round(intelligence.context.confidence.overall * 100)}%
        </span>
        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
          Recorrências {intelligence.recurringCount}
        </span>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.08em] ${hasStrongGrounding ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
          {hasStrongGrounding ? 'Base suficiente' : 'Base incompleta'}
        </span>
        {intelligence.dominantCategoryLabel && (
          <span className="px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 text-xs font-semibold uppercase tracking-[0.08em] text-violet-600 dark:text-violet-300">
            {intelligence.dominantCategoryLabel}
          </span>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-2 min-h-0">
        {messages.length === 0
          ? <WelcomeScreen onPrompt={sendMessage} prompts={quickPrompts} />
          : messages.map(msg =>
              msg.role === 'user'
                ? <UserBubble key={msg.id} msg={msg} />
                : <AssistantBubble key={msg.id} msg={msg} onCreateReminder={onCreateReminder} onNavigateToTab={onNavigateToTab} />
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
          className="flex-1 bg-transparent outline-none resize-none text-sm text-slate-800 dark:text-white placeholder:text-slate-400 placeholder:font-normal py-2 max-h-32"
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
          {quickPrompts.map(p => (
            <button
              key={p.question}
              onClick={() => sendMessage(p.question)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap hover:border-indigo-200 hover:text-indigo-600 transition-all shrink-0"
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






