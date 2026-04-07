import React, { useMemo, useState } from 'react';
import { Category, Goal } from '../types';
import { formatCurrency } from '../utils/helpers';
import { SECONDARY_FLOWS_COPY } from '../src/app/secondaryFlowsCopy';
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

const GOAL_PRESETS: Array<{ title: string; category: Category }> = [
  { title: 'Reserva de emergência', category: Category.INVESTIMENTO },
  { title: 'Viagem', category: Category.PESSOAL },
  { title: 'Novo equipamento', category: Category.CONSULTORIO },
  { title: 'Entrada do imóvel', category: Category.INVESTIMENTO },
];

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
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
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
    <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
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
              <p className="font-black text-slate-900 dark:text-white text-sm leading-tight truncate">
                {goal.title}
              </p>
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-1">
                {goal.category}
              </p>
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 shrink-0">
              {progress >= 100 ? 'concluida' : `${Math.round(progress)}%`}
            </span>
          </div>

          <div className="flex items-baseline gap-1 mt-2">
            <p className="text-base font-black text-slate-900 dark:text-white">
              {hideValues ? '••••' : formatCurrency(goal.currentAmount)}
            </p>
            <p className="text-[9px] text-slate-400 font-bold">
              / {hideValues ? '••••' : formatCurrency(goal.targetAmount)}
            </p>
          </div>

          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-emerald-500 to-teal-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-3 mt-2">
            {goal.deadline && (
              <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
                <CalendarDays size={8} />
                {new Date(goal.deadline).toLocaleDateString('pt-BR')}
              </span>
            )}
            {daysRemaining !== null && daysRemaining > 0 && (
              <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
                <TrendingUp size={8} />
                {daysRemaining}d restantes
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={() => onOpenContribution(goal)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[9px] font-black text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
        >
          <PlusCircle size={13} /> Aportar
        </button>
        <div className="w-px bg-slate-100 dark:bg-slate-700" />
        <button
          onClick={() => onDeleteGoal(goal.id)}
          className="flex items-center justify-center gap-1.5 px-5 py-3 text-[9px] font-black text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
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
      return;
    }

    onCreateGoal({
      title: formData.title.trim(),
      targetAmount,
      currentAmount: Number.isFinite(currentAmount) ? Math.min(Math.max(currentAmount, 0), targetAmount) : 0,
      deadline: formData.deadline || undefined,
      category: formData.category,
    });

    setFormData(DEFAULT_FORM);
    setShowForm(false);
  };

  const handleContribute = () => {
    if (!contributeGoal) return;

    const amount = Number(contributeAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return;

    onContributeGoal(contributeGoal.id, amount);
    setContributeGoal(null);
    setContributeAmount('');
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Target size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">{SECONDARY_FLOWS_COPY.goals.title}</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {SECONDARY_FLOWS_COPY.goals.subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!canEditGoals}
          className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-95 transition-all"
        >
          <Plus size={14} /> Nova meta
        </button>
      </div>

      {goals.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center gap-4 py-14 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center">
            <Target size={24} className="text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="font-black text-slate-800 dark:text-white text-sm">{SECONDARY_FLOWS_COPY.goals.emptyTitle}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">{SECONDARY_FLOWS_COPY.goals.emptyDescription}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-2xl text-sm font-black"
          >
            <Plus size={14} /> Criar meta
          </button>
        </div>
      )}

      {showForm && canEditGoals && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <p className="font-black text-slate-900 dark:text-white text-sm">Nova Meta</p>
            <button
              onClick={() => setShowForm(false)}
              className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div
            className="px-5 py-3 flex gap-2 overflow-x-auto border-b border-slate-100 dark:border-slate-700"
            style={{ scrollbarWidth: 'none' }}
          >
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset.title}
                onClick={() => setFormData((current) => ({ ...current, title: preset.title, category: preset.category }))}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black shrink-0 transition-colors ${
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
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nome da meta</label>
              <input
                type="text"
                value={formData.title}
                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex: Reserva de Emergencia"
                className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-400 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Valor alvo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.targetAmount}
                  onChange={(event) => setFormData((current) => ({ ...current, targetAmount: event.target.value }))}
                  placeholder="0,00"
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Valor atual (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.currentAmount}
                  onChange={(event) => setFormData((current) => ({ ...current, currentAmount: event.target.value }))}
                  placeholder="0,00"
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Categoria</label>
                <select
                  value={formData.category}
                  onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value as Category }))}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-400 transition-colors"
                >
                  {Object.values(Category).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Prazo (opcional)</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(event) => setFormData((current) => ({ ...current, deadline: event.target.value }))}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!formData.title || !formData.targetAmount}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
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
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
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
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-slate-900 dark:text-white text-sm">
                  <Target size={14} className="inline mr-1 text-emerald-500" />
                  Aportar em "{contributeGoal.title}"
                </p>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                  Atual: {hideValues ? '••••' : formatCurrency(contributeGoal.currentAmount)} / {hideValues ? '••••' : formatCurrency(contributeGoal.targetAmount)}
                </p>
              </div>
              <button
                onClick={() => setContributeGoal(null)}
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Valor do aporte (R$)</label>
              <input
                type="number"
                step="0.01"
                autoFocus
                value={contributeAmount}
                onChange={(event) => setContributeAmount(event.target.value)}
                placeholder="0,00"
                className="w-full mt-1.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white outline-none focus:border-emerald-400 transition-colors"
              />
            </div>

            <button
              onClick={handleContribute}
              disabled={!contributeAmount || Number(contributeAmount) <= 0}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50"
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

