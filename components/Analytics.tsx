
import React, { useMemo, useState, useRef } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import { GeminiService } from '../services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Calendar, TrendingUp, PieChart as PieIcon, Info, Sparkles, 
  X, Lightbulb, Target, ArrowRight, Loader2, AlertCircle, 
  Coins, BrainCircuit, BarChart3, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';

interface AnalyticsProps {
  transactions: Transaction[];
  hideValues: boolean;
}

interface InsightTip {
  title: string;
  description: string;
  type: 'economy' | 'investment' | 'habit' | 'alert';
}

const Analytics: React.FC<AnalyticsProps> = ({ transactions, hideValues }) => {
  const [timeframe, setTimeframe] = useState<'semanal' | 'mensal' | 'anual'>('mensal');
  const [isConsultancyOpen, setIsConsultancyOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tips, setTips] = useState<InsightTip[]>([]);
  
  const gemini = useRef(new GeminiService());
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const filteredData = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      if (timeframe === 'semanal') return (now.getTime() - d.getTime()) / (1000 * 3600 * 24) <= 7;
      if (timeframe === 'mensal') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return d.getFullYear() === now.getFullYear();
    });
  }, [transactions, timeframe]);

  // Dados para o Gráfico 1: Comparativo Receita x Despesa
  const comparisonData = useMemo(() => {
    const totals = filteredData.reduce((acc, curr) => {
      if (curr.type === TransactionType.RECEITA) acc.receita += curr.amount;
      else acc.despesa += curr.amount;
      return acc;
    }, { receita: 0, despesa: 0 });

    return [
      { name: 'Receitas', value: totals.receita, color: '#6366f1' },
      { name: 'Despesas', value: totals.despesa, color: '#f43f5e' }
    ];
  }, [filteredData]);

  // Dados para o Gráfico 2 e 3: Categorias
  const categoryData = useMemo(() => {
    const map = filteredData
      .filter(t => t.type === TransactionType.DESPESA)
      .reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
      }, {} as Record<string, number>);
    
    return Object.keys(map)
      .map(key => ({ name: key, value: map[key] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const stats = useMemo(() => {
    const totalDespesa = categoryData.reduce((acc, curr) => acc + curr.value, 0);
    const avgDiaria = totalDespesa / (timeframe === 'semanal' ? 7 : 30);
    const maxGasto = filteredData.length > 0 ? Math.max(...filteredData.map(t => t.amount)) : 0;
    return { totalDespesa, avgDiaria, maxGasto };
  }, [categoryData, filteredData, timeframe]);

  const formatCurrency = (val: number) => hideValues ? 'R$ ••••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleOpenConsultancy = async () => {
    setIsConsultancyOpen(true);
    setIsGenerating(true);
    try {
      // Calls generateFinancialConsultancy now properly defined in GeminiService
      const result = await gemini.current.generateFinancialConsultancy(transactions);
      setTips(result);
    } catch (error) {
      console.error("Erro ao gerar consultoria", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getTipIcon = (type: string) => {
    switch (type) {
      case 'economy': return <Coins className="text-emerald-500" />;
      case 'investment': return <TrendingUp className="text-indigo-500" />;
      case 'habit': return <Target className="text-amber-500" />;
      case 'alert': return <AlertCircle className="text-rose-500" />;
      default: return <Lightbulb className="text-slate-500" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Estatísticas</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Análise aprofundada de valores</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          {(['semanal', 'mensal', 'anual'] as const).map(t => (
            <button key={t} onClick={() => setTimeframe(t)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === t ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* Grid de Métricas de Apoio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Média Diária de Gastos</p>
          <p className="text-xl font-black text-slate-800 tracking-tight">{formatCurrency(stats.avgDiaria)}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Maior Lançamento Único</p>
          <p className="text-xl font-black text-rose-500 tracking-tight">{formatCurrency(stats.maxGasto)}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume de Transações</p>
          <p className="text-xl font-black text-indigo-600 tracking-tight">{filteredData.length} itens</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* GRÁFICO 1: COMPARATIVO GLOBAL */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <BarChart3 className="text-indigo-600" size={20} />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Comparativo Global</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis hide />
                <Tooltip cursor={{fill: '#f8fafc'}} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={60}>
                  {comparisonData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
             <div className="p-4 bg-indigo-50/50 rounded-2xl flex items-center gap-3">
                <ArrowUpCircle className="text-indigo-500" size={18} />
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Receita</p>
                  <p className="text-xs font-black text-slate-800">{formatCurrency(comparisonData[0].value)}</p>
                </div>
             </div>
             <div className="p-4 bg-rose-50/50 rounded-2xl flex items-center gap-3">
                <ArrowDownCircle className="text-rose-500" size={18} />
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Despesa</p>
                  <p className="text-xs font-black text-slate-800">{formatCurrency(comparisonData[1].value)}</p>
                </div>
             </div>
          </div>
        </div>

        {/* GRÁFICO 2: COMPOSIÇÃO DE GASTOS */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <PieIcon className="text-indigo-600" size={20} />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Composição de Gastos</h3>
          </div>
          <div className="h-[250px] w-full relative">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Sem despesas no período</div>
            )}
          </div>
          <div className="mt-8 space-y-3">
            {categoryData.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-300">{Math.round((item.value / stats.totalDespesa) * 100)}%</span>
                  <span className="text-xs font-black text-slate-800">{formatCurrency(item.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRÁFICO 3: RANKING DE CATEGORIAS (Barras Horizontais) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm lg:col-span-2">
           <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <Target className="text-indigo-600" size={20} />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Ranking de Categorias</h3>
              </div>
              <div className="px-4 py-1.5 bg-slate-50 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">
                 Peso no Orçamento
              </div>
           </div>

           <div className="space-y-6">
              {categoryData.map((item, i) => {
                const percent = (item.value / stats.totalDespesa) * 100;
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                       <span className="text-slate-700">{item.name}</span>
                       <span className="text-slate-400">{formatCurrency(item.value)} <span className="text-indigo-500 ml-2">({Math.round(percent)}%)</span></span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                       <div 
                         className="h-full rounded-full transition-all duration-1000" 
                         style={{ 
                           width: `${percent}%`, 
                           backgroundColor: COLORS[i % COLORS.length],
                           boxShadow: `0 0 10px ${COLORS[i % COLORS.length]}40`
                         }}
                       ></div>
                    </div>
                  </div>
                );
              })}
              {categoryData.length === 0 && (
                <div className="py-10 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Aguardando dados...</div>
              )}
           </div>
        </div>

        {/* Insight IA Card */}
        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 lg:col-span-2 shadow-2xl shadow-slate-200">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-indigo-400 shrink-0">
              <Sparkles size={32} />
            </div>
            <div>
              <h4 className="text-xl font-black tracking-tight mb-1">Precisa de uma análise estratégica?</h4>
              <p className="text-sm text-slate-400 font-medium">Nossa IA pode gerar um relatório detalhado com base nestes gráficos.</p>
            </div>
          </div>
          <button 
            onClick={handleOpenConsultancy}
            className="w-full md:w-auto px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-indigo-900/20"
          >
            <BrainCircuit size={18} /> Iniciar Consultoria IA
          </button>
        </div>
      </div>

      {/* Reutilizando o Modal de Consultoria Financeira existente */}
      {isConsultancyOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-lg z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-50 w-full max-w-2xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            
            <div className="p-8 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  <BrainCircuit size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Flow Consultant</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estratégias baseadas nos seus dados</p>
                </div>
              </div>
              <button 
                onClick={() => setIsConsultancyOpen(false)}
                className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6">
              {isGenerating ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <Loader2 size={48} className="text-indigo-600 animate-spin" strokeWidth={3} />
                    <Sparkles size={20} className="text-indigo-400 absolute -top-2 -right-2 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-slate-800 animate-pulse">Analisando seus hábitos...</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Cruzando dados de receitas e despesas</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tips.map((tip, idx) => (
                      <div 
                        key={idx} 
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500"
                        style={{ animationDelay: `${idx * 150}ms` }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-3 bg-slate-50 rounded-2xl">
                            {getTipIcon(tip.type)}
                          </div>
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">#{tip.type}</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-800 mb-2 leading-tight uppercase tracking-tight">{tip.title}</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed flex-grow">
                          {tip.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-6 bg-white border-t border-slate-100 shrink-0 text-center">
              <button 
                onClick={() => setIsConsultancyOpen(false)}
                className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
              >
                Entendido, vamos lá!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
