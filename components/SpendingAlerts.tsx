
import React, { useState } from 'react';
import { Alert, Category, Transaction, TransactionType } from '../types';
import { Plus, Trash2, Bell, AlertTriangle, Check, X, ShieldAlert, TrendingDown } from 'lucide-react';

interface SpendingAlertsProps {
  transactions: Transaction[];
  alerts: Alert[];
  onSaveAlert: (alert: Alert) => void;
  onDeleteAlert: (id: string) => void;
  hideValues: boolean;
}

const SpendingAlerts: React.FC<SpendingAlertsProps> = ({ transactions, alerts, onSaveAlert, onDeleteAlert, hideValues }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [newAlert, setNewAlert] = useState<Partial<Alert>>({
    category: 'Geral',
    threshold: 0,
    timeframe: 'mensal'
  });

  const getSpentAmount = (alert: Alert) => {
    const now = new Date();
    return transactions.filter(t => {
      if (t.type !== TransactionType.DESPESA) return false;
      if (alert.category !== 'Geral' && t.category !== alert.category) return false;
      
      const tDate = new Date(t.date);
      if (alert.timeframe === 'semanal') {
        const diff = (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
        return diff <= 7;
      }
      return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
    }).reduce((acc, t) => acc + t.amount, 0);
  };

  const handleSave = () => {
    if (!newAlert.threshold || newAlert.threshold <= 0) return;
    
    setIsSuccess(true);
    
    setTimeout(() => {
      onSaveAlert({
        ...newAlert,
        id: Math.random().toString(36).substr(2, 9),
      } as Alert);
      setIsAdding(false);
      setIsSuccess(false);
      setNewAlert({ category: 'Geral', threshold: 0, timeframe: 'mensal' });
    }, 1000);
  };

  const formatCurrency = (val: number) => hideValues ? 'R$ ••••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Limites de Gastos</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Controle seu fluxo de caixa</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus size={16} strokeWidth={3} /> Definir Limite
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {alerts.length > 0 ? (
          alerts.map((alert) => {
            const spent = getSpentAmount(alert);
            const percent = Math.min((spent / alert.threshold) * 100, 100);
            const isExceeded = spent > alert.threshold;
            const isWarning = percent > 80;

            return (
              <div key={alert.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${isExceeded ? 'bg-rose-50 text-rose-500' : isWarning ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
                      {isExceeded ? <ShieldAlert size={20} /> : <Bell size={20} />}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 tracking-tight">{alert.category}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{alert.timeframe}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDeleteAlert(alert.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consumido</p>
                      <p className={`text-2xl font-black tracking-tighter ${isExceeded ? 'text-rose-600' : 'text-slate-900'}`}>
                        {formatCurrency(spent)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Limite</p>
                      <p className="text-sm font-bold text-slate-600">{formatCurrency(alert.threshold)}</p>
                    </div>
                  </div>

                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-600'}`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className={isExceeded ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-slate-400'}>
                      {isExceeded ? 'Limite Excedido!' : isWarning ? 'Atenção: 80% do limite' : 'Dentro do limite'}
                    </span>
                    <span className="text-slate-500">{Math.round(percent)}%</span>
                  </div>
                </div>

                {isExceeded && (
                  <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-rose-50 rounded-full blur-2xl opacity-50"></div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <TrendingDown size={32} />
            </div>
            <p className="text-slate-500 font-bold">Nenhum limite configurado</p>
            <p className="text-xs text-slate-400 mt-1 uppercase font-black tracking-widest">Defina metas para economizar mais</p>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Novo Limite</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                <select 
                  value={newAlert.category}
                  onChange={(e) => setNewAlert({...newAlert, category: e.target.value as any})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 outline-none font-bold text-slate-700"
                >
                  <option value="Geral">Todas as Categorias</option>
                  <option value={Category.PESSOAL}>Pessoal</option>
                  <option value={Category.CONSULTORIO}>Profissional</option>
                  <option value={Category.NEGOCIO}>Negócio</option>
                  <option value={Category.INVESTIMENTO}>Investimento</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Limite (R$)</label>
                <input 
                  type="number"
                  value={newAlert.threshold}
                  onChange={(e) => setNewAlert({...newAlert, threshold: parseFloat(e.target.value)})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500/20 outline-none text-xl font-black text-slate-800"
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Período</label>
                <div className="flex gap-2 bg-slate-50 p-1 rounded-2xl">
                  {(['mensal', 'semanal'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setNewAlert({...newAlert, timeframe: p})}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newAlert.timeframe === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleSave}
                disabled={!newAlert.threshold || newAlert.threshold <= 0 || isSuccess}
                className={`w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 ${isSuccess ? 'scale-[1.05] bg-emerald-500 shadow-emerald-200' : 'active:scale-95'}`}
              >
                {isSuccess ? <><Check size={18} strokeWidth={3} /> Salvo!</> : <><Check size={18} strokeWidth={3} /> Ativar Limite</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpendingAlerts;
