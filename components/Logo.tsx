import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const sizes = {
    sm: { icon: 32, text: 'text-xl', gap: 'gap-2', container: 'w-10 h-10' },
    md: { icon: 60, text: 'text-2xl', gap: 'gap-3', container: 'w-20 h-20' },
    lg: { icon: 120, text: 'text-5xl', gap: 'gap-5', container: 'w-40 h-40' },
    xl: { icon: 160, text: 'text-7xl', gap: 'gap-6', container: 'w-56 h-56' },
  };

  const s = sizes[size];

  return (
    <div className={`flex items-center ${s.gap} ${className} select-none group cursor-pointer overflow-visible`}>
      {/* Container Esmaecido (Efeito de Sombra/Aura) - overflow-visible para não cortar animação */}
      <div className={`${s.container} relative flex items-center justify-center transition-all duration-700 group-hover:scale-110 active:scale-95 overflow-visible`}>
        
        {/* Aura Suave (Expandida e sem cortes) */}
        <div className="absolute inset-[-40%] bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-1000 animate-breath pointer-events-none"></div>
        
        {/* Camada de esmaecimento de borda (Shadow Glow mais amplo) */}
        <div className="absolute inset-[-20%] bg-[radial-gradient(circle,_rgba(99,102,241,0.1)_0%,_rgba(99,102,241,0)_75%)] rounded-full pointer-events-none"></div>
        
        {/* Ícone Principal - overflow-visible é CRÍTICO aqui */}
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 animate-natural-float p-1 overflow-visible"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>

          {/* Stem Pulse */}
          <path 
            d="M38 22V78" 
            stroke="url(#flowGradient)" 
            strokeWidth="8.5" 
            strokeLinecap="round"
            className="opacity-95"
          />
          
          {/* Strategy Wave 1 */}
          <path 
            d="M38 28C48 18 68 18 83 33" 
            stroke="url(#flowGradient)" 
            strokeWidth="8.5" 
            strokeLinecap="round"
            className="transition-all duration-700 group-hover:translate-x-2"
          />

          {/* Growth Wave 2 */}
          <path 
            d="M38 53C48 43 63 43 73 58" 
            stroke="url(#flowGradient)" 
            strokeWidth="8.5" 
            strokeLinecap="round"
            className="transition-all duration-1000 group-hover:translate-x-4"
          />

          {/* Intelligence Point */}
          <circle 
            cx="83" cy="33" r="5" 
            fill="#22D3EE" 
            className="animate-ping-slow"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className={`${s.text} font-black text-slate-900 dark:text-white tracking-tighter leading-none transition-all duration-500 group-hover:tracking-normal`}>
            Flow
          </span>
          <div className="flex items-center gap-2 mt-1 opacity-50 group-hover:opacity-100 transition-opacity">
            <div className="h-px w-4 bg-indigo-500"></div>
            <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.4em]">
              Finance AI
            </span>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes natural-float {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
          33% { transform: translateY(-8px) translateX(2px) rotate(1deg); }
          66% { transform: translateY(-4px) translateX(-2px) rotate(-1deg); }
        }
        @keyframes breath {
          0%, 100% { transform: scale(0.9); opacity: 0.4; filter: blur(20px); }
          50% { transform: scale(1.3); opacity: 0.8; filter: blur(15px); }
        }
        @keyframes ping-slow {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 1; filter: drop-shadow(0 0 10px #22D3EE); }
        }
        .animate-natural-float {
          animation: natural-float 7s ease-in-out infinite;
        }
        .animate-breath {
          animation: breath 9s ease-in-out infinite;
        }
        .animate-ping-slow {
          animation: ping-slow 4s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};

export default Logo;