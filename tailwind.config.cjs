/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  // CRITICAL: Force-include all color/style classes
  // Safelist is needed because Tailwind v4 can't detect classes in template literals with ternary operators
  safelist: [
    // Text colors
    'text-white', 'text-slate-300', 'text-slate-400', 'text-slate-500', 'text-slate-600', 'text-slate-700', 'text-slate-800', 'text-slate-900',
    'text-indigo-400', 'text-indigo-500', 'text-indigo-600', 'text-indigo-700',
    'text-violet-400', 'text-violet-500',
    'text-rose-400', 'text-rose-500', 'text-rose-600',
    'text-emerald-400', 'text-emerald-500', 'text-emerald-600',
    'text-amber-400', 'text-amber-500',
    'text-sky-400', 'text-sky-500', 'text-sky-600',
    'text-green-400', 'text-green-500',
    // Background colors
    'bg-slate-50', 'bg-slate-100', 'bg-slate-900', 'bg-slate-800', 'bg-slate-700',
    'bg-indigo-50', 'bg-indigo-500', 'bg-indigo-600', 'bg-indigo-700',
    'bg-violet-50', 'bg-violet-500',
    'bg-rose-50', 'bg-rose-500',
    'bg-emerald-50', 'bg-emerald-500',
    'bg-amber-50', 'bg-amber-500',
    'bg-sky-50', 'bg-sky-500',
    'bg-white', 'bg-transparent',
    // Dark mode colors
    'dark:text-white', 'dark:text-slate-300', 'dark:text-slate-400', 'dark:text-slate-500',
    'dark:text-indigo-400', 'dark:text-indigo-500',
    'dark:bg-slate-800', 'dark:bg-slate-900', 'dark:bg-slate-700', 'dark:bg-slate-600',
    'dark:bg-indigo-500',
    'dark:text-rose-500',
    'dark:bg-emerald-500',
    'dark:text-violet-500',
    // Opacity variants
    'bg-slate-900/50', 'bg-indigo-50/50', 'bg-indigo-600/20', 'bg-indigo-500/10', 'bg-indigo-500/20',
    'bg-rose-500/10', 'bg-emerald-500/10', 'bg-violet-500/10', 'bg-amber-500/10', 'bg-sky-500/10',
    'dark:bg-slate-900/50', 'dark:bg-indigo-500/10', 'dark:bg-indigo-500/20',
    'dark:bg-rose-500/10', 'dark:bg-emerald-500/10',
    'shadow-slate-200/50', 'shadow-indigo-600/20', 'shadow-indigo-500/10', 'shadow-indigo-100', 'shadow-emerald-200',
    // Common utilities
    'scale-110', 'scale-100', 'scale-95', 'scale-90',
    'opacity-0', 'opacity-50', 'opacity-70', 'opacity-100',
    'font-black', 'font-bold',
    'text-sm', 'text-xs',
    'text-[11px]', 'text-[10px]', 'text-[9px]', 'text-[8px]', 'text-[7px]',
    'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full',
    'shadow-md', 'shadow-sm', 'shadow-lg', 'shadow-2xl', 'shadow-none',
    'border', 'border-2',
    'border-slate-200', 'border-slate-700', 'border-indigo-200', 'border-indigo-500', 'border-indigo-600',
    'border-transparent',
    'transition-all', 'transition-colors',
    'cursor-pointer', 'cursor-not-allowed',
    'dark:border-slate-700', 'dark:border-slate-800', 'dark:border-indigo-800', 'dark:border-indigo-500/20',
    'dark:text-slate-600', 'dark:hover:bg-slate-700', 'dark:hover:bg-slate-900/50', 'dark:hover:bg-indigo-500/20',
    'dark:hover:text-slate-600',
    'border-t', 'border-b', 'border-dashed', 'border-none',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-wiggle': 'pulse-wiggle 6s ease-in-out infinite',
        'pulse-subtle': 'pulse-subtle 4s ease-in-out infinite',
        'float': 'float 5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-wiggle': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '25%': { transform: 'scale(1.005) rotate(0.2deg)' },
          '50%': { transform: 'scale(1) rotate(0deg)' },
          '75%': { transform: 'scale(1.005) rotate(-0.2deg)' },
        },
        'pulse-subtle': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.01)', opacity: '0.98' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
