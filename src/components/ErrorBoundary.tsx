import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

function DefaultErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-red-500/20 rounded-full">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white text-center mb-2">Algo deu errado</h1>
        <p className="text-slate-300 text-center mb-4">
          Desculpe, encontramos um erro inesperado na aplicacao. Tente recarregar ou entre em contato com o suporte.
        </p>

        {import.meta.env.MODE === 'development' && error && (
          <div className="mb-4 p-3 bg-slate-900 rounded border border-slate-700">
            <p className="text-xs text-red-400 font-mono break-words">{error.message || 'Erro desconhecido'}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => location.reload()}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
          >
            Recarregar
          </button>
          <button
            onClick={onReset}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} />
            Tentar Novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export const ErrorBoundary: React.FC<Props> = ({ children, fallback, onError }) => {
  const sentryAny = Sentry as any;
  const SentryBoundary = sentryAny.ErrorBoundary as React.ComponentType<any> | undefined;

  if (!SentryBoundary) {
    return <>{children}</>;
  }

  return (
    <SentryBoundary
      onError={(error: Error, errorInfo: { componentStack: string }) => onError?.(error, errorInfo)}
      fallback={({ error, resetError }: { error: Error; resetError: () => void }) =>
        fallback ? fallback(error, resetError) : <DefaultErrorFallback error={error} onReset={resetError} />
      }
    >
      {children}
    </SentryBoundary>
  );
};

export function useErrorHandler() {
  return (error: Error) => {
    throw error;
  };
}
