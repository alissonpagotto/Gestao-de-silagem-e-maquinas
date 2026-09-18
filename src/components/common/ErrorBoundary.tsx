import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-[#1a1d24]">
          <div className="max-w-md w-full bg-[#252a34] border border-[#2f3644] rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                {this.props.fallbackTitle || 'Ocorreu um erro inesperado ao carregar este módulo'}
              </h3>
              <p className="text-xs text-[#8a92a6]">
                {this.props.fallbackDescription ||
                  'Os dados foram preservados com segurança. Clique no botão abaixo para tentar recarregar a visualização.'}
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-lg text-left overflow-auto max-h-24">
                <span className="text-[11px] font-mono text-rose-300 break-all block">
                  {this.state.error.message}
                </span>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar Novamente</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
