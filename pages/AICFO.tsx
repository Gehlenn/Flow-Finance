import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ReminderType, type Reminder, Transaction } from '../types';
import { Account } from '../models/Account';
import { makeId } from '../src/utils/helpers';
import {
  CFOIntent,
  buildFinancialContext,
  analyzeFinancialQuestion,
  buildCFOExplainability,
  buildCFOResponseDepth,
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
import { trackProductEvent, trackProductEventOnce } from '../src/app/productAnalytics';
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
import { getDemoBootstrapIdentity, getDemoBootstrapPlan } from '../src/demo/demoBootstrap';

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
  spending_advice:  { label: 'Gasto', color: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300' },
  cash_position: { label: 'Caixa', color: 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300' },
  risk_question:    { label: 'Risco', color: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300' },
  receivables_question:{ label: 'Recebiveis', color: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300' },
  savings_question: { label: 'Economia', color: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300' },
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

function formatCurrency(value: number, hideValues: boolean): string {
  if (hideValues) {
    return '••••';
  }

  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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

function buildGenerationFailureMessage(intent: CFOIntent, hasStrongGrounding: boolean): Message {
  return {
    id: makeId(),
    role: 'assistant',
    intent,
    text: 'Nao consegui processar esta consulta agora. A IA ficou indisponivel nesta tentativa, entao nao vou inferir uma recomendacao.',
    timestamp: new Date().toISOString(),
    responseDepth: 'reduced',
    diagnostic: {
      kind: 'ai_unavailable',
      message: 'A geracao da resposta falhou antes de concluir a analise.',
      suggestion: 'Tente novamente e, se persistir, use o dashboard de caixa para decidir pelos valores confirmados.',
    },
    explainability: {
      reasons_used: [
        'Fallback operacional da IA',
        hasStrongGrounding ? 'Dados financeiros existem, mas a resposta nao foi gerada' : 'Base financeira limitada ou incompleta',
      ],
      evidence: {
        data_quality_note: 'Resposta consultiva nao foi produzida pelo modelo nesta tentativa.',
        base_sufficiency: hasStrongGrounding ? 'strong' : 'limited',
      },
      confidence_band: 'low',
    },
  };
}

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

function isOperationalActionIntent(intent?: CFOIntent): boolean {
  return intent === 'risk_question' || intent === 'cash_position';
}

function buildResponseActionCopy(intent?: CFOIntent): string {
  if (intent === 'risk_question') {
    return 'Crie um lembrete para revisar o risco e abra o fluxo para confirmar saidas, entradas e recebiveis antes de executar qualquer decisao.';
  }

  if (intent === 'cash_position') {
    return 'Crie um lembrete para revisar o caixa e abra o fluxo para confirmar saidas e recebiveis antes de executar qualquer decisao.';
  }

  return 'Crie um lembrete ou abra o fluxo quando precisar transformar a leitura em uma decisao operacional.';
}

function resolveAssistantExplainability(msg: Message, financialContext: string): AICFOExplainability {
  if (msg.explainability) {
    return msg.explainability;
  }

  return buildCFOExplainability(financialContext, msg.intent ?? 'monthly_summary');
}

function resolveAssistantResponseDepth(msg: Message, explainability: AICFOExplainability): 'standard' | 'reduced' {
  return msg.responseDepth ?? buildCFOResponseDepth(explainability);
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

const AssistantBubble: React.FC<{
  msg: Message;
  financialContext: string;
  plan: 'free' | 'pro';
  hasStrongGrounding: boolean;
  onCreateReminder?: (reminder: Partial<Reminder>) => void;
  onNavigateToTab?: (tab: Tab) => void;
}> = ({ msg, financialContext, plan, hasStrongGrounding, onCreateReminder, onNavigateToTab }) => {
  const intent = msg.intent ?? 'monthly_summary';
  const intentStyle = msg.intent ? INTENT_LABEL[msg.intent] : null;
  const resolvedExplainability = resolveAssistantExplainability(msg, financialContext);
  const responseDepth = resolveAssistantResponseDepth(msg, resolvedExplainability);
  const actionRequired = isOperationalActionIntent(msg.intent);
  const actionCopy = buildResponseActionCopy(msg.intent);
  const isFallbackExplainability = !msg.explainability;
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
              <p className="text-xs font-semibold uppercase tracking-[0.08em]">Diagnostico da IA</p>
              <p className="mt-1 text-xs leading-relaxed">{msg.diagnostic.message}</p>
              {msg.diagnostic.suggestion && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] opacity-90">
                  Proximo passo: {msg.diagnostic.suggestion}
                </p>
              )}
            </div>
          )}
          <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">Base da resposta</p>
            {isFallbackExplainability && (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Base reconstruida do contexto atual porque a resposta nao trouxe explicabilidade.
              </p>
            )}
            <ul className="mt-1 space-y-1">
              {resolvedExplainability.reasons_used.map(reason => (
                <li key={reason} className="text-xs text-slate-600 dark:text-slate-300">• {reason}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Sinais usados</p>
            <div className="mt-1 grid gap-1">
              {Object.entries(resolvedExplainability.evidence)
                .filter(([, value]) => Boolean(value))
                .map(([key, value]) => (
                  <p key={key} className="text-xs text-slate-600 dark:text-slate-300">
                    {key.replace(/_/g, ' ')}: {String(value)}
                  </p>
                ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nivel de confianca desta resposta: {CONFIDENCE_BAND_LABEL[resolvedExplainability.confidence_band]}
            </p>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">{msg.text}</p>
          {responseDepth && (
            <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.08em] ${
              responseDepth === 'reduced'
                ? 'text-amber-600 dark:text-amber-300'
                : 'text-emerald-600 dark:text-emerald-300'
            }`}>
              {RESPONSE_DEPTH_LABEL[responseDepth]}
            </p>
          )}
          {actionRequired && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="text-xs font-semibold uppercase tracking-[0.08em]">Proxima acao obrigatoria</p>
              <p className="mt-1 text-xs leading-relaxed">{actionCopy}</p>
            </div>
          )}
          {msg.role === 'assistant' && (onCreateReminder || onNavigateToTab) && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">Acoes da resposta</p>
              <div className="mt-3 flex flex-wrap gap-2">
              {onCreateReminder && (
                <button
                  type="button"
                  onClick={() => {
                    trackProductEvent('ai_response_action_created', {
                      source: 'aicfo',
                      intent,
                      plan,
                      target: 'reminder',
                      action_required: actionRequired,
                      base_sufficiency: resolvedExplainability.evidence.base_sufficiency,
                      confidence_band: resolvedExplainability.confidence_band,
                      response_depth: responseDepth,
                      grounded: hasStrongGrounding,
                    });
                    onCreateReminder(buildResponseReminder(msg));
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Sparkles size={14} />
                  Criar lembrete
                </button>
              )}
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => {
                    trackProductEvent('ai_response_flow_opened', {
                      source: 'aicfo',
                      intent,
                      plan,
                      target: 'flow',
                      action_required: actionRequired,
                      base_sufficiency: resolvedExplainability.evidence.base_sufficiency,
                      confidence_band: resolvedExplainability.confidence_band,
                      response_depth: responseDepth,
                      grounded: hasStrongGrounding,
                    });
                    onNavigateToTab('flow');
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  <Wallet size={14} />
                  Ver fluxo
                </button>
              )}
              </div>
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

const SnapshotMetric: React.FC<{
  label: string;
  value: number;
  hideValues: boolean;
}> = ({ label, value, hideValues }) => (
  <div className={`${SOFT_SURFACE} p-3 sm:p-4`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
    <p className={`mt-1 text-sm font-semibold sm:text-base ${value >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
      {formatCurrency(value, hideValues)}
    </p>
  </div>
);

const OperationalSnapshot: React.FC<{
  currentBalance: number;
  in7Days: number;
  in30Days: number;
  hideValues: boolean;
  confidencePercent: number;
  recurringCount: number;
  productSignals: string[];
  hasStrongGrounding: boolean;
  dominantCategoryLabel: string | null;
  isFreePlan: boolean;
  monthlyAiQueriesUsed: number;
  queryLimit: number;
  paywallVisible: boolean;
}> = ({
  currentBalance,
  in7Days,
  in30Days,
  hideValues,
  confidencePercent,
  recurringCount,
  productSignals,
  hasStrongGrounding,
  dominantCategoryLabel,
  isFreePlan,
  monthlyAiQueriesUsed,
  queryLimit,
  paywallVisible,
}) => {
  const focusItems = [
    currentBalance >= 0
      ? 'Caixa atual sem ruptura aparente no curtissimo prazo.'
      : 'Caixa atual pede revisao imediata de saidas e cobrancas.',
    in7Days >= currentBalance
      ? 'Janela de 7 dias sustenta ou melhora a posicao atual.'
      : 'Janela de 7 dias projeta compressao de caixa.',
    productSignals?.[0] || 'Base ainda curta para leituras mais profundas; use perguntas objetivas.',
  ];

  return (
    <div className="grid gap-2 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)] xl:gap-3">
      <section className={`${PANEL_SURFACE} p-3 sm:p-4`}>
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Leitura operacional agora</p>
            <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">Caixa, horizonte curto e base da resposta</h3>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              O Consultor IA deve partir do dinheiro confirmado, do risco proximo e do que ainda depende de confirmacao.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SnapshotMetric label="Saldo" value={currentBalance} hideValues={hideValues} />
            <SnapshotMetric label="7 dias" value={in7Days} hideValues={hideValues} />
            <SnapshotMetric label="30 dias" value={in30Days} hideValues={hideValues} />
          </div>

          <div className="grid gap-2 lg:grid-cols-3">
            {focusItems.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className={`${PANEL_SURFACE} p-3 sm:p-4`}>
        <div className="flex h-full flex-col gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Base usada agora</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Estado da leitura consultiva</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
              Confiança {confidencePercent}%
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">
              Recorrências {recurringCount}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${hasStrongGrounding ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'}`}>
              {hasStrongGrounding ? 'Base suficiente' : 'Base incompleta'}
            </span>
            {dominantCategoryLabel && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                {dominantCategoryLabel}
              </span>
            )}
            {isFreePlan && (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                paywallVisible
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                Consultas Free {Math.min(monthlyAiQueriesUsed, queryLimit)}/{queryLimit}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Postura do consultor</p>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <li>• Caixa confirmado primeiro.</li>
              <li>• Recebivel e previsao nao viram saldo realizado.</li>
              <li>• Quando a base estiver fraca, a resposta precisa mostrar esse limite.</li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
};

// ─── Welcome screen ───────────────────────────────────────────────────────────

const WelcomeScreen: React.FC<{
  onPrompt: (q: string) => void;
  prompts: { label: string; question: string; icon: React.ReactNode }[];
}> = ({ onPrompt, prompts }) => (
  <div className="grid gap-3 py-1 animate-in fade-in duration-500 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)]">
    <section className={`${SOFT_SURFACE} p-4 sm:p-5`}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <BrainCircuit size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{AI_CFO_COPY.welcomeTitle}</h3>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{AI_CFO_COPY.welcomeSubtitle}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {AI_CFO_COPY.welcomeDescription}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          'Pergunte sobre uma decisao curta: pagar, cobrar, segurar ou priorizar.',
          'Leia a resposta junto com a base usada e o nivel de confianca.',
          'Transforme a resposta em proximo passo: lembrete ou revisao do fluxo.',
        ].map((item) => (
          <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Respostas consultivas com base nos seus dados reais. Nao substituem analise ou orientacao especializada.
        </p>
      </div>
    </section>

    <section className={`${SOFT_SURFACE} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Perguntas rápidas do caixa</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Comece por uma decisao concreta</h3>
        </div>
        <Sparkles size={16} className="text-slate-400" />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {prompts.map(p => (
          <button
            key={p.question}
            onClick={() => onPrompt(p.question)}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900/50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 dark:bg-slate-900/50">
              {p.icon}
            </span>
            <span className="flex-1 text-sm leading-snug text-slate-700 dark:text-slate-200">{p.label}</span>
            <ChevronRight size={14} className="text-slate-300 transition-colors group-hover:text-slate-500" />
          </button>
        ))}
      </div>
    </section>
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
  const demoWorkspacePlan = useMemo(() => getDemoBootstrapPlan(), []);
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
  const confidencePercent = Math.round(intelligence.context.confidence.overall * 100);

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
    if (messages.length === 0 && !isLoading) {
      return;
    }

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
    const questionExplainability = buildCFOExplainability(financialContext, intent);
    const questionResponseDepth = buildCFOResponseDepth(questionExplainability);

    trackProductEvent('ai_question_submitted', {
      source: 'aicfo',
      intent,
      plan: effectiveWorkspacePlan,
      action_required: isOperationalActionIntent(intent),
      base_sufficiency: questionExplainability.evidence.base_sufficiency,
      confidence_band: questionExplainability.confidence_band,
      response_depth: questionResponseDepth,
      grounded: hasStrongGrounding,
    });

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
      const resolvedExplainability = response.explainability ?? questionExplainability;
      const resolvedResponseDepth = response.response_depth ?? buildCFOResponseDepth(resolvedExplainability);
      if (!response.diagnostic && response.answer.trim()) {
        trackProductEventOnce('ai_consultation_completed', workspaceId || userId, {
          source: 'aicfo',
          intent,
          plan: effectiveWorkspacePlan,
          confidence_band: resolvedExplainability.confidence_band,
          response_depth: resolvedResponseDepth,
          base_sufficiency: resolvedExplainability.evidence.base_sufficiency,
          action_required: isOperationalActionIntent(intent),
          grounded: hasStrongGrounding,
        });
      } else if (response.diagnostic) {
        trackProductEvent('ai_fallback_observed', {
          source: 'aicfo',
          intent,
          plan: effectiveWorkspacePlan,
          fallback_kind: response.diagnostic.kind,
          response_depth: response.response_depth ?? 'unknown',
          grounded: hasStrongGrounding,
        });
      }
      const cfoMsg: Message = {
        id: makeId(),
        role: 'assistant',
        text: response.answer,
        intent,
        responseDepth: resolvedResponseDepth,
        timestamp: response.timestamp,
        diagnostic: response.diagnostic,
        explainability: response.explainability ?? resolvedExplainability,
      };
      setMessages(prev => [...prev, cfoMsg]);
    } catch (error) {
      logWarn('[AICFO] Failed to generate CFO response', {
        error,
        fallback: 'aicfo-generate-response-failed',
      });
      trackProductEvent('ai_fallback_observed', {
        source: 'aicfo',
        intent,
        plan: effectiveWorkspacePlan,
        fallback_kind: 'ai_unavailable',
        response_depth: 'reduced',
        grounded: hasStrongGrounding,
      });
      setMessages(prev => [...prev, buildGenerationFailureMessage(intent, hasStrongGrounding)]);
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
    <div className="flex min-h-[calc(100dvh-9.5rem)] flex-col animate-in fade-in duration-700 md:min-h-[34rem]">

      <div className={`mb-2 flex items-center justify-between gap-3 ${PANEL_SURFACE} px-3 py-2.5 sm:px-5 sm:py-4`}>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">{AI_CFO_COPY.headerTitle}</h2>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{AI_CFO_COPY.headerSubtitle}</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-600">{learningDiagnostic.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{learningDiagnostic.message}</p>
          <p className="mt-1 text-xs font-semibold text-amber-500">{learningDiagnostic.suggestion}</p>
        </div>
      )}

      {/* Snapshot financeiro rápido */}
      <OperationalSnapshot
        currentBalance={intelligence.context.cashflowForecast.currentBalance}
        in7Days={intelligence.context.cashflowForecast.in7Days}
        in30Days={intelligence.context.cashflowForecast.in30Days}
        hideValues={hideValues}
        confidencePercent={confidencePercent}
        recurringCount={intelligence.recurringCount}
        productSignals={intelligence.productSignals}
        hasStrongGrounding={hasStrongGrounding}
        dominantCategoryLabel={intelligence.dominantCategoryLabel}
        isFreePlan={isFreePlan}
        monthlyAiQueriesUsed={monthlyAiQueriesUsed}
        queryLimit={queryLimit}
        paywallVisible={paywallVisible}
      />

      {isFreePlan && (
        <div className="mb-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/60 sm:mb-3 sm:p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">Modo Free</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            O Consultor IA segue liberado no Free com as mesmas respostas consultivas, mas para em {queryLimit} consultas por mes. No Pro, o uso fica ilimitado por {proMonthlyPriceLabel}.
          </p>
        </div>
      )}

      {usageDiagnostic && (
        <div role="status" className="mb-2 rounded-2xl border border-amber-100 bg-amber-50/80 p-2.5 dark:border-amber-500/20 dark:bg-amber-500/10 sm:mb-3 sm:p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-600">{usageDiagnostic.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{usageDiagnostic.message}</p>
          <p className="mt-1 text-xs font-semibold text-amber-500">{usageDiagnostic.suggestion}</p>
        </div>
      )}

      {/* Messages area */}
      <div className={`${PANEL_SURFACE} order-2 flex min-h-0 flex-1 flex-col overflow-hidden md:order-none`}>
        {paywallVisible && (
          <div className="border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4">
            <UpgradePromptCard
              title="Consultor IA ilimitado"
              description="Voce chegou ao limite mensal do Free. O Pro libera consultas sem travar, mais workspaces e mais contexto historico."
              bullets={[
                'consultor IA sem bloqueio mensal',
                'multiplos workspaces para operacoes separadas',
                'analises historicas para comparar caixa e risco',
              ]}
              workspaceId={workspaceId}
              showUpgradeAction
              ctaLabel="Assinar Pro agora"
            />
          </div>
        )}

        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Workspace consultivo</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {messages.length === 0 ? 'Escolha uma pergunta operacional para abrir a leitura.' : 'Pergunta, base, resposta e proximo passo.'}
          </h3>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
          {messages.length === 0
            ? <WelcomeScreen onPrompt={sendMessage} prompts={quickPrompts} />
            : messages.map(msg =>
                msg.role === 'user'
                  ? <UserBubble key={msg.id} msg={msg} />
                  : <AssistantBubble
                      key={msg.id}
                      msg={msg}
                      financialContext={financialContext}
                      plan={effectiveWorkspacePlan}
                      hasStrongGrounding={hasStrongGrounding}
                      onCreateReminder={onCreateReminder}
                      onNavigateToTab={onNavigateToTab}
                    />
              )
          }
          {isLoading && <TypingBubble />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className={`order-3 shrink-0 mt-2 flex items-end gap-2.5 ${PANEL_SURFACE} p-2.5 pl-4 sm:mt-3 sm:gap-3 sm:p-3 sm:pl-5 md:order-none`}>
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Pergunta operacional</p>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={paywallVisible ? 'Limite mensal do Free atingido. Assine o Pro para continuar.' : AI_CFO_COPY.inputPlaceholder}
            rows={1}
            disabled={paywallVisible}
            className="mt-1 flex-1 max-h-28 w-full resize-none bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-normal dark:text-white sm:max-h-32 sm:py-2"
            style={{ scrollbarWidth: 'none' }}
          />
        </div>
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
