
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import { formatCurrency } from '../utils/helpers';
import { GeminiService } from '../services/geminiService';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, Target, PieChart as PieIcon, BrainCircuit, X, Loader2, 
  Calendar, CheckCircle2, AlertTriangle, Lightbulb, Share2, MessageCircle, FileText, Download, Mail, Check
} from 'lucide-react';

interface CashFlowProps {
  transactions: Transaction[];
  hideValues: boolean;
  theme: 'light' | 'dark';
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; name?: string }[];
  label?: string;
  hideValues: boolean;
  isPercentage?: boolean;
  total?: number;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, hideValues, isPercentage = false, total = 1 }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;

    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label || payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-black text-slate-900 dark:text-white">{hideValues ? 'R$ ••••' : formatCurrency(value)}</p>
          {isPercentage && (
            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">
              {percent}%
            </span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const CashFlow: React.FC<CashFlowProps> = ({ transactions, hideValues, theme }) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '12m' | 'custom'>('30d');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [isConsultancyOpen, setIsConsultancyOpen] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  
  const gemini = useRef(new GeminiService());
  const isDark = theme === 'dark';
  const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(148, 163, 184, 0.1)";

  // Carregar relatório persistente do dia, se existir
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const savedReport = localStorage.getItem(`flow_report_${today}`);
    if (savedReport) {
      setReport(JSON.parse(savedReport));
    }
  }, []);

  useEffect(() => {
    if (showCopyToast) {
      const timer = setTimeout(() => setShowCopyToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showCopyToast]);

  const fmt = (val: number) => hideValues ? 'R$ ••••' : formatCurrency(val);

  const filtered = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      if (timeframe === '7d') return (now.getTime() - d.getTime()) / 86400000 <= 7;
      if (timeframe === '30d') return (now.getTime() - d.getTime()) / 86400000 <= 30;
      if (timeframe === '12m') return d.getFullYear() === now.getFullYear();
      if (timeframe === 'custom') {
        const start = dateStart ? new Date(dateStart + 'T00:00:00') : new Date(0);
        const end = dateEnd ? new Date(dateEnd + 'T23:59:59') : new Date();
        return d >= start && d <= end;
      }
      return true;
    });
  }, [transactions, timeframe, dateStart, dateEnd]);

  const totalsByPeriod = useMemo(() => {
    const expenses = filtered.filter(t => t.type === TransactionType.DESPESA).reduce((a, b) => a + b.amount, 0);
    const income = filtered.filter(t => t.type === TransactionType.RECEITA).reduce((a, b) => a + b.amount, 0);
    return { expenses, income };
  }, [filtered]);

  const timelineData = useMemo(() => {
    const dataMap: Record<string, { date: string, rawDate: string, incoming: number, outgoing: number }> = {};
    filtered.forEach(t => {
      const key = new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const rawKey = new Date(t.date).toISOString().split('T')[0];
      if (!dataMap[key]) dataMap[key] = { date: key, rawDate: rawKey, incoming: 0, outgoing: 0 };
      if (t.type === TransactionType.RECEITA) dataMap[key].incoming += t.amount;
      else dataMap[key].outgoing += t.amount;
    });
    return Object.values(dataMap).sort((a,b) => a.rawDate.localeCompare(b.rawDate));
  }, [filtered]);

  const categoryData = useMemo(() => {
    const map = filtered.filter(t => t.type === TransactionType.DESPESA).reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);
    return Object.keys(map).map(key => ({ 
      name: key, 
      value: map[key]
    })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const handleGenerateReport = async () => {
    if (report) {
      setIsConsultancyOpen(true);
      return;
    }
    setIsConsultancyOpen(true);
    setIsGenerating(true);
    try {
      const strategicReport = await gemini.current.generateStrategicReport(filtered);
      setReport(strategicReport);
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`flow_report_${today}`, JSON.stringify(strategicReport));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = (method: 'whatsapp' | 'email' | 'copy') => {
    let shareText = `📊 *RELATÓRIO DE FLUXO FLOW* 🌊\n\n`;
    shareText += `📅 *Período:* ${timeframe === 'custom' ? `${dateStart} a ${dateEnd}` : timeframe.toUpperCase()}\n`;
    shareText += `🟢 *Entradas:* ${formatCurrency(totalsByPeriod.income)}\n`;
    shareText += `🔴 *Saídas:* ${formatCurrency(totalsByPeriod.expenses)}\n`;
    shareText += `💰 *Saldo Líquido:* ${formatCurrency(totalsByPeriod.income - totalsByPeriod.expenses)}\n\n`;
    
    if (report) {
      shareText += `🧠 *Prioridade Flow - Diagnóstico:* \n${report.executiveSummary || ''}\n\n`;
      if (report.actionPlan && Array.isArray(report.actionPlan)) {
        shareText += `💡 *Plano de Ação:* \n${report.actionPlan.map((s: string) => `✅ ${s}`).join('\n')}`;
      }
    }

    if (method === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
    } else if (method === 'email') {
      window.location.href = `mailto:?subject=Relatorio de Fluxo Flow&body=${encodeURIComponent(shareText)}`;
    } else if (method === 'copy') {
      navigator.clipboard.writeText(shareText);
      setShowCopyToast(true);
    }
    setIsShareModalOpen(false);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-700 pb-20 overflow-visible relative">
      <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Fluxo</h2>
          <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Análise de Performance</p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white">
          <TrendingUp size={22} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex flex-1 bg-white dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto no-scrollbar">
            {['7d', '30d', '12m', 'custom'].map(t => (
              <button key={t} onClick={() => setTimeframe(t as any)} className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1 ${timeframe === t ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-500'}`}>
                {t === 'custom' ? 'Calendário' : t}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsShareModalOpen(true)}
            className="p-3 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <Share2 size={18} />
          </button>
        </div>

        {timeframe === 'custom' && (
          <div className="grid grid-cols-2 gap-3 px-1 animate-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Início</label>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-bold outline-none dark:text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Fim</label>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-bold outline-none dark:text-white" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] overflow-hidden min-h-[220px]">
        <h3 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Calendar size={14} /> Evolução de Caixa</h3>
        <div className="h-[220px] w-full" style={{ minHeight: '220px' }}>
          <ResponsiveContainer width="100%" height={220} minWidth={0}>
            <AreaChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip hideValues={hideValues} />} />
              <Area type="monotone" name="Entradas" dataKey="incoming" stroke="#10b981" fill="#10b981" fillOpacity={0.05} strokeWidth={2.5} />
              <Area type="monotone" name="Saídas" dataKey="outgoing" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.05} strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden min-h-[220px]">
          <h3 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><PieIcon size={14} /> Composição</h3>
          <div className="h-[220px] w-full" style={{ minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <PieChart>
                <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip hideValues={hideValues} isPercentage total={totalsByPeriod.expenses} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden min-h-[220px]">
          <h3 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Target size={14} /> Ranking</h3>
          <div className="h-[220px] w-full" style={{ minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: -30, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: isDark ? '#64748b' : '#94a3b8' }} />
                <Tooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.05)' }} content={<CustomTooltip hideValues={hideValues} isPercentage total={totalsByPeriod.expenses} />} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={16}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="w-full overflow-visible py-4">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 flex flex-col justify-between border border-indigo-500/10 shadow-[0_30px_60px_-15px_rgba(79,70,229,0.3)] animate-pulse-wiggle relative overflow-visible">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.1)_0%,_transparent_60%)] pointer-events-none rounded-[2.5rem]"></div>
          <div className="flex items-start gap-5 relative z-10">
             <div className="w-14 h-14 bg-indigo-600/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-indigo-400 shrink-0 shadow-inner border border-indigo-500/30">
               <Target size={28} />
             </div>
             <div>
               <h4 className="text-sm font-black tracking-tight uppercase text-indigo-400">Prioridade Flow</h4>
               <p className="text-[12px] text-slate-200 font-medium leading-relaxed mt-1.5 opacity-90">Diagnóstico estratégico de alto impacto.</p>
             </div>
          </div>
          <button 
            onClick={handleGenerateReport}
            className="w-full py-5 bg-indigo-600 text-white rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 mt-8 active:scale-95 transition-all relative z-10 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <BrainCircuit size={20} className="group-hover:rotate-12 transition-transform" /> {report ? 'Abrir Relatório' : 'Gerar Relatório'}
          </button>
        </div>
      </div>

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Exportar Fluxo</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="p-1 text-slate-400"><X size={20} /></button>
            </div>
            
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
               <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Resumo Incluído</p>
               <div className="space-y-1">
                 <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">• Dados de Entradas/Saídas</p>
                 <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">• Divisão por Categorias</p>
                 {report && <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">• Prioridade Flow (Análise IA)</p>}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleShare('whatsapp')} className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all">
                <MessageCircle className="text-emerald-500" size={24} />
                <span className="text-[8px] font-black text-emerald-600 uppercase">WhatsApp</span>
              </button>
              <button onClick={() => handleShare('copy')} className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all">
                <FileText className="text-indigo-500" size={24} />
                <span className="text-[8px] font-black text-indigo-600 uppercase">Copiar Texto</span>
              </button>
              <button onClick={() => handleShare('email')} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all col-span-2">
                <Mail className="text-slate-500" size={24} />
                <span className="text-[8px] font-black text-slate-500 uppercase">Enviar por E-mail</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showCopyToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[400] transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-black text-[10px] uppercase tracking-widest border border-white/20">
            <Check size={16} strokeWidth={3} /> Copiado para a área de transferência!
          </div>
        </div>
      )}

      {isConsultancyOpen && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-[3.5rem] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Estratégia Flow</h3>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Auditado por Inteligência Artificial</p>
              </div>
              <button onClick={() => setIsConsultancyOpen(false)} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-full text-slate-400"><X size={20} /></button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
              {isGenerating ? (
                <div className="py-24 flex flex-col items-center gap-5 text-center text-indigo-600 font-black uppercase tracking-widest">
                  <Loader2 size={40} className="animate-spin" strokeWidth={3} />
                  <p className="text-[11px]">Auditando movimentações...</p>
                </div>
              ) : report && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <h4 className="text-[10px] font-black text-indigo-600 mb-2 uppercase tracking-widest flex items-center gap-2"><Target size={14}/> Diagnóstico Executivo</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-bold leading-relaxed">{report.executiveSummary}</p>
                  </div>
                  <div className="p-6 bg-indigo-600 text-white rounded-[2.5rem] shadow-xl">
                    <h4 className="text-[10px] font-black uppercase mb-4 tracking-widest flex items-center gap-2"><Lightbulb size={16}/> Plano de Ação</h4>
                    <ul className="space-y-3">
                      {report.actionPlan && Array.isArray(report.actionPlan) && report.actionPlan.map((step: string, i: number) => (
                        <li key={i} className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</span>
                          <span className="text-[11px] font-bold leading-tight">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-3">
              <button onClick={() => setIsConsultancyOpen(false)} className="flex-1 py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95">Sair</button>
              <button onClick={() => handleShare('whatsapp')} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2">
                <MessageCircle size={16} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashFlow;
