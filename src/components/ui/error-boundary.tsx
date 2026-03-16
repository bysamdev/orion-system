import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-6 animate-in fade-in duration-500">
          <div className="p-4 bg-destructive/10 rounded-full">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight">Ops! Algo deu errado.</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Ocorreu um erro inesperado ao carregar esta seção. Tente recarregar a página ou entre em contato com o suporte.
            </p>
          </div>
          <Button 
            onClick={() => window.location.reload()} 
            className="rounded-2xl gap-2 font-bold px-8 shadow-lg shadow-primary/20"
          >
            <RefreshCw className="h-4 w-4" /> Recarregar Página
          </Button>
          {this.state.error && (
            <pre className="mt-4 p-4 bg-muted rounded-xl text-[10px] text-left overflow-auto max-w-full font-mono opacity-50">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
