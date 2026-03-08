import React, { useState, useEffect, useCallback } from 'react';
import {
  getGoals, createGoal, updateGoal, deleteGoal,
  addContribution, calculateGoalProgress,
  GOAL_PRESETS, GOAL_STATUS_META
} from '../services/finance/goalService';
import { formatCurrency } from '../utils/helpers';
import { FinancialGoal } from '../models/FinancialGoal';
import {
  Target, Plus, Trash2, ChevronRight, X,
  Check, CalendarDays, DollarSign, TrendingUp,
  Edit3, PlusCircle, Trophy, AlertCircle
} from 'lucide-react';

interface GoalsPageProps {
  userId: string;
  hideValues?: boolean;
}

// currency formatter replaced by helper
const fmt = formatCurrency;

// ─── New goal form ────────────────────────────────────────────────────────────

interface GoalFormData {
  name: string;
  target_amount: string;
  current_amount: string;
  target_date: string;
  icon: string;
  color: string;
}

const DEFAULT_FORM: GoalFormData = {
  name: '', target_amount: '', current_amount: '0',
  target_date: '', icon: '🎯', color: '#6366f1',
};

// ─── Progress Ring SVG ────────────────────────────────────────────────────────

const ProgressRing: React.FC<{ pct: number; color: string; size?: number }> = ({
  pct, color, size = 56
}) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor"
        strokeWidth={4} className="text-slate-100 dark:text-slate-700" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={4} strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
    </svg>
  );
};

// ─── Goal Card ────────────────────────────────────────────────────────────────

