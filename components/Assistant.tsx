import React, { useEffect, useMemo, useState } from 'react';
import { Reminder, ReminderType, Alert, Transaction, TransactionType, Category, Goal } from '../types';
import {
  Calendar, Clock, Trash2, Edit2, X,
  BrainCircuit, Bell, Target, HeartPulse, UserCircle,
  Briefcase, GraduationCap, TrendingUp, Wallet, Check,
  ChevronDown, ChevronUp, AlertTriangle, Sparkles, Loader2
} from 'lucide-react';
import { buildCashflowPrediction } from '../src/ai/riskAnalyzer';
import { computeFinancialSignals } from '../src/ai/signalEngine';
import { calculateAlertProgress } from '../src/engines/finance/analyticsEngine';
import { ASSISTANT_COPY } from '../src/app/assistantCopy';
import { canAccessFeature } from '../src/app/monetizationPlan';
import { logWarn } from '../src/utils/logger';

export type ReminderOperationalState = 'active' | 'overdue' | 'completed' | 'canceled';

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const getReminderMetadataStatus = (reminder: Reminder): string | null => {
  if (!('status' in reminder) || typeof reminder.status !== 'string') {
    return null;
  }

  return reminder.status.toLowerCase();
};

export const classifyReminderOperationalState = (
  reminder: Reminder,
  referenceDate: Date = new Date(),
): ReminderOperationalState => {
  const metadataStatus = getReminderMetadataStatus(reminder);
  if (metadataStatus === 'canceled' || metadataStatus === 'cancelled' || metadataStatus === 'cleared') {
    return 'canceled';
  }

  if (reminder.completed) {
    return 'completed';
  }

  if (new Date(reminder.date).getTime() < startOfDay(referenceDate)) {
    return 'overdue';
  }

  return 'active';
};

export const isFinancialReminder = (reminder: Reminder): boolean => {
  const hasFinancialKind = 'kind' in reminder && reminder.kind === 'financial';
  return Boolean((reminder.amount && reminder.amount > 0) || hasFinancialKind);
};

const ASSISTANT_CLASSES = {
  primaryAction: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
  neutralPanel: 'bg-slate-50 dark:bg-slate-900/50',
  neutralField: 'bg-slate-50 dark:bg-slate-900 rounded-2xl',
  selectedControl: 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100',
} as const;

interface AssistantProps {
  reminders: Reminder[];
  alerts: Alert[];
  goals: Goal[];
  transactions: Transaction[];
  onToggleComplete: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onAddReminder: (reminder: Partial<Reminder>) => void;
  onUpdateReminder: (updated: Reminder) => void;
  onSaveAlert: (alert: Omit<Alert, 'id'>) => void;
  onDeleteAlert: (id: string) => void;
  onSaveGoal: (goal: Omit<Goal, 'id'>) => void;
  onDeleteGoal: (id: string) => void;
  onUpdateGoal: (updated: Goal) => void;
  workspacePlan?: 'free' | 'pro';
  hideValues: boolean;
}

