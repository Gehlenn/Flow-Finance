import React, { ReactNode } from 'react';
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

class ErrorBoundaryComponent extends React.Component<Props, State> {
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