const GoalCard: React.FC<{
  goal: FinancialGoal;
  hideValues: boolean;
  onDelete: (id: string) => void;
  onContribute: (goal: FinancialGoal) => void;
}> = ({ goal, hideValues, onDelete, onContribute }) => {
  const progress = calculateGoalProgress(goal);
  const statusMeta = GOAL_STATUS_META[progress.status];
  const color = goal.color ?? '#6366f1';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="p-5 flex items-start gap-4">
        {/* Ring + icon */}
        <div className="relative shrink-0">
          <ProgressRing pct={progress.progress_percentage} color={color} />
          <div className="absolute inset-0 flex items-center justify-center text-lg">
            {goal.icon ?? '🎯'}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-black text-slate-900 dark:text-white text-sm leading-tight truncate">{goal.name}</p>
            <span className={`text-[7px] font-black uppercase tracking-widest shrink-0 ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
          </div>

          <div className="flex items-baseline gap-1 mt-1">
            <p className="text-base font-black" style={{ color }}>
              {hideValues ? '••••' : formatCurrency(goal.current_amount)}
            </p>
            <p className="text-[9px] text-slate-400 font-bold">
              / {hideValues ? '••••' : formatCurrency(goal.target_amount)}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress.progress_percentage}%`, backgroundColor: color }}
            />
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[8px] text-slate-400 font-bold">
              {progress.progress_percentage}% concluído
            </span>
            {progress.days_remaining !== null && progress.days_remaining > 0 && (
              <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
                <CalendarDays size={8} />
                {progress.days_remaining}d restantes
              </span>
            )}
            {progress.daily_savings_needed !== null && progress.daily_savings_needed > 0 && (
              <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
                <TrendingUp size={8} />
                {hideValues ? '••' : fmt(progress.daily_savings_needed)}/dia
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={() => onContribute(goal)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[9px] font-black text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
        >
          <PlusCircle size={13} /> Aportar
        </button>
        <div className="w-px bg-slate-100 dark:bg-slate-700" />
        <button
          onClick={() => onDelete(goal.id)}
          className="flex items-center justify-center gap-1.5 px-5 py-3 text-[9px] font-black text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const GoalsPage: React.FC<GoalsPageProps> = ({ userId, hideValues = false }) => {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<GoalFormData>(DEFAULT_FORM);
  const [contributeGoal, setContributeGoal] = useState<FinancialGoal | null>(null);
  const [contributeAmt, setContributeAmt] = useState('');

  const reload = useCallback(() => setGoals(getGoals(userId)), [userId]);
  useEffect(() => { reload(); }, [reload]);

  const handleCreate = () => {
    const target = parseFloat(formData.target_amount.replace(',', '.'));
    const current = parseFloat(formData.current_amount.replace(',', '.') || '0');
    if (!formData.name || isNaN(target) || target <= 0) return;
    createGoal({
      user_id: userId,
      name: formData.name,
      target_amount: target,
      current_amount: Math.min(current, target),
      target_date: formData.target_date || undefined,
      icon: formData.icon,
      color: formData.color,
    });
    setFormData(DEFAULT_FORM);
    setShowForm(false);
    reload();
  };

  const handleDelete = (id: string) => {
    deleteGoal(id);
    reload();
  };

  const handleContribute = () => {
    if (!contributeGoal) return;
    const amt = parseFloat(contributeAmt.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) return;
    addContribution(contributeGoal.id, amt);
    setContributeGoal(null);
    setContributeAmt('');
    reload();
  };

  const completedGoals = goals.filter(g => calculateGoalProgress(g).status === 'completed');
  const activeGoals = goals.filter(g => calculateGoalProgress(g).status !== 'completed');

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Target size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">Metas</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {goals.length} meta{goals.length !== 1 ? 's' : ''} · {completedGoals.length} concluída{completedGoals.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-95 transition-all"
        >
          <Plus size={14} /> Nova meta
        </button>
      </div>

      {/* Empty state */}
      {goals.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center gap-4 py-14 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center">
            <Target size={24} className="text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="font-black text-slate-800 dark:text-white text-sm">Nenhuma meta ainda</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Crie sua primeira meta financeira</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-2xl text-sm font-black">
            <Plus size={14} /> Criar meta
          </button>
        </div>
      )}

      {/* New goal form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <p className="font-black text-slate-900 dark:text-white text-sm">Nova Meta</p>
            <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Preset chips */}
          <div className="px-5 py-3 flex gap-2 overflow-x-auto border-b border-slate-100 dark:border-slate-700" style={{ scrollbarWidth: 'none' }}>
            {GOAL_PRESETS.map(p => (
              <button
                key={p.name}
                onClick={() => setFormData(d => ({ ...d, name: p.name, icon: p.icon, color: p.color }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black shrink-0 transition-colors ${
                  formData.name === p.name
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {p.icon} {p.name}
              </button>
            ))}
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* Name */}
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nome da meta</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                placeholder="Ex: Reserva de Emergência"
                className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Target amount */}
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Valor alvo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.target_amount}
                  onChange={e => setFormData(d => ({ ...d, target_amount: e.target.value }))}
                  placeholder="0,00"
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
              {/* Current amount */}
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Valor atual (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.current_amount}
                  onChange={e => setFormData(d => ({ ...d, current_amount: e.target.value }))}
                  placeholder="0,00"
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>

            {/* Target date */}
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Data alvo (opcional)</label>
              <input
                type="date"
                value={formData.target_date}
                onChange={e => setFormData(d => ({ ...d, target_date: e.target.value }))}
                className="w-full mt-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={!formData.name || !formData.target_amount}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              <Check size={16} /> Criar Meta
            </button>
          </div>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.map(goal => (
        <GoalCard
          key={goal.id}
          goal={goal}
          hideValues={hideValues}
          onDelete={handleDelete}
          onContribute={setContributeGoal}
        />
      ))}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-2">
            <Trophy size={14} className="text-amber-500" />
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              Concluídas ({completedGoals.length})
            </p>
          </div>
          {completedGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              hideValues={hideValues}
              onDelete={handleDelete}
              onContribute={setContributeGoal}
            />
          ))}
        </>
      )}

      {/* Contribute modal */}
      {contributeGoal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-slate-900 dark:text-white text-sm">
                  {contributeGoal.icon} Aportar em "{contributeGoal.name}"
                </p>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                  Atual: {hideValues ? '••••' : fmt(contributeGoal.current_amount)} / {hideValues ? '••••' : fmt(contributeGoal.target_amount)}
                </p>
              </div>
              <button onClick={() => setContributeGoal(null)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <X size={15} />
              </button>
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Valor do aporte (R$)</label>
              <input
                type="number"
                step="0.01"
                autoFocus
                value={contributeAmt}
                onChange={e => setContributeAmt(e.target.value)}
                placeholder="0,00"
                className="w-full mt-1.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white outline-none focus:border-emerald-400 transition-colors"
              />
            </div>
            <button
              onClick={handleContribute}
              disabled={!contributeAmt || parseFloat(contributeAmt) <= 0}
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