const Assistant: React.FC<AssistantProps> = ({ 
  reminders, alerts, goals, transactions, onDeleteReminder, onAddReminder, 
  onUpdateReminder, onSaveAlert, onDeleteAlert, onSaveGoal, onDeleteGoal, onToggleComplete, hideValues,
  workspacePlan = 'free',
}) => {
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [newReminder, setNewReminder] = useState<Partial<Reminder>>({ title: '', type: ReminderType.PESSOAL, priority: 'media' });
  const [newAlert, setNewAlert] = useState<Partial<Alert>>({ category: 'Geral', threshold: 0, timeframe: 'mensal' });
  const [newGoal, setNewGoal] = useState<Partial<Goal>>({ title: '', targetAmount: 0, currentAmount: 0, category: Category.INVESTIMENTO });

  // Smart Alerts State
  const [isGeneratingAlerts, setIsGeneratingAlerts] = useState(false);
  const [smartAlerts, setSmartAlerts] = useState<Array<{category: string; threshold: number; reason: string; title?: string; description?: string}>>([]);
  const [showSmartAlertsModal, setShowSmartAlertsModal] = useState(false);
  const [smartAlertsUpgradeOnly, setSmartAlertsUpgradeOnly] = useState(false);

  // Bulk Delete State
  const [selectedReminders, setSelectedReminders] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showInactiveReminders, setShowInactiveReminders] = useState(false);
  
  useEffect(() => {
    if (!showBulkDeleteConfirm) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowBulkDeleteConfirm(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showBulkDeleteConfirm]);

  // Filter State
  const [reminderFilter, setReminderFilter] = useState<'all' | 'pessoal' | 'trabalho' | 'negocio' | 'investimento' | 'saude' | 'alta' | 'media' | 'baixa'>('all');
  const smartAlertsEnabled = canAccessFeature(workspacePlan, 'smartAlertSuggestions');

  const formatVal = (amt: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amt);

  const toggleSelectReminder = (id: string) => {
    setSelectedReminders(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteSelectedReminders = () => {
    setShowBulkDeleteConfirm(true);
  };

  const confirmDeleteSelectedReminders = () => {
    selectedReminders.forEach(id => onDeleteReminder(id));
    setSelectedReminders([]);
    setShowBulkDeleteConfirm(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return 'bg-rose-500';
      case 'media': return 'bg-amber-500';
      case 'baixa': return 'bg-emerald-500';
      default: return 'bg-slate-300';
    }
  };

  const filteredActiveReminders = useMemo(() => {
    return reminders.filter(r => {
      const reminderState = classifyReminderOperationalState(r);
      if (reminderState === 'completed' || reminderState === 'canceled') return false;
      if (reminderFilter === 'all') return true;
      if (['alta', 'media', 'baixa'].includes(reminderFilter)) {
        return r.priority === reminderFilter;
      }
      return r.type.toLowerCase() === reminderFilter;
    });
  }, [reminders, reminderFilter]);

  const inactiveReminders = useMemo(
    () => reminders.filter((reminder) => {
      const reminderState = classifyReminderOperationalState(reminder);
      return reminderState === 'completed' || reminderState === 'canceled';
    }),
    [reminders],
  );

  const reminderSummary = useMemo(
    () => filteredActiveReminders.reduce(
      (summary, reminder) => {
        const state = classifyReminderOperationalState(reminder);
        if (state === 'overdue') {
          summary.overdue += 1;
        }
        if (isFinancialReminder(reminder)) {
          summary.financial += 1;
        } else {
          summary.operational += 1;
        }
        return summary;
      },
      { overdue: 0, financial: 0, operational: 0 },
    ),
    [filteredActiveReminders],
  );

  const reminderBoardSummary = useMemo(() => {
    const activeCount = reminders.filter((reminder) => classifyReminderOperationalState(reminder) === 'active').length;
    const overdueCount = reminders.filter((reminder) => classifyReminderOperationalState(reminder) === 'overdue').length;
    const closedCount = reminders.filter((reminder) => {
      const state = classifyReminderOperationalState(reminder);
      return state === 'completed' || state === 'canceled';
    }).length;
    const financialCount = reminders.filter((reminder) => isFinancialReminder(reminder)).length;
    const operationalCount = reminders.length - financialCount;

    return {
      activeCount,
      overdueCount,
      closedCount,
      financialCount,
      operationalCount,
    };
  }, [reminders]);

  const activeFilterSummary = useMemo(() => {
    const labels: Record<typeof reminderFilter, string> = {
      all: 'Sem filtros aplicados',
      alta: 'Prioridade: Alta',
      media: 'Prioridade: Média',
      baixa: 'Prioridade: Baixa',
      pessoal: 'Tipo: Pessoal',
      trabalho: 'Tipo: Trabalho',
      negocio: 'Tipo: Negócio',
      investimento: 'Tipo: Investimento',
      saude: 'Tipo: Saúde',
    };

    return labels[reminderFilter];
  }, [reminderFilter]);

  const goalBoardSummary = useMemo(() => {
    const totalGoals = goals.length;
    const achievedGoals = goals.filter((goal) => goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount).length;
    const inProgressGoals = totalGoals - achievedGoals;

    return {
      totalGoals,
      achievedGoals,
      inProgressGoals,
    };
  }, [goals]);

  const alertBoardSummary = useMemo(() => {
    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter((alert) => calculateAlertProgress(transactions, alert).percent >= 100).length;
    const riskAlerts = alerts.filter((alert) => {
      const percent = calculateAlertProgress(transactions, alert).percent;
      return percent >= 80 && percent < 100;
    }).length;

    return {
      totalAlerts,
      criticalAlerts,
      riskAlerts,
    };
  }, [alerts, transactions]);

  const openReminderEditor = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setNewReminder({
      title: reminder.title,
      type: reminder.type,
      priority: reminder.priority,
    });

    const parsedDate = new Date(reminder.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      setSelectedDate(parsedDate.toISOString().slice(0, 10));
      const hour = String(parsedDate.getHours()).padStart(2, '0');
      const minute = String(parsedDate.getMinutes()).padStart(2, '0');
      setSelectedTime(`${hour}:${minute}`);
    }

    setIsAddingReminder(true);
  };

  const closeReminderModal = () => {
    setIsAddingReminder(false);
    setEditingReminder(null);
    setNewReminder({ title: '', type: ReminderType.PESSOAL, priority: 'media' });
  };

  const generateSmartAlerts = async () => {
    if (!smartAlertsEnabled) {
      setSmartAlertsUpgradeOnly(true);
      setShowSmartAlertsModal(true);
      setIsGeneratingAlerts(false);
      setSmartAlerts([]);
      return;
    }

    setIsGeneratingAlerts(true);
    setSmartAlertsUpgradeOnly(false);
    setShowSmartAlertsModal(true);
    setSmartAlerts([]);

    try {
      const prediction = buildCashflowPrediction(transactions);
      const signals = computeFinancialSignals({
        transactions,
        prediction,
      });
      const suggestions = signals.map((signal) => ({
        category: typeof signal.evidence.category === 'string' ? signal.evidence.category : 'Geral',
        threshold:
          typeof signal.evidence.amount === 'number'
            ? signal.evidence.amount
            : typeof signal.evidence.recurring_total === 'number'
              ? signal.evidence.recurring_total
              : 0,
        reason: signal.description ?? '',
        title: signal.title,
        description: signal.description,
      }));
      setSmartAlerts(suggestions);
    } catch (error) {
      logWarn('[Assistant] Failed to generate smart alerts', {
        error,
        fallback: 'assistant-smart-alerts-failed',
      });
      setSmartAlerts([]);
    } finally {
      setIsGeneratingAlerts(false);
    }
  };

  const handleSaveReminder = () => {
    const reminderTitle = (newReminder.title ?? editingReminder?.title ?? '').trim();
    if (!reminderTitle) return;

    const combinedDate = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

    if (editingReminder) {
      onUpdateReminder({
        ...editingReminder,
        title: reminderTitle,
        date: combinedDate,
        type: (newReminder.type ?? editingReminder.type) as ReminderType,
        priority: (newReminder.priority ?? editingReminder.priority) as Reminder['priority'],
      });
    } else {
      onAddReminder({
        ...newReminder,
        title: reminderTitle,
        date: combinedDate,
      });
    }
    setIsAddingReminder(false);
    setEditingReminder(null);
    setNewReminder({ title: '', type: ReminderType.PESSOAL, priority: 'media' });
  };

  const handleSaveGoal = () => {
    if (!newGoal.title || !newGoal.targetAmount) return;
    onSaveGoal({
      ...newGoal,
      currentAmount: newGoal.currentAmount || 0
    } as Omit<Goal, 'id'>);
    setIsAddingGoal(false);
    setNewGoal({ title: '', targetAmount: 0, currentAmount: 0, category: Category.INVESTIMENTO });
  };

  const getReminderIcon = (type: ReminderType) => {
    switch (type) {
      case ReminderType.PESSOAL: return <UserCircle size={18} className="text-blue-500" />;
      case ReminderType.TRABALHO: return <GraduationCap size={18} className="text-purple-500" />;
      case ReminderType.NEGOCIO: return <Briefcase size={18} className="text-slate-500" />;
      case ReminderType.INVESTIMENTO: return <TrendingUp size={18} className="text-emerald-500" />;
      case ReminderType.SAUDE: return <HeartPulse size={18} className="text-rose-500" />;
      default: return <Clock size={18} className="text-slate-500" />;
    }
  };

  const getAlertIcon = (category: string) => {
    switch (category) {
      case Category.PESSOAL: return <UserCircle size={18} />;
      case Category.CONSULTORIO: return <GraduationCap size={18} />;
      case Category.NEGOCIO: return <Briefcase size={18} />;
      case Category.INVESTIMENTO: return <TrendingUp size={18} />;
      default: return <Bell size={18} />;
    }
  };

  const getAlertProgressClass = (percent: number) => {
    if (percent >= 100) return 'flow-progress-rose';
    if (percent >= 80) return 'flow-progress-amber';
    return 'flow-progress-slate';
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-700 pb-24 sm:pb-20">
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:gap-4 sm:p-5 shrink-0">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight leading-tight text-slate-900 dark:text-white sm:text-2xl">{ASSISTANT_COPY.headerTitle}</h2>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{ASSISTANT_COPY.headerSubtitle}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <BrainCircuit size={20} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-0 sm:px-1">
        <button
          onClick={() => {
            setEditingReminder(null);
            setNewReminder({ title: '', type: ReminderType.PESSOAL, priority: 'media' });
            setIsAddingReminder(true);
          }}
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-none transition-all active:scale-95 hover:scale-105 dark:border-slate-700 dark:bg-slate-800 sm:p-4 sm:shadow-sm"
        >
          <div className={`rounded-lg ${ASSISTANT_CLASSES.neutralPanel} p-1.5 text-slate-500 transition-all group-hover:bg-slate-900 group-hover:text-white sm:p-2`}>
            <Calendar size={18} />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:text-xs sm:tracking-[0.08em]">Evento</span>
        </button>

        <button 
          onClick={() => setIsAddingGoal(true)} 
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-none transition-all active:scale-95 hover:scale-105 dark:border-slate-700 dark:bg-slate-800 sm:p-4 sm:shadow-sm"
        >
          <div className={`rounded-lg ${ASSISTANT_CLASSES.neutralPanel} p-1.5 text-slate-500 transition-all group-hover:bg-slate-900 group-hover:text-white sm:p-2`}>
            <Target size={18} />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:text-xs sm:tracking-[0.08em]">Meta</span>
        </button>

        <button 
          onClick={() => setIsAddingAlert(true)} 
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-none transition-all active:scale-95 hover:scale-105 dark:border-slate-700 dark:bg-slate-800 sm:p-4 sm:shadow-sm"
        >
          <div className={`rounded-lg ${ASSISTANT_CLASSES.neutralPanel} p-1.5 text-slate-500 transition-all group-hover:bg-slate-900 group-hover:text-white sm:p-2`}>
            <Bell size={18} />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:text-xs sm:tracking-[0.08em]">Limite</span>
        </button>
      </div>

      <div className="px-1">
        <button
          onClick={generateSmartAlerts}
          className="group flex w-full items-center justify-start gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition-all active:scale-95 dark:border-slate-700 dark:bg-slate-900/40"
        >
          <Sparkles size={15} className="text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">{ASSISTANT_COPY.smartAlertsCta}</span>
        </button>
      </div>

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-reminders-title"
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 id="bulk-delete-reminders-title" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Confirmar exclusao</h3>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
                  Excluir {selectedReminders.length} lembrete{selectedReminders.length === 1 ? "" : "s"} selecionado{selectedReminders.length === 1 ? "" : "s"} remove esse bloco da agenda e nao pode ser desfeito.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Manter agenda
              </button>
              <button
                type="button"
                onClick={confirmDeleteSelectedReminders}
                className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-white shadow-lg shadow-rose-600/30 transition-colors hover:bg-rose-500"
              >
                Confirmar exclusao
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.08em]">{ASSISTANT_COPY.timelineTitle}</h3>
        </div>

        <div className="space-y-5">
          {/* ORDEM: 1. AGENDA, 2. META, 3. LIMITE */}
          
          {/* 1. AGENDAS */}
          <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.1em]">Lembretes operacionais</span>
            </div>
            <div className="flex gap-2">
                <select
                  value={reminderFilter}
                  onChange={(e) => setReminderFilter(e.target.value as typeof reminderFilter)}
                  className="bg-transparent text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 outline-none border-none"
                >
                  <option value="all">Todos</option>
                  <option value="alta">Alta Prioridade</option>
                  <option value="media">Média Prioridade</option>
                  <option value="baixa">Baixa Prioridade</option>
                  <option value="pessoal">Pessoal</option>
                  <option value="trabalho">Trabalho</option>
                  <option value="negocio">Negócio</option>
                  <option value="investimento">Investimento</option>
                  <option value="saude">Saúde</option>
                </select>
              {selectedReminders.length > 0 && (
                <button
                  onClick={deleteSelectedReminders}
                  className="flex items-center gap-1 px-2 py-1 bg-rose-500 text-white rounded-lg text-xs font-semibold uppercase tracking-[0.08em] hover:bg-rose-600 transition-colors animate-in fade-in slide-in-from-right-2"
                >
                  <Trash2 size={10} /> Excluir ({selectedReminders.length})
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Resumo:</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Ativos {reminderBoardSummary.activeCount}
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 inline-flex items-center gap-1">
              <AlertTriangle size={8} className="shrink-0" /> Vencidos {reminderBoardSummary.overdueCount}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Encerrados {reminderBoardSummary.closedCount}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Financeiros {reminderBoardSummary.financialCount}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Operacionais {reminderBoardSummary.operationalCount}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {activeFilterSummary}
            </span>
          </div>
            
            {filteredActiveReminders.length > 0 ? (
              filteredActiveReminders.map(r => {
                const reminderState = classifyReminderOperationalState(r);
                const reminderTone = reminderState === 'overdue'
                  ? 'border-rose-200 bg-rose-50/60 dark:bg-rose-900/20'
                  : selectedReminders.includes(r.id)
                    ? 'border-slate-400 bg-slate-50 dark:bg-slate-900/20'
                    : 'border-slate-100 dark:border-slate-700';

                return (
                  <div 
                    key={r.id} 
                    className={`bg-white/95 p-4 dark:bg-slate-800/70 sm:p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between shadow-none animate-in fade-in slide-in-from-bottom-2 group ${reminderTone}`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <button 
                        onClick={() => toggleSelectReminder(r.id)}
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${selectedReminders.includes(r.id) ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : reminderState === 'overdue' ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        aria-label="Selecionar lembrete"
                      >
                        {selectedReminders.includes(r.id) ? <Check size={18} /> : getReminderIcon(r.type)}
                      </button>
                      <button className="flex-1 text-left" onClick={() => openReminderEditor(r)} aria-label={`Editar lembrete ${r.title}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm text-slate-800 dark:text-white tracking-tight">{r.title}</h4>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${isFinancialReminder(r) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
                            {isFinancialReminder(r) ? 'Financeiro' : 'Operacional'}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] inline-flex items-center gap-1 ${reminderState === 'overdue' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                            {reminderState === 'overdue' && <AlertTriangle size={8} className="shrink-0" />}
                            {reminderState === 'overdue' ? 'Vencido' : 'Ativo'}
                          </span>
                          {r.priority && (
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(r.priority)}`} title={`Prioridade: ${r.priority}`} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300 tracking-[0.08em]">
                          {new Date(r.date).toLocaleDateString('pt-BR')} • {new Date(r.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <p className="text-xs text-slate-400 uppercase">{r.type}</p>
                        </div>
                      </button>
                    </div>
                    <div className="ml-2 flex items-center gap-1">
                      <button onClick={() => onToggleComplete(r.id)} className="p-2 text-slate-300 hover:text-emerald-600 transition-colors" aria-label={`Concluir lembrete ${r.title}`}>
                        <Check size={16} />
                      </button>
                      <button onClick={() => openReminderEditor(r)} className="p-2 text-slate-300 hover:text-slate-700 transition-colors" aria-label={`Abrir edicao do lembrete ${r.title}`}>
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => onDeleteReminder(r.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors" aria-label={`Excluir lembrete ${r.title}`}><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em]">Nenhum evento encontrado</p>
              </div>
            )}

            {inactiveReminders.length > 0 && (
              <div className="space-y-3 pt-1">
                <button
                  onClick={() => setShowInactiveReminders((current) => !current)}
                  className="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Concluidos e cancelados ({inactiveReminders.length})</span>
                  {showInactiveReminders ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>

                {showInactiveReminders && inactiveReminders.map((reminder) => {
                  const reminderState = classifyReminderOperationalState(reminder);

                  return (
                    <div key={reminder.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/30">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-tight text-slate-500">{reminder.title}</p>
                        <p className="text-xs uppercase tracking-[0.08em] text-slate-400">
                          {new Date(reminder.date).toLocaleDateString('pt-BR')} • {reminderState === 'canceled' ? 'Cancelado' : 'Concluido'}
                        </p>
                      </div>
                      <button onClick={() => onDeleteReminder(reminder.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors" aria-label={`Excluir lembrete inativo ${reminder.title}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. METAS */}
          {goals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <Target size={12} className="text-emerald-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.1em]">Metas do caixa</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Resumo:</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
                  Em andamento {goalBoardSummary.inProgressGoals}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Concluídas {goalBoardSummary.achievedGoals}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Total {goalBoardSummary.totalGoals}
                </span>
              </div>
              {goals.map(goal => {
                const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                return (
                  <div key={goal.id} className="bg-white/95 p-5 dark:bg-slate-800/70 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-none relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 group hover:border-emerald-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                          <Target size={20} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-tight">{goal.title}</h4>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em]">{goal.category}</p>
                        </div>
                      </div>
                      <button onClick={() => onDeleteGoal(goal.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                    </div>
                    <div className="space-y-3 relative">
                      <div className="flex justify-between items-end relative z-10">
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-[0.08em] mb-1">Progresso Atual</p>
                          <p className="text-xl font-semibold text-slate-900 dark:text-white tracking-tighter">{hideValues ? '••••' : formatVal(goal.currentAmount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 uppercase tracking-[0.08em] mb-1">Alvo</p>
                          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-[0.08em]">{hideValues ? '••••' : formatVal(goal.targetAmount)}</p>
                        </div>
                      </div>
                      
                      <div className="relative h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner border border-slate-50 dark:border-slate-800">
                        <progress
                          className="flow-progress flow-progress-emerald absolute inset-0"
                          value={progress}
                          max={100}
                          aria-label={`Progresso da meta ${goal.title}`}
                        />
                        {progress > 15 && (
                          <span className="absolute inset-y-0 left-0 flex items-center px-2 text-xs font-semibold text-white drop-shadow-md">
                            {Math.round(progress)}%
                          </span>
                        )}
                        {progress <= 15 && (
                          <div className="absolute top-0 left-0 h-full w-full flex items-center justify-start pl-2">
                             <span className="text-xs font-semibold text-emerald-600">{Math.round(progress)}%</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between text-xs text-slate-300 uppercase tracking-[0.08em] px-1">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. ALERTAS DE LIMITE */}
          {alerts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <Bell size={12} className="text-rose-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.1em]">Limites do caixa</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Resumo:</span>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-rose-700">
                  Em risco {alertBoardSummary.riskAlerts}
                </span>
                <span className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-300">
                  Estourados {alertBoardSummary.criticalAlerts}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Ativos {alertBoardSummary.totalAlerts}
                </span>
              </div>
              {alerts.map(alert => {
                const { spent, percent } = calculateAlertProgress(transactions, alert);
                return (
                  <div key={alert.id} className="bg-white/95 p-4 dark:bg-slate-800/70 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-4 shadow-none animate-in fade-in slide-in-from-bottom-2 transition-all">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${percent >= 100 ? 'bg-rose-500 text-white' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400'}`}>
                      {getAlertIcon(alert.category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1.5 items-end">
                        <div>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-[0.08em]">{alert.category}</span>
                          <p className="text-xs text-slate-400 uppercase mt-0.5">Teto: {formatVal(alert.threshold)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {percent >= 100 && <AlertTriangle size={10} className="text-rose-500 animate-pulse" />}
                          <span className={`text-xs font-semibold ${percent >= 100 ? 'text-rose-500' : 'text-slate-500'}`}>{Math.round(percent)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <progress
                          className={`flow-progress ${getAlertProgressClass(percent)}`}
                          value={Math.min(percent, 100)}
                          max={100}
                          aria-label={`Uso do limite ${alert.category}`}
                        />
                      </div>
                    </div>
                    <button onClick={() => onDeleteAlert(alert.id)} className="p-1 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}

          {reminders.length === 0 && goals.length === 0 && alerts.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
               <BrainCircuit size={40} className="mx-auto text-slate-200 mb-4" />
               <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em]">Painel de apoio pronto para sua rotina.</p>
            </div>
          )}
        </div>
      </section>

      {showSmartAlertsModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-xl max-h-[85vh] overflow-y-auto sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 text-white rounded-xl shadow-md dark:bg-slate-100 dark:text-slate-900"><Sparkles size={16} /></div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Alertas do caixa</h3>
              </div>
              <button onClick={() => setShowSmartAlertsModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>

            {isGeneratingAlerts ? (
              <div className="py-20 flex flex-col items-center gap-4 text-center">
                <Loader2 size={40} className="animate-spin text-slate-600" />
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 animate-pulse">Lendo dados para sugestoes...</p>
              </div>
            ) : smartAlertsUpgradeOnly ? (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  O Free continua com criacao manual de alertas. No Pro, voce recebe sugestoes prontas com base no seu padrao de caixa.
                </p>
                <div className={`space-y-2 rounded-2xl border border-slate-200 ${ASSISTANT_CLASSES.neutralPanel} p-4 dark:border-slate-700`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">No Pro voce destrava</p>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Sugestoes inteligentes por categoria.</p>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Recomendacoes de teto com justificativa objetiva.</p>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mais rapidez para ajustar limites sem tentativa e erro.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Com os dados atuais, estas sugestoes podem ajudar no controle de caixa. Revise antes de aplicar.
                </p>
                {smartAlerts.length > 0 ? (
                  smartAlerts.map((alert, idx) => (
                    <div key={idx} className="bg-slate-50/80 p-4 dark:bg-slate-900/70 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-tight">{alert.title ?? alert.category}</h4>
                          <p className="text-xs text-slate-500 uppercase tracking-[0.08em] mt-1">Sugestão: {formatVal(alert.threshold)}</p>
                        </div>
                        <button 
                          onClick={() => {
                            onSaveAlert({
                              category: alert.category as Alert['category'],
                              threshold: alert.threshold,
                              timeframe: 'mensal'
                            });
                            setShowSmartAlertsModal(false);
                          }}
                          className={`px-4 py-2 ${ASSISTANT_CLASSES.primaryAction} rounded-xl text-xs font-semibold uppercase tracking-[0.08em] hover:bg-slate-800 transition-colors shadow-lg dark:hover:bg-white`}
                        >
                          Aplicar
                        </button>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{alert.description ?? alert.reason}"</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <p className="text-xs text-slate-400">Nenhum padrão crítico identificado no momento.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modais de Criação */}
      {isAddingReminder && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-xl sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white uppercase tracking-tight">{editingReminder ? 'Editar Evento' : 'Novo Evento'}</h3>
              <button onClick={closeReminderModal} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Descrição</label>
                <input type="text" value={newReminder.title} onChange={e => setNewReminder({...newReminder, title: e.target.value})} placeholder="Ex: Pagar fatura do cartão" className={`w-full p-4 ${ASSISTANT_CLASSES.neutralField} outline-none font-medium text-sm text-slate-800 dark:text-white`} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Tipo de Compromisso</label>
                <div className="grid grid-cols-3 gap-2">
                   {Object.values(ReminderType).map(type => (
                     <button 
                       key={type}
                       onClick={() => setNewReminder({...newReminder, type})}
                       className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all active:scale-95 ${newReminder.type === type ? `${ASSISTANT_CLASSES.selectedControl} shadow-md scale-105` : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400 hover:border-slate-200'}`}
                     >
                       {getReminderIcon(type)}
                       <span className="text-xs font-semibold uppercase tracking-tight truncate w-full text-center">{type}</span>
                     </button>
                   ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Prioridade</label>
                <div className="flex gap-2">
                  {['baixa', 'media', 'alta'].map(p => (
                    <button
                      key={p}
                      onClick={() => setNewReminder({...newReminder, priority: p as Reminder['priority']})}
                      className={`flex-1 p-3 rounded-2xl border text-xs font-semibold uppercase tracking-[0.08em] transition-all ${newReminder.priority === p ? ASSISTANT_CLASSES.selectedControl : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Data</label>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className={`w-full p-4 ${ASSISTANT_CLASSES.neutralField} text-xs dark:text-white border-none`} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em] ml-1">Hora</label>
                  <input type="time" value={selectedTime} onChange={e => setSelectedTime(e.target.value)} className={`w-full p-4 ${ASSISTANT_CLASSES.neutralField} text-xs dark:text-white border-none`} />
                </div>
              </div>
              <button onClick={handleSaveReminder} className={`w-full py-5 ${ASSISTANT_CLASSES.primaryAction} rounded-2xl font-semibold text-xs uppercase shadow-lg hover:bg-slate-800 active:scale-95 transition-all dark:hover:bg-white`}>{editingReminder ? 'Salvar Edicao' : 'Criar Evento'}</button>
            </div>
          </div>
        </div>
      )}

      {isAddingGoal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-xl sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Nova Meta</h3>
              <button onClick={() => setIsAddingGoal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={newGoal.title} onChange={e => setNewGoal({...newGoal, title: e.target.value})} placeholder="Ex: Viagem de Férias" className={`w-full p-4 ${ASSISTANT_CLASSES.neutralField} outline-none font-medium text-sm text-slate-800 dark:text-white`} />
              <input type="number" value={newGoal.targetAmount || ''} onChange={e => setNewGoal({...newGoal, targetAmount: parseFloat(e.target.value)})} placeholder="Valor Alvo (R$)" className={`w-full p-4 ${ASSISTANT_CLASSES.neutralField} outline-none font-semibold text-lg text-slate-800 dark:text-white`} />
              <button onClick={handleSaveGoal} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-semibold text-xs uppercase shadow-md active:scale-95 transition-all hover:bg-emerald-700">Criar Meta</button>
            </div>
          </div>
        </div>
      )}

      {isAddingAlert && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-xl sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Novo Limite</h3>
              <button onClick={() => setIsAddingAlert(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-5">
              <select value={newAlert.category} onChange={e => setNewAlert({...newAlert, category: e.target.value as Alert['category']})} className={`w-full p-4 ${ASSISTANT_CLASSES.neutralField} outline-none font-medium text-sm text-slate-800 dark:text-white border-none appearance-none`}>
                <option value="Geral">Todas as Categorias</option>
                {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="number" value={newAlert.threshold || ''} onChange={e => setNewAlert({...newAlert, threshold: parseFloat(e.target.value)})} placeholder="Valor Máximo (R$)" className={`w-full p-4 ${ASSISTANT_CLASSES.neutralField} outline-none font-semibold text-lg text-slate-800 dark:text-white border-none`} />
              <button onClick={() => { if(newAlert.threshold) onSaveAlert(newAlert as Omit<Alert, 'id'>); setIsAddingAlert(false); }} className="w-full py-5 bg-rose-600 text-white rounded-2xl font-semibold text-xs uppercase shadow-md active:scale-95 transition-all hover:bg-rose-700">Definir Limite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assistant;




