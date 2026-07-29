import React, { useMemo, useState } from 'react';
import { Category, Goal } from '../types';
import { formatCurrency } from '../utils/helpers';
import { SECONDARY_FLOWS_COPY } from '../src/app/secondaryFlowsCopy';
import { VISUAL_MOTION, VISUAL_SURFACES } from '../src/app/visualSystem';
import { logWarn } from '../src/utils/logger';
import {
  CalendarDays,
  Check,
  Plus,
  PlusCircle,
  Target,
  Trash2,
  Trophy,
  TrendingUp,
  X,
} from 'lucide-react';

interface GoalsPageProps {
  hideValues?: boolean;
  goals: Goal[];
  canEditGoals?: boolean;
  onCreateGoal: (goal: Omit<Goal, 'id'>) => void;
  onDeleteGoal: (goalId: string) => void;
  onContributeGoal: (goalId: string, amount: number) => void;
}

interface GoalFormData {
  title: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string;
  category: Category;
}

const DEFAULT_FORM: GoalFormData = {
  title: '',
  targetAmount: '',
  currentAmount: '0',
  deadline: '',
  category: Category.INVESTIMENTO,
};

function buildGoalsDiagnostic(kind: 'target' | 'contribute'): { title: string; message: string; suggestion: string } {
  if (kind === 'target') {
    return {
      title: 'Valor alvo invalido',
      message: 'O valor da meta precisa ser numerico e maior que zero.',
      suggestion: 'Digite um valor como 1000, 2500,50 ou 10.000,00.',
    };
  }

  return {
    title: 'Aporte invalido',
    message: 'O valor do aporte precisa ser numerico e maior que zero.',
    suggestion: 'Digite um valor valido como 50, 150,75 ou 1.000,00.',
  };
}

const GOAL_PRESETS: Array<{ title: string; category: Category }> = [
  { title: 'Reserva de caixa operacional', category: Category.INVESTIMENTO },
  { title: 'Provisão de impostos', category: Category.INVESTIMENTO },
  { title: 'Reserva para folha', category: Category.CONSULTORIO },
  { title: 'Colchão para sazonalidade', category: Category.PESSOAL },
];

const INPUT_SURFACE =
  'w-full mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:border-emerald-400 dark:focus:bg-slate-900';

function getGoalProgress(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
}

function getDaysRemaining(deadline?: string): number | null {
  if (!deadline) return null;

  const today = new Date();
  const target = new Date(deadline);
  const diff = target.getTime() - today.getTime();
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
}

const ProgressRing: React.FC<{ pct: number; size?: number }> = ({ pct, size = 56 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        className="text-slate-100 dark:text-slate-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#10b981"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="flow-progress-ring-value"
      />
    </svg>
  );
};

