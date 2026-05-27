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
import { buildCashflowPrediction } from '../src/ai/riskAnalyzer';
import { computeFinancialSignals, signalsToInsights } from '../src/ai/signalEngine';
import {
  Send, Loader2, BrainCircuit, Sparkles,
  User, Trash2, ChevronRight, ShieldCheck,
  TrendingUp, Wallet, AlertTriangle, PiggyBank, HelpCircle
} from 'lucide-react';
import { buildProductFinancialIntelligence } from '../src/app/productFinancialIntelligence';
import { AI_CFO_COPY } from '../src/app/assistantCopy';
import {
  FREE_LIMITS,
  MONETIZATION_PRICING,
  withinFreeLimit,
} from '../src/app/monetizationPlan';
import type { Tab } from '../hooks/navigationTypes';
import { clearCFOConversation, loadCFOConversation, saveCFOConversation, type CFOConversationMessage } from '../src/ai/cfoConversationStore';
import UpgradePromptCard from '../components/UpgradePromptCard';
import { getWorkspaceBillingOverview, incrementWorkspaceUsage } from '../src/services/firestoreBillingStore';
import { ensureActiveWorkspace, getCurrentWorkspaceIdentity } from '../src/services/workspaceSession';
import { getDemoBootstrapIdentity } from '../src/demo/demoBootstrap';

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
  cash_position: { label: 'Caixa', color: 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300' },
  risk_question:    { label: 'Risco', color: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600' },
  receivables_question:{ label: 'Recebiveis', color: 'bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600' },
  savings_question: { label: 'Economia', color: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600' },
  monthly_summary:  { label: 'Resumo', color: 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300' },
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
const PANEL_SURFACE = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const SOFT_SURFACE = 'rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

function getDemoWorkspacePlanOverride(): 'free' | 'pro' | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const isDemoMode = params.get('demoData') === '1' || window.localStorage.getItem('flow_demo_data') === '1';
  if (!isDemoMode) {
    return null;
  }

  const rawPlan = (params.get('demoPlan') || window.localStorage.getItem('flow_demo_plan') || 'pro').toLowerCase();
  return rawPlan === 'free' ? 'free' : 'pro';
}

// ─── Message bubble ───────────────────────────────────────────────────────────

type Message = Omit<CFOConversationMessage, 'intent'> & {
  intent?: CFOIntent;
};

function isSameMonth(reference: Date, candidateIso: string): boolean {
  const candidate = new Date(candidateIso);

  return candidate.getFullYear() === reference.getFullYear()
    && candidate.getMonth() === reference.getMonth();
}

function countMonthlyUserQueries(messages: Message[], reference = new Date()): number {
  return messages.filter((message) => message.role === 'user' && isSameMonth(reference, message.timestamp)).length;
}

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
      <div className="bg-slate-900 text-white px-5 py-3.5 rounded-3xl rounded-tr-lg shadow-md dark:bg-slate-100 dark:text-slate-900">
        <p className="text-sm leading-relaxed text-slate-100">{msg.text}</p>
      </div>
      <p className="text-xs text-slate-400 mt-1 text-right">
        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 mt-1">
      <User size={15} className="text-slate-600 dark:text-slate-300" />
    </div>
  </div>
);

const AssistantBubble: React.FC<{ msg: Message; onCreateReminder?: (reminder: Partial<Reminder>) => void; onNavigateToTab?: (tab: Tab) => void; }> = ({ msg, onCreateReminder, onNavigateToTab }) => {
  const intentStyle = msg.intent ? INTENT_LABEL[msg.intent] : null;
  return (
    <div className="flex gap-3 animate-in slide-in-from-left-4 duration-300">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <BrainCircuit size={15} />
      </div>
      <div className="max-w-[85%]">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-5 py-4 rounded-3xl rounded-tl-lg shadow-sm">
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
            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">Base da resposta</p>
              <ul className="mt-1 space-y-1">
                {msg.explainability.reasons_used.map(reason => (
                  <li key={reason} className="text-xs text-slate-600 dark:text-slate-300">• {reason}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Sinais usados</p>
              <div className="mt-1 grid gap-1">
                {Object.entries(msg.explainability.evidence)
                  .filter(([, value]) => Boolean(value))
                  .map(([key, value]) => (
                    <p key={key} className="text-xs text-slate-600 dark:text-slate-300">
                      {key.replace(/_/g, ' ')}: {String(value)}
                    </p>
                  ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
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
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
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
    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <BrainCircuit size={15} />
    </div>
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-5 py-4 rounded-3xl rounded-tl-lg shadow-sm flex items-center gap-2">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
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
    <div className="flex flex-col items-center gap-5 py-5 px-2 animate-in fade-in duration-500">
    <div className="w-20 h-20 rounded-3xl flex items-center justify-center border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <BrainCircuit size={36} />
    </div>
    <div className="text-center">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{AI_CFO_COPY.welcomeTitle}</h3>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.08em] mt-1">{AI_CFO_COPY.welcomeSubtitle}</p>
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
          className="w-full flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-slate-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-[0.98] group text-left"
        >
          <span className="w-8 h-8 bg-slate-50 dark:bg-slate-900/50 text-slate-500 rounded-xl flex items-center justify-center shrink-0">
            {p.icon}
          </span>
          <span className="flex-1 text-sm leading-snug text-slate-700 dark:text-slate-200">{p.label}</span>
          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
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
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [monthlyAiQueriesUsed, setMonthlyAiQueriesUsed] = useState(0);
  const [usageDiagnostic, setUsageDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scopedTransactions = useMemo(() => transactions, [transactions]);
  const quickPrompts = useMemo(() => QUICK_PROMPTS, []);
  const demoWorkspacePlan = useMemo(() => getDemoWorkspacePlanOverride(), []);
  const effectiveWorkspacePlan = demoWorkspacePlan ?? workspacePlan;
  const isFreePlan = effectiveWorkspacePlan !== 'pro';
  const queryLimit = FREE_LIMITS.consultorIaQueriesPerMonth;
  const proMonthlyPriceLabel = useMemo(
    () => `R$ ${MONETIZATION_PRICING.proMonthlyBRL.toFixed(2).replace('.', ',')}/mes`,
    [],
  );

  const cashflowPrediction = useMemo(
    () => buildCashflowPrediction(scopedTransactions),
    [scopedTransactions],
  );
  const financialInsights = useMemo(() => {
    const signals = computeFinancialSignals({
      accounts,
      transactions: scopedTransactions,
      prediction: cashflowPrediction,
      userId,
    });
    return signalsToInsights(signals, userId);
  }, [accounts, cashflowPrediction, scopedTransactions, userId]);
  const intelligence = useMemo(
    () => buildProductFinancialIntelligence({ userId, accounts, transactions: scopedTransactions }),
    [accounts, scopedTransactions, userId]
  );
  const financialContext = useMemo(
    () => buildFinancialContext(
      accounts,
      scopedTransactions,
      cashflowPrediction,
      financialInsights,
      userId,
      intelligence,
    ),
    [accounts, scopedTransactions, cashflowPrediction, financialInsights, userId, intelligence]
  );

  const hasStrongGrounding = accounts.length > 0 && transactions.length >= 3;

  useEffect(() => {
    const storedMessages = loadCFOConversation(userId).map((message) => ({
      ...message,
      intent: message.intent as CFOIntent | undefined,
    }));
    setMessages(storedMessages);
    setMonthlyAiQueriesUsed(countMonthlyUserQueries(storedMessages));
  }, [userId]);

  useEffect(() => {
    saveCFOConversation(userId, messages);
  }, [messages, userId]);

  useEffect(() => {
    if (!isFreePlan) {
      setPaywallVisible(false);
      return;
    }

    setPaywallVisible(!withinFreeLimit(effectiveWorkspacePlan, 'consultorIaQueriesPerMonth', monthlyAiQueriesUsed));
  }, [effectiveWorkspacePlan, isFreePlan, monthlyAiQueriesUsed]);

  useEffect(() => {
    let cancelled = false;
    const demoIdentity = getDemoBootstrapIdentity();

    const loadUsage = async () => {
      if (demoIdentity?.userId) {
        try {
          const workspace = await ensureActiveWorkspace(demoIdentity);
          if (cancelled) {
            return;
          }

          setWorkspaceId(workspace.workspaceId);
          setUsageDiagnostic(null);
          return;
        } catch (error) {
          if (cancelled) {
            return;
          }

          logWarn('[AICFO] Failed to resolve demo workspace usage context', {
            error,
            userId,
            fallback: 'aicfo-demo-usage-context-failed',
          });
          setUsageDiagnostic({
            title: 'Uso do plano indisponivel',
            message: 'Nao foi possivel preparar o contexto local do Consultor IA agora.',
            suggestion: 'Recarregue a pagina ou saia do modo demo para usar a leitura do workspace real.',
          });
          return;
        }
      }

      try {
        const workspace = await ensureActiveWorkspace(getCurrentWorkspaceIdentity());
        const overview = await getWorkspaceBillingOverview({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
        });

        if (cancelled) {
          return;
        }

        setWorkspaceId(workspace.workspaceId);
        setMonthlyAiQueriesUsed((currentUsage) => Math.max(currentUsage, overview.currentMonthUsage.aiQueries));
        setUsageDiagnostic(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        logWarn('[AICFO] Failed to load workspace AI usage', {
          error,
          userId,
          fallback: 'aicfo-usage-load-failed',
        });
        setUsageDiagnostic({
          title: 'Uso do plano indisponivel',
          message: 'Nao foi possivel sincronizar o contador mensal do Consultor IA agora.',
          suggestion: 'O Flow vai usar a contagem local desta conversa ate a leitura do workspace voltar.',
        });
      }
    };

    void loadUsage();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const incrementAiQueryUsage = React.useCallback(async () => {
    setMonthlyAiQueriesUsed((currentUsage) => currentUsage + 1);

    if (!workspaceId) {
      return;
    }

    try {
      await incrementWorkspaceUsage({
        workspaceId,
        resource: 'aiQueries',
        amount: 1,
      });
    } catch (error) {
      logWarn('[AICFO] Failed to persist workspace AI usage', {
        error,
        workspaceId,
        fallback: 'aicfo-usage-persist-failed',
      });
    }
  }, [workspaceId]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;
    if (!withinFreeLimit(effectiveWorkspacePlan, 'consultorIaQueriesPerMonth', monthlyAiQueriesUsed)) {
      setPaywallVisible(true);
      setInput('');
      return;
    }

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
    setPaywallVisible(false);
    void incrementAiQueryUsage();

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
    <div className="flex min-h-[calc(100dvh-9.5rem)] flex-col animate-in fade-in duration-700 md:h-[calc(100vh-8rem)]">

      <div className={`mb-2 flex items-center justify-between gap-3 ${PANEL_SURFACE} px-3 py-2.5 sm:px-5 sm:py-4`}>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">{AI_CFO_COPY.headerTitle}</h2>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 sm:text-xs">{AI_CFO_COPY.headerSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-rose-200 hover:text-rose-500 dark:border-slate-700 dark:hover:border-rose-500/30"
              title="Limpar conversa"
            >
              <Trash2 size={15} />
            </button>
          )}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <BrainCircuit size={18} />
          </div>
        </div>
      </div>

      {learningDiagnostic && (
        <div role="status" className="mb-2 rounded-2xl border border-amber-100 bg-amber-50/80 p-2.5 dark:border-amber-500/20 dark:bg-amber-500/10 sm:p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-600">{learningDiagnostic.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{learningDiagnostic.message}</p>
          <p className="mt-1 text-[11px] font-semibold text-amber-500">{learningDiagnostic.suggestion}</p>
        </div>
      )}

      {/* Snapshot financeiro rápido */}
      <div className="grid grid-cols-2 gap-1.5 mb-2 shrink-0 sm:grid-cols-3 sm:gap-2 sm:mb-3">
        {[
          { label: 'Saldo', value: intelligence.context.cashflowForecast.currentBalance },
          { label: '7 dias', value: intelligence.context.cashflowForecast.in7Days },
          { label: '30 dias', value: intelligence.context.cashflowForecast.in30Days },
        ].map(({ label, value }) => (
          <div key={label} className={SOFT_SURFACE + ' p-2.5 text-center sm:p-3'}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em]">{label}</p>
            <p className={`text-[11px] font-semibold mt-0.5 ${value >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
              {hideValues ? '••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
            </p>
          </div>
        ))}
      </div>

      {isFreePlan && (
        <div className="mb-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/60 sm:mb-3 sm:p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">Modo Free</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            O Consultor IA segue liberado no Free com as mesmas respostas consultivas, mas para em {queryLimit} consultas por mes. No Pro, o uso fica ilimitado por {proMonthlyPriceLabel}.
          </p>
        </div>
      )}

      {usageDiagnostic && (
        <div role="status" className="mb-2 rounded-2xl border border-amber-100 bg-amber-50/80 p-2.5 dark:border-amber-500/20 dark:bg-amber-500/10 sm:mb-3 sm:p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-600">{usageDiagnostic.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{usageDiagnostic.message}</p>
          <p className="mt-1 text-[11px] font-semibold text-amber-500">{usageDiagnostic.suggestion}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-2 shrink-0 pb-1 sm:mb-3 sm:flex-nowrap sm:overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <span className="shrink-0 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          Confiança {Math.round(intelligence.context.confidence.overall * 100)}%
        </span>
        <span className="shrink-0 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-100 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">
          Recorrências {intelligence.recurringCount}
        </span>
        {isFreePlan && (
        <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold sm:px-2.5 sm:text-[11px] ${
            paywallVisible
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            Consultas Free {Math.min(monthlyAiQueriesUsed, queryLimit)}/{queryLimit}
        </span>
        )}
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.08em] border ${hasStrongGrounding ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'}`}>
          {hasStrongGrounding ? 'Base suficiente' : 'Base incompleta'}
        </span>
        {intelligence.dominantCategoryLabel && (
          <span className="shrink-0 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            {intelligence.dominantCategoryLabel}
          </span>
        )}
      </div>

      {/* Messages area */}
      <div className="order-2 flex-1 overflow-y-auto flex flex-col gap-4 pb-4 min-h-0 md:order-none">
        {paywallVisible && (
          <UpgradePromptCard
            title="Consultor IA ilimitado"
            description="Voce chegou ao limite mensal do Free. O Pro libera consultas sem travar, mais workspaces e exportacao de relatorios."
            bullets={[
              'consultor IA sem bloqueio mensal',
              'multiplos workspaces para operacoes separadas',
              'exportacao de relatorios para repasse e auditoria',
            ]}
            workspaceId={workspaceId}
            showUpgradeAction
            ctaLabel="Assinar Pro agora"
          />
        )}
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
      <div className={`order-1 shrink-0 mt-2 flex items-end gap-2.5 ${PANEL_SURFACE} p-2.5 pl-4 sm:mt-3 sm:gap-3 sm:p-3 sm:pl-5 md:order-none`}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={paywallVisible ? 'Limite mensal do Free atingido. Assine o Pro para continuar.' : AI_CFO_COPY.inputPlaceholder}
          rows={1}
          disabled={paywallVisible}
          className="flex-1 max-h-28 resize-none bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-normal dark:text-white sm:max-h-32 sm:py-2"
          style={{ scrollbarWidth: 'none' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading || paywallVisible}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md transition-all active:scale-90 disabled:scale-100 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none dark:bg-slate-100 dark:text-slate-900 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 sm:h-11 sm:w-11"
        >
          {isLoading
            ? <Loader2 size={16} className="animate-spin sm:size-[18px]" />
            : <Send size={16} className="sm:size-[18px]" />
          }
        </button>
      </div>

      {messages.length > 0 && !isLoading && (
        <div className="order-3 shrink-0 mt-2 flex gap-2 overflow-x-auto pb-1 md:order-none" style={{ scrollbarWidth: 'none' }}>
          {quickPrompts.map(p => (
            <button
              key={p.question}
              onClick={() => sendMessage(p.question)}
              disabled={paywallVisible}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
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






