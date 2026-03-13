import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportError } from '../config/sentry';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function DefaultErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const isDynamicImportError = error?.message?.includes('Failed to fetch dynamically imported module');
  const errorId = Date.now();

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
          {isDynamicImportError
            ? 'Houve um problema ao carregar esta página. Por favor, recarregue o aplicativo.'
            : 'Desculpe, encontramos um erro inesperado na aplicação. Tente recarregar ou entre em contato com o suporte.'}
        </p>

        {import.meta.env.MODE === 'development' && error && (
          <div className="mb-4 p-3 bg-slate-900 rounded border border-slate-700">
            <p className="text-xs text-red-400 font-mono break-words">{error.message || 'Erro desconhecido'}</p>
          </div>
        )}

        <p className="text-xs text-slate-500 text-center mb-4">
          Erro ID: {errorId}
        </p>

        <div className="flex gap-3">
          {isDynamicImportError ? (
            <button
              onClick={() => {
                // Clear service worker cache and reload
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then((regs) => {
                    regs.forEach((reg) => reg.unregister());
                    caches.keys().then((keys) => {
                      Promise.all(keys.map((key) => caches.delete(key))).then(() => {
                        window.location.reload();
                      });
                    });
                  });
                } else {
                  window.location.reload();
                }
              }}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
            >
              Recarregar Aplicação
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

class ErrorBoundaryComponent extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, { componentStack: errorInfo.componentStack || '' });
    reportError(error, { componentStack: errorInfo.componentStack || 'unknown' });
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error || new Error('Unknown error'), this.reset);
      }
      return <DefaultErrorFallback error={this.state.error} onReset={this.reset} />;
    }

    return this.props.children;
  }
}

export const ErrorBoundary: React.FC<Props> = ({ children, fallback, onError }) => (
  <ErrorBoundaryComponent fallback={fallback} onError={onError}>
    {children}
  </ErrorBoundaryComponent>
);

export function useErrorHandler() {
  return (error: Error) => {
    throw error;
  };
}
