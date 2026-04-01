import React from 'react';

interface DashboardProps {
  activeWorkspaceName?: string | null;
}

const Dashboard: React.FC<DashboardProps> = ({ activeWorkspaceName }) => {
  return (
    <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dashboard</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Visao Geral</h2>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-2 text-right dark:bg-slate-700">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Workspace ativo</p>
          <p className="text-sm font-black text-slate-700 dark:text-slate-100">
            {activeWorkspaceName || 'Carregando workspace'}
          </p>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
        O resumo financeiro exibido aqui reflete o workspace selecionado no momento.
      </p>
    </div>
  );
};

export default Dashboard;
