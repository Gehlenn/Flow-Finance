import { FinancialGoal, GoalProgress, GoalStatus } from '../../models/FinancialGoal';
import { FinancialEventEmitter } from '../events/eventEngine';
import { pushToCloud } from '../services/localSyncService';

const STORAGE_KEY = 'flow_financial_goals';

// ─── Storage helpers ──────────────────────────────────────────────────────────

function readAll(): FinancialGoal[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeAll(goals: FinancialGoal[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

/**
 * Sincroniza metas com a nuvem de forma assíncrona (fire-and-forget).
 * O localStorage já foi atualizado antes dessa chamada.
 */
function syncGoalsToCloud(goals: FinancialGoal[]): void {
  const items = goals.map((g) => ({
    id: g.id,
    updatedAt: g.created_at,
    payload: g as unknown as Record<string, unknown>,
  }));
  pushToCloud('goals', items).catch(() => {/* erro já tratado no serviço */});
}

// ─── CRUD (PART 2) ─────────────────────────────────────────────────────────

export function getGoals(userId: string): FinancialGoal[] {
  return readAll().filter(g => g.user_id === userId);
}

export function getGoal(goalId: string): FinancialGoal | null {
  return readAll().find(g => g.id === goalId) ?? null;
}

export function createGoal(goal: Omit<FinancialGoal, 'id' | 'created_at'>): FinancialGoal {
  const all = readAll();
  const newGoal: FinancialGoal = {
    ...goal,
    id: Math.random().toString(36).substr(2, 9),
    created_at: new Date().toISOString(),
  };
  const updated = [...all, newGoal];
  writeAll(updated);
  syncGoalsToCloud(updated);

  // Emitir evento para o event engine
  FinancialEventEmitter.goalCreated({ ...newGoal });

  return newGoal;
}

export function updateGoal(goal: FinancialGoal): FinancialGoal {
  const all = readAll();
  const updated = all.map(g => g.id === goal.id ? { ...goal } : g);
  writeAll(updated);
  syncGoalsToCloud(updated);
  return goal;
}

export function deleteGoal(goalId: string): void {
  const remaining = readAll().filter(g => g.id !== goalId);
  writeAll(remaining);
  // Envia o item deletado como tombstone para o backend
  pushToCloud('goals', [{ id: goalId, updatedAt: new Date().toISOString(), deleted: true }]).catch(() => {/* silencioso */});
}

// Adicionar aporte a uma meta existente
export function addContribution(goalId: string, amount: number): FinancialGoal | null {
  const all = readAll();
  const idx = all.findIndex(g => g.id === goalId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    current_amount: Math.min(all[idx].current_amount + amount, all[idx].target_amount),
  };
  writeAll(all);
  syncGoalsToCloud(all);
  return all[idx];
}

// ─── PART 3 — calculateGoalProgress ──────────────────────────────────────────

export function calculateGoalProgress(goal: FinancialGoal): GoalProgress {
  const progress_percentage = goal.target_amount > 0
    ? Math.min(100, parseFloat(((goal.current_amount / goal.target_amount) * 100).toFixed(1)))
    : 0;

  const remaining_amount = Math.max(0, goal.target_amount - goal.current_amount);

  let days_remaining: number | null = null;
  let daily_savings_needed: number | null = null;

  if (goal.target_date) {
    const now = new Date();
    const target = new Date(goal.target_date);
    days_remaining = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
    daily_savings_needed = days_remaining > 0
      ? parseFloat((remaining_amount / days_remaining).toFixed(2))
      : null;
  }

  // Status
  let status: GoalStatus = 'on_track';
  if (progress_percentage >= 100) {
    status = 'completed';
  } else if (goal.target_date) {
    const now = new Date();
    const target = new Date(goal.target_date);
    if (now > target) {
      status = 'overdue';
    } else if (days_remaining !== null && daily_savings_needed !== null) {
      // "At risk" se precisar guardar mais de 20% acima do ritmo atual
      const daysPassed = Math.ceil(
        (now.getTime() - new Date(goal.created_at).getTime()) / 86400000
      );
      const currentDailyRate = daysPassed > 0 ? goal.current_amount / daysPassed : 0;
      if (daily_savings_needed > currentDailyRate * 1.2 && currentDailyRate > 0) {
        status = 'at_risk';
      }
    }
  }

  return { progress_percentage, remaining_amount, days_remaining, daily_savings_needed, status };
}

// ─── Goal suggestions ─────────────────────────────────────────────────────────

export const GOAL_PRESETS = [
  { name: 'Reserva de Emergência', icon: '🛡️', color: '#6366f1' },
  { name: 'Viagem',                icon: '✈️', color: '#8b5cf6' },
  { name: 'Compra de Imóvel',      icon: '🏠', color: '#0ea5e9' },
  { name: 'Veículo',               icon: '🚗', color: '#10b981' },
  { name: 'Educação',              icon: '🎓', color: '#f59e0b' },
  { name: 'Investimento',          icon: '📈', color: '#06b6d4' },
  { name: 'Outro',                 icon: '🎯', color: '#94a3b8' },
];

export const GOAL_STATUS_META: Record<GoalStatus, { label: string; color: string }> = {
  on_track:  { label: 'No prazo',   color: 'text-emerald-500' },
  at_risk:   { label: 'Em risco',   color: 'text-amber-500' },
  completed: { label: 'Concluída',  color: 'text-indigo-500' },
  overdue:   { label: 'Atrasada',   color: 'text-rose-500' },
};
