import React from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';

interface UpgradePromptCardProps {
  title: string;
  description: string;
  bullets: string[];
  compact?: boolean;
}

const UpgradePromptCard: React.FC<UpgradePromptCardProps> = ({
  title,
  description,
  bullets,
  compact = false,
}) => {
  return (
    <section className="rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm dark:border-indigo-500/20 dark:from-indigo-500/10 dark:to-slate-800">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-md shadow-indigo-500/30">
          {compact ? <Sparkles size={14} /> : <TrendingUp size={16} />}
        </div>
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-indigo-500">Plano Pro</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            â€¢ {bullet}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default UpgradePromptCard;