const GoalCard: React.FC<{
  goal: Goal;
  hideValues: boolean;
  onDeleteGoal: (goalId: string) => void;
  onOpenContribution: (goal: Goal) => void;
}> = ({ goal, hideValues, onDeleteGoal, onOpenContribution }) => {
  const progress = getGoalProgress(goal);
  const daysRemaining = getDaysRemaining(goal.deadline);

  return (
    <div className={`${VISUAL_SURFACES.section} overflow-hidden`}>
      <div className="p-5 flex items-start gap-4">
        <div className="relative shrink-0">
          <ProgressRing pct={progress} />
          <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
            <Target size={18} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white text-sm leading-tight truncate">
                {goal.title}
              </p>
              <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-[0.08em] mt-1">
                {goal.category}
              </p>
            </div>
            <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-emerald-600 shrink-0">
              {progress >= 100 ? 'concluida' : `${Math.round(progress)}%`}
            </span>
          </div>

          <div className="flex items-baseline gap-1 mt-2">
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {hideValues ? '••••' : formatCurrency(goal.currentAmount)}
            </p>
            <p className="text-[9px] text-slate-400 font-medium">
              / {hideValues ? '••••' : formatCurrency(goal.targetAmount)}
            </p>
          </div>

          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
            <progress
              className="flow-progress flow-progress-emerald"
              value={progress}
              max={100}
              aria-label={`Progresso da meta ${goal.title}`}
            />
          </div>

          <div className="flex items-center gap-3 mt-2">
            {goal.deadline && (
                  <span className="flex items-center gap-1 text-[8px] text-slate-400 font-medium">
                <CalendarDays size={8} />
                {(() => {
                  const dateOnlyMatch = goal.deadline?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                  if (dateOnlyMatch) {
                    const [, y, m, d] = dateOnlyMatch;
                    const dt = new Date(Number(y), Number(m) - 1, Number(d));
                    if (isNaN(dt.getTime())) return null;
                    return dt.toLocaleDateString('pt-BR');
                  }
                  const dt = new Date(goal.deadline!);
                  if (isNaN(dt.getTime())) return null;
                  return dt.toLocaleDateString('pt-BR');
                })()}
              </span>
            )}
            {daysRemaining !== null && daysRemaining > 0 && (
              <span className="flex items-center gap-1 text-[8px] text-slate-400 font-medium">
                <TrendingUp size={8} />
                {daysRemaining}d restantes
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => onOpenContribution(goal)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[9px] font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
        >
          <PlusCircle size={13} /> Aportar
        </button>
        <div className="w-px bg-slate-100 dark:bg-slate-700" />
        <button
          onClick={() => onDeleteGoal(goal.id)}
          className="flex items-center justify-center gap-1.5 px-5 py-3 text-[9px] font-semibold text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

const GoalsPage: React.FC<GoalsPageProps> = ({
  hideValues = false,
  goals,
  canEditGoals = true,
  onCreateGoal,
  onDeleteGoal,
  onContributeGoal,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<GoalFormData>(DEFAULT_FORM);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [targetAmountError, setTargetAmountError] = useState<string | null>(null);
  const [targetAmountDiagnostic, setTargetAmountDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [contributeDiagnostic, setContributeDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);

  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => getGoalProgress(b) - getGoalProgress(a)),
    [goals]
  );
  const completedGoals = sortedGoals.filter((goal) => getGoalProgress(goal) >= 100);
  const activeGoals = sortedGoals.filter((goal) => getGoalProgress(goal) < 100);

  const handleCreate = () => {
    const targetAmount = Number(formData.targetAmount.replace(',', '.'));
    const currentAmount = Number(formData.currentAmount.replace(',', '.'));

    if (!formData.title.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      const diagnostic = buildGoalsDiagnostic('target');
      setTargetAmountError(diagnostic.title);
      setTargetAmountDiagnostic(diagnostic);
      return;
    }

    setTargetAmountError(null);
    setTargetAmountDiagnostic(null);
    try {
      onCreateGoal({
        title: formData.title.trim(),
        targetAmount,
        currentAmount: Number.isFinite(currentAmount) ? Math.min(Math.max(currentAmount, 0), targetAmount) : 0,
        deadline: formData.deadline || undefined,
        category: formData.category,
      });

      setFormData(DEFAULT_FORM);
      setShowForm(false);
    } catch (error) {
      logWarn('[Goals] Failed to create goal', {
        error,
        title: formData.title.trim(),
        fallback: 'goals-create-goal-failed',
      });
      const diagnostic = {
        title: 'Nao foi possivel salvar a meta',
        message: 'A meta foi validada, mas o sistema nao conseguiu persistir a criacao agora.',
        suggestion: 'Tente novamente ou verifique a conexao com a base de dados.',
      };
      setTargetAmountError(diagnostic.title);
      setTargetAmountDiagnostic(diagnostic);
    }
  };

  const handleContribute = () => {
    if (!contributeGoal) return;

    const amount = Number(contributeAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      const diagnostic = buildGoalsDiagnostic('contribute');
      setContributeError(diagnostic.title);
      setContributeDiagnostic(diagnostic);
      return;
    }

    setContributeError(null);
    setContributeDiagnostic(null);
    try {
      onContributeGoal(contributeGoal.id, amount);
      setContributeGoal(null);
      setContributeAmount('');
    } catch (error) {
      logWarn('[Goals] Failed to contribute to goal', {
        error,
        goalId: contributeGoal.id,
        amount,
        fallback: 'goals-contribute-failed',
      });
      const diagnostic = {
        title: 'Nao foi possivel registrar o aporte',
        message: 'O valor foi validado, mas a atualizacao da meta falhou agora.',
        suggestion: 'Tente novamente ou atualize a tela para revalidar o estado da meta.',
      };
      setContributeError(diagnostic.title);
      setContributeDiagnostic(diagnostic);
    }
  };

  return (
    <div className={`flex flex-col gap-4 pb-8 ${VISUAL_MOTION.entrance}`}>
      <div className={`${VISUAL_SURFACES.workspace} flex items-center justify-between gap-4 p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300">
            <Target size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight text-slate-900 dark:text-white">{SECONDARY_FLOWS_COPY.goals.title}</h1>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
              {SECONDARY_FLOWS_COPY.goals.subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setTargetAmountError(null);
            setTargetAmountDiagnostic(null);
            setContributeError(null);
            setContributeDiagnostic(null);
          }}
          disabled={!canEditGoals}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-[10px] font-semibold text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 ${VISUAL_MOTION.action}`}
        >
          <Plus size={14} /> Nova meta
        </button>
      </div>

      {goals.length === 0 && !showForm && (
        <div data-testid="goals-empty-state" className={`${VISUAL_SURFACES.quietSection} flex flex-col items-center justify-center gap-4 py-12`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <Target size={24} className="text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-800 dark:text-white text-sm">{SECONDARY_FLOWS_COPY.goals.emptyTitle}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">{SECONDARY_FLOWS_COPY.goals.emptyDescription}</p>
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setTargetAmountError(null);
              setTargetAmountDiagnostic(null);
              setContributeError(null);
              setContributeDiagnostic(null);
            }}
            className={`flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900 ${VISUAL_MOTION.action}`}
          >
            <Plus size={14} /> Criar meta
          </button>
        </div>
      )}

      {showForm && canEditGoals && (
        <div className={`${VISUAL_SURFACES.section} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <p className="font-semibold text-slate-900 dark:text-white text-sm">Nova Meta</p>
            <button
              onClick={() => {
                setShowForm(false);
                setTargetAmountError(null);
                setTargetAmountDiagnostic(null);
                setContributeError(null);
                setContributeDiagnostic(null);
              }}
              className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div
            className="no-scrollbar flex gap-2 overflow-x-auto border-b border-slate-100 px-5 py-3 dark:border-slate-800"
          >
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset.title}
                onClick={() => setFormData((current) => ({ ...current, title: preset.title, category: preset.category }))}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-semibold shrink-0 transition-colors ${
                  formData.title === preset.title
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {preset.title}
              </button>
            ))}
          </div>

          <div className="p-5 flex flex-col gap-4">
            <div>
              <label className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Nome da meta</label>
              <input
                type="text"
                value={formData.title}
                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex: Reserva de caixa operacional"
                className={INPUT_SURFACE}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Valor alvo (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.targetAmount}
                  onChange={(event) => { setFormData((current) => ({ ...current, targetAmount: event.target.value })); setTargetAmountError(null); setTargetAmountDiagnostic(null); }}
                  placeholder="0,00"
                  className={INPUT_SURFACE}
                />
                {targetAmountError && <p className="text-[10px] text-rose-500 font-medium mt-1">{targetAmountError}</p>}
                {targetAmountDiagnostic && (
                  <div role="status" className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 p-3 space-y-1">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-700 dark:text-rose-300">{targetAmountDiagnostic.title}</p>
                    <p className="text-[10px] font-medium text-rose-700 dark:text-rose-100">{targetAmountDiagnostic.message}</p>
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-rose-600 dark:text-rose-300">Próximo passo: {targetAmountDiagnostic.suggestion}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Valor atual (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.currentAmount}
                  onChange={(event) => setFormData((current) => ({ ...current, currentAmount: event.target.value }))}
                  placeholder="0,00"
                  className={INPUT_SURFACE}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Categoria</label>
                <select
                  value={formData.category}
                  onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value as Category }))}
                  className={INPUT_SURFACE}
                >
                  {Object.values(Category).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Prazo (opcional)</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(event) => setFormData((current) => ({ ...current, deadline: event.target.value }))}
                  className={INPUT_SURFACE}
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!formData.title || !formData.targetAmount}
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 ${VISUAL_MOTION.action}`}
            >
              <Check size={16} /> Criar Meta
            </button>
          </div>
        </div>
      )}

      {activeGoals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          hideValues={hideValues}
          onDeleteGoal={canEditGoals ? onDeleteGoal : () => undefined}
          onOpenContribution={canEditGoals ? setContributeGoal : () => undefined}
        />
      ))}

      {completedGoals.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-2">
            <Trophy size={14} className="text-amber-500" />
            <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.08em]">
              Concluidas ({completedGoals.length})
            </p>
          </div>
          {completedGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              hideValues={hideValues}
              onDeleteGoal={canEditGoals ? onDeleteGoal : () => undefined}
              onOpenContribution={canEditGoals ? setContributeGoal : () => undefined}
            />
          ))}
        </>
      )}

      {contributeGoal && canEditGoals && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`${VISUAL_SURFACES.modal} flex w-full max-w-sm flex-col gap-4 p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                  <Target size={14} className="inline mr-1 text-emerald-500" />
                  Aportar em "{contributeGoal.title}"
                </p>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                  Atual: {hideValues ? '••••' : formatCurrency(contributeGoal.currentAmount)} / {hideValues ? '••••' : formatCurrency(contributeGoal.targetAmount)}
                </p>
              </div>
              <button
                onClick={() => { setContributeAmount(''); setContributeGoal(null); }}
                aria-label="Fechar"
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label htmlFor="contribute-amount" className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Valor do aporte (R$)</label>
                <input
                  id="contribute-amount"
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={contributeAmount}
                  onChange={(event) => { setContributeAmount(event.target.value); setContributeError(null); setContributeDiagnostic(null); }}
                  placeholder="0,00"
                  className={`${INPUT_SURFACE} mt-1.5 text-lg font-semibold`}
                />
              {contributeError && <p className="text-[10px] text-rose-500 font-medium mt-1">{contributeError}</p>}
              {contributeDiagnostic && (
                <div role="status" className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 p-3 space-y-1">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-700 dark:text-rose-300">{contributeDiagnostic.title}</p>
                  <p className="text-[10px] font-medium text-rose-700 dark:text-rose-100">{contributeDiagnostic.message}</p>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-rose-600 dark:text-rose-300">Próximo passo: {contributeDiagnostic.suggestion}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleContribute}
              disabled={!contributeAmount || Number(contributeAmount) <= 0}
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 ${VISUAL_MOTION.action}`}
            >
              <Check size={16} /> Confirmar Aporte
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsPage;





