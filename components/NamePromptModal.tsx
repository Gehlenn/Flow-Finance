
import React, { useState } from 'react';
import { User, Sparkles, Check } from 'lucide-react';

interface NamePromptModalProps {
  onSave: (name: string) => void;
}

const NamePromptModal: React.FC<NamePromptModalProps> = ({ onSave }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-slate-800 w-full max-w-[400px] rounded-[2.5rem] p-10 shadow-xl animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sparkles size={32} />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Primeiro Passo</h2>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-[0.08em] mt-2">Como você quer ser chamado?</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome ou apelido"
              className="w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-transparent focus:border-slate-300 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-700 dark:text-white outline-none transition-all"
            />
          </div>

          <button 
            type="submit"
            className="w-full py-5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-semibold text-xs uppercase tracking-[0.08em] shadow-xl hover:bg-slate-800 dark:hover:bg-white transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            Começar Agora <Check size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default NamePromptModal;




