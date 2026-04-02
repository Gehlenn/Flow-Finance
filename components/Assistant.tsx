
import React, { useState, useMemo } from 'react';
import { Reminder, ReminderType, Alert, Transaction, TransactionType, Category, Goal } from '../types';
import { 
  Calendar, Clock, Trash2, Plus, X, 
  BrainCircuit, Bell, Target, HeartPulse, UserCircle, 
  Briefcase, GraduationCap, TrendingUp, Wallet, Check,
  ChevronDown, ChevronUp, AlertTriangle, Sparkles, Loader2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { calculateAlertProgress } from '../src/engines/finance/analyticsEngine';

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
  hideValues: boolean;
}

const Assistant: React.FC<AssistantProps> = ({ 
  reminders, alerts, goals, transactions, onDeleteReminder, onAddReminder, 
  onUpdateReminder, onSaveAlert, onDeleteAlert, onSaveGoal, onDeleteGoal, hideValues
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
  const [smartAlerts, setSmartAlerts] = useState<Array<{category: string, threshold: number, reason: string}>>([]);
  const [showSmartAlertsModal, setShowSmartAlertsModal] = useState(false);

  // Bulk Delete State
  const [selectedReminders, setSelectedReminders] = useState<string[]>([]);
  
  // Filter State
  const [reminderFilter, setReminderFilter] = useState<'all' | 'pessoal' | 'trabalho' | 'negocio' | 'investimento' | 'saude' | 'alta' | 'media' | 'baixa'>('all');

  const formatVal = (amt: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amt);

  const toggleSelectReminder = (id: string) => {
    setSelectedReminders(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteSelectedReminders = () => {
    if (confirm(`Excluir ${selectedReminders.length} lembretes selecionados?`)) {
      selectedReminders.forEach(id => onDeleteReminder(id));
      setSelectedReminders([]);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return 'bg-rose-500';
      case 'media': return 'bg-amber-500';
      case 'baixa': return 'bg-emerald-500';
      default: return 'bg-slate-300';
    }
  };

  const filteredReminders = useMemo(() => {
    return reminders.filter(r => {
      if (r.completed) return false;
      if (reminderFilter === 'all') return true;
      if (['alta', 'media', 'baixa'].includes(reminderFilter)) {
        return r.priority === reminderFilter;
      }
      return r.type.toLowerCase() === reminderFilter;
    });
  }, [reminders, reminderFilter]);

  const generateSmartAlerts = async () => {
    setIsGeneratingAlerts(true);
    setShowSmartAlertsModal(true);
    setSmartAlerts([]);

    try {
      const recentTransactions = transactions.slice(0, 50).map(t => ({
        amount: t.amount,
        category: t.category,
        type: t.type,
        description: t.description
      }));

      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
      const prompt = `
        Analise estas transações financeiras e sugira 3 alertas de limites de gastos (orçamentos) inteligentes.
        Foque em categorias onde parece haver gastos excessivos ou frequentes.
        Retorne APENAS um JSON array neste formato, sem markdown:
        [{"category": "Categoria", "threshold": 1000, "reason": "Explicação curta"}]
        
        Transações: ${JSON.stringify(recentTransactions)}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const suggestions = JSON.parse(response.text || '[]');
      setSmartAlerts(suggestions);
    } catch (error) {
      console.error("Erro ao gerar alertas inteligentes:", error);
      setSmartAlerts([]); // Handle error gracefully
    } finally {
      setIsGeneratingAlerts(false);
    }
  };

  const handleSaveReminder = () => {
    if (!newReminder.title?.trim() && !editingReminder?.title?.trim()) return;
    const combinedDate = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    if (editingReminder) {
      onUpdateReminder({ ...editingReminder, date: combinedDate });
    } else {
      onAddReminder({ ...newReminder, date: combinedDate });
    }
    setIsAddingReminder(false);
    setEditingReminder(null);
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
      case ReminderType.NEGOCIO: return <Briefcase size={18} className="text-indigo-500" />;
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

  const getAlertColor = (percent: number) => {
    if (percent >= 100) return 'text-rose-600 bg-rose-500';
    if (percent >= 80) return 'text-amber-600 bg-amber-500';
    if (percent >= 50) return 'text-indigo-600 bg-indigo-500';
    return 'text-emerald-600 bg-emerald-500';
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-700 pb-20">
      <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Assistente</h2>
          <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Inteligência Operacional</p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white">
          <BrainCircuit size={22} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 px-1">
        <button 
          onClick={() => setIsAddingReminder(true)} 
          className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-[1.8rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:scale-105 active:scale-95 group"
        >
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <Calendar size={18} />
          </div>
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Evento</span>
        </button>

        <button 
          onClick={() => setIsAddingGoal(true)} 
          className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-[1.8rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:scale-105 active:scale-95 group"
        >
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <Target size={18} />
          </div>
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Meta</span>
        </button>

        <button 
          onClick={() => setIsAddingAlert(true)} 
          className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-[1.8rem] border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:scale-105 active:scale-95 group"
        >
          <div className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-all">
            <Bell size={18} />
          </div>
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Limite</span>
        </button>
      </div>

      <div className="px-1">
        <button 
          onClick={generateSmartAlerts}
          className="w-full p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[1.8rem] flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all group"
        >
          <Sparkles size={18} className="text-white animate-pulse" />
          <span className="text-[9px] font-black text-white uppercase tracking-widest">Gerar Alertas Inteligentes com IA</span>
        </button>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Próximos Eventos & Status</h3>
        </div>

        <div className="space-y-5">
          {/* ORDEM: 1. AGENDA, 2. META, 3. LIMITE */}
          
          {/* 1. AGENDAS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-indigo-400" />
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Agenda Financeira</span>
              </div>
              <div className="flex gap-2">
                <select 
                  value={reminderFilter} 
                  onChange={(e) => setReminderFilter(e.target.value as any)}
                  className="bg-transparent text-[8px] font-black uppercase tracking-widest text-slate-400 outline-none border-none"
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
                    className="flex items-center gap-1 px-2 py-1 bg-rose-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-rose-600 transition-colors animate-in fade-in slide-in-from-right-2"
                  >
                    <Trash2 size={10} /> Excluir ({selectedReminders.length})
                  </button>
                )}
              </div>
            </div>
            
            {filteredReminders.length > 0 ? (
              filteredReminders.map(r => (
                <div 
                  key={r.id} 
                  className={`bg-white dark:bg-slate-800 p-5 rounded-[2.2rem] border transition-all duration-300 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-bottom-2 group ${selectedReminders.includes(r.id) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-700'}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <button 
                      onClick={() => toggleSelectReminder(r.id)}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${selectedReminders.includes(r.id) ? 'bg-indigo-500 text-white' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      {selectedReminders.includes(r.id) ? <Check size={18} /> : getReminderIcon(r.type)}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-slate-800 dark:text-white tracking-tight">{r.title}</h4>
                        {r.priority && (
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(r.priority)}`} title={`Prioridade: ${r.priority}`} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">
                          {new Date(r.date).toLocaleDateString('pt-BR')} • {new Date(r.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">{r.type}</p>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => onDeleteReminder(r.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nenhum evento encontrado</p>
              </div>
            )}
          </div>

          {/* 2. METAS */}
          {goals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <Target size={12} className="text-emerald-400" />
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Metas de Acúmulo</span>
              </div>
              {goals.map(goal => {
                const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                return (
                  <div key={goal.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2.2rem] border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 group hover:border-emerald-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                          <Target size={20} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-tight">{goal.title}</h4>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{goal.category}</p>
                        </div>
                      </div>
                      <button onClick={() => onDeleteGoal(goal.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                    </div>
                    <div className="space-y-3 relative">
                      <div className="flex justify-between items-end relative z-10">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Progresso Atual</p>
                          <p className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">{hideValues ? '••••' : formatVal(goal.currentAmount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Alvo</p>
                          <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">{hideValues ? '••••' : formatVal(goal.targetAmount)}</p>
                        </div>
                      </div>
                      
                      <div className="relative h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner border border-slate-50 dark:border-slate-800">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2" 
                          style={{ width: `${progress}%` }}
                        >
                          {progress > 15 && <span className="text-[8px] font-black text-white drop-shadow-md">{Math.round(progress)}%</span>}
                        </div>
                        {progress <= 15 && (
                          <div className="absolute top-0 left-0 h-full w-full flex items-center justify-start pl-2">
                             <span className="text-[8px] font-black text-emerald-600">{Math.round(progress)}%</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between text-[8px] font-bold text-slate-300 uppercase tracking-widest px-1">
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
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Limites & Orçamentos</span>
              </div>
              {alerts.map(alert => {
                const { spent, percent } = calculateAlertProgress(transactions, alert);
                const colorClass = getAlertColor(percent);
                
                return (
                  <div key={alert.id} className="bg-white dark:bg-slate-800 p-5 rounded-[2.2rem] border border-slate-100 dark:border-slate-700 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 transition-all">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${percent >= 100 ? 'bg-rose-500 text-white' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400'}`}>
                      {getAlertIcon(alert.category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1.5 items-end">
                        <div>
                          <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">{alert.category}</span>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Teto: {formatVal(alert.threshold)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {percent >= 100 && <AlertTriangle size={10} className="text-rose-500 animate-pulse" />}
                          <span className={`text-[10px] font-black ${percent >= 100 ? 'text-rose-500' : 'text-slate-500'}`}>{Math.round(percent)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-700 ${colorClass.split(' ')[1]}`} style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                    <button onClick={() => onDeleteAlert(alert.id)} className="p-1 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}

          {reminders.length === 0 && goals.length === 0 && alerts.length === 0 && (
            <div className="py-24 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem]">
               <BrainCircuit size={40} className="mx-auto text-slate-200 mb-4" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seu assistente está pronto.</p>
            </div>
          )}
        </div>
      </section>

      {showSmartAlertsModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[3rem] p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Sparkles size={16} /></div>
                <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Alertas Inteligentes</h3>
              </div>
              <button onClick={() => setShowSmartAlertsModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>

            {isGeneratingAlerts ? (
              <div className="py-20 flex flex-col items-center gap-4 text-center">
                <Loader2 size={40} className="animate-spin text-indigo-600" />
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 animate-pulse">Analisando padrões de consumo...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  A IA identificou os seguintes padrões e sugere estes limites para otimizar seu fluxo de caixa:
                </p>
                {smartAlerts.length > 0 ? (
                  smartAlerts.map((alert, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-tight">{alert.category}</h4>
                          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Sugestão: {formatVal(alert.threshold)}</p>
                        </div>
                        <button 
                          onClick={() => {
                            onSaveAlert({
                              category: alert.category as any,
                              threshold: alert.threshold,
                              timeframe: 'mensal'
                            });
                            setShowSmartAlertsModal(false);
                          }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                          Ativar
                        </button>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">"{alert.reason}"</p>
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
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[3rem] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Novo Evento</h3>
              <button onClick={() => setIsAddingReminder(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <input type="text" value={newReminder.title} onChange={e => setNewReminder({...newReminder, title: e.target.value})} placeholder="Ex: Pagar fatura do cartão" className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-bold text-sm text-slate-800 dark:text-white" />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Compromisso</label>
                <div className="grid grid-cols-3 gap-2">
                   {Object.values(ReminderType).map(type => (
                     <button 
                       key={type}
                       onClick={() => setNewReminder({...newReminder, type})}
                       className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all active:scale-95 ${newReminder.type === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400 hover:border-slate-200'}`}
                     >
                       {getReminderIcon(type)}
                       <span className="text-[7px] font-black uppercase tracking-tight truncate w-full text-center">{type}</span>
                     </button>
                   ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridade</label>
                <div className="flex gap-2">
                  {['baixa', 'media', 'alta'].map(p => (
                    <button
                      key={p}
                      onClick={() => setNewReminder({...newReminder, priority: p as any})}
                      className={`flex-1 p-3 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${newReminder.priority === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-[10px] font-bold dark:text-white border-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora</label>
                  <input type="time" value={selectedTime} onChange={e => setSelectedTime(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-[10px] font-bold dark:text-white border-none" />
                </div>
              </div>
              <button onClick={handleSaveReminder} className="w-full py-5 bg-indigo-600 text-white rounded-[1.8rem] font-black text-[10px] uppercase shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Criar Evento</button>
            </div>
          </div>
        </div>
      )}

      {isAddingGoal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[3rem] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Nova Meta</h3>
              <button onClick={() => setIsAddingGoal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={newGoal.title} onChange={e => setNewGoal({...newGoal, title: e.target.value})} placeholder="Ex: Viagem de Férias" className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-bold text-sm text-slate-800 dark:text-white" />
              <input type="number" value={newGoal.targetAmount || ''} onChange={e => setNewGoal({...newGoal, targetAmount: parseFloat(e.target.value)})} placeholder="Valor Alvo (R$)" className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black text-lg text-slate-800 dark:text-white" />
              <button onClick={handleSaveGoal} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all hover:bg-emerald-700">Criar Meta</button>
            </div>
          </div>
        </div>
      )}

      {isAddingAlert && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[3rem] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Novo Limite</h3>
              <button onClick={() => setIsAddingAlert(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-5">
              <select value={newAlert.category} onChange={e => setNewAlert({...newAlert, category: e.target.value as any})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-bold text-sm text-slate-800 dark:text-white border-none appearance-none">
                <option value="Geral">Todas as Categorias</option>
                {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="number" value={newAlert.threshold || ''} onChange={e => setNewAlert({...newAlert, threshold: parseFloat(e.target.value)})} placeholder="Valor Máximo (R$)" className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black text-lg text-slate-800 dark:text-white border-none" />
              <button onClick={() => { if(newAlert.threshold) onSaveAlert(newAlert as Omit<Alert, 'id'>); setIsAddingAlert(false); }} className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all hover:bg-rose-700">Definir Limite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assistant;
