import React from "react";
import { Plus } from "lucide-react";

export interface AppFabProps {
  visible: boolean;
  onClick: () => void;
}

export const AppFab: React.FC<AppFabProps> = ({ visible, onClick }) => {
  if (!visible) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      aria-label="Adicionar lancamento"
      title="Adicionar lancamento"
      className="flow-fab fixed bottom-8 right-8 z-50 hidden h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.5)] transition-all duration-200 hover:bg-slate-800 active:scale-95 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white xl:flex"
    >
      <Plus size={24} strokeWidth={2.5} className="md:size-8" />
    </button>
  );
};
