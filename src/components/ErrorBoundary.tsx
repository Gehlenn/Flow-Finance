/**
 * ERROR BOUNDARY COMPONENT
 *
 * Catches rendering errors in React component tree and displays fallback UI.
 * Prevents entire app crash from single component failure.
 *
 * Usage:
 *   <ErrorBoundary fallback={<ErrorFallback />}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

import React, { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches errors in child components
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for development
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Report to Sentry
    Sentry.withScope((scope) => {
      scope.setTag('component', 'ErrorBoundary');
      scope.setTag('error_type', 'react_render_error');
      scope.setContext('error_info', {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'ErrorBoundary',
      });
      Sentry.captureException(error);
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.resetError);
      }

      return <DefaultErrorFallback error={this.state.error} onReset={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-red-500/20 rounded-full">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-white text-center mb-2">
          Algo deu errado
        </h1>

        {/* Description */}
        <p className="text-slate-300 text-center mb-4">
          Desculpe, encontramos um erro inesperado na aplicação. Tente recarregar ou entre em contato com o suporte.
        </p>

        {/* Error Details (Development Only) */}
        {import.meta.env.MODE === 'development' && error && (
          <div className="mb-4 p-3 bg-slate-900 rounded border border-slate-700">
            <p className="text-xs text-slate-400 font-mono mb-1">Detalhes do erro:</p>
            <p className="text-xs text-red-400 font-mono break-words">
              {error.message || 'Erro desconhecido'}
            </p>
            {error.stack && (
              <details className="mt-2">
                <summary className="text-xs text-slate-400 cursor-pointer">Stack trace</summary>
                <pre className="text-[10px] text-slate-500 mt-1 overflow-auto max-h-32">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Error Reporting */}
        <div className="mb-4 text-xs text-slate-400 text-center">
          <p>Erro ID: <code className="text-slate-500">{Date.now()}</code></p>
        </div>

        {/* Actions */}
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

        {/* Support Info */}
        <p className="text-xs text-slate-500 text-center mt-4">
          Se o problema persistir, entre em contato:
          <br />
          <a href="mailto:support@flowfinance.app" className="text-indigo-400 hover:underline">
            support@flowfinance.app
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * Hook to manually trigger errors for testing
 * Usage in tests: const throwError = useErrorHandler(); throwError(new Error('Test'));
 */
export function useErrorHandler() {
  return (error: Error) => {
    throw error;
  };
}
