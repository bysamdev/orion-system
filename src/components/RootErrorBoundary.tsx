import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Trash2, RotateCcw, Copy, Check, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

/**
 * Sanitize error messages and stack traces to ensure no sensitive
 * credentials, tokens, or private information are leaked in the UI.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Erro desconhecido';

  return message
    // Mask Bearer tokens / JWTs
    .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_JWT]')
    // Mask Supabase / API keys
    .replace(/sbp_[a-zA-Z0-9_-]+/g, '[REDACTED_KEY]')
    .replace(/anon_key=[^&\s]+/gi, 'anon_key=[REDACTED]')
    .replace(/apikey=[^&\s]+/gi, 'apikey=[REDACTED]')
    // Mask passwords in URLs / JSON
    .replace(/password["':\s=]+[^&"\s,]+/gi, 'password="[REDACTED]"')
    // Mask connection strings
    .replace(/postgres(ql)?:\/\/[^@]+@/gi, 'postgres://[REDACTED_USER_PASS]@');
}

export function clearApplicationCache(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (e) {
    console.error('[RootErrorBoundary] Erro ao limpar storage:', e);
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name).catch(() => {});
        });
      }).catch(() => {});
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

export class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Erro capturado na árvore React:', error, errorInfo);
    this.setState({ errorInfo });

    // Auto-reload on stale dynamically imported chunks from previous deploy
    const msg = String(error?.message || '');
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('ChunkLoadError')
    ) {
      console.warn('[RootErrorBoundary] Falha de chunk dinâmico detectada. Recarregando versão mais recente...');
      if (typeof window !== 'undefined') {
        const lastReload = sessionStorage.getItem('orion_last_chunk_reload');
        const now = Date.now();
        if (!lastReload || now - Number(lastReload) > 10000) {
          sessionStorage.setItem('orion_last_chunk_reload', String(now));
          window.location.reload();
        }
      }
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleClearCacheAndReload = () => {
    clearApplicationCache();
  };

  private handleCopyDetails = () => {
    const rawError = this.state.error?.stack || this.state.error?.message || 'Nenhum detalhe disponível';
    const sanitized = sanitizeErrorMessage(rawError);
    const report = [
      `=== Orion System - Relatório de Erro ===`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      `Mensagem: ${sanitizeErrorMessage(this.state.error?.message || '')}`,
      `Detalhes/Stack:`,
      sanitized,
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(report).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2500);
      }).catch(() => {});
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const rawMsg = this.state.error?.message || 'Falha inesperada durante a renderização.';
      const sanitizedMsg = sanitizeErrorMessage(rawMsg);
      const isChunkError =
        rawMsg.includes('Failed to fetch dynamically imported module') ||
        rawMsg.includes('Importing a module script failed') ||
        rawMsg.includes('error loading dynamically imported module');

      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 select-text">
          <div className="max-w-xl w-full bg-card border border-border/80 shadow-2xl rounded-xl p-6 sm:p-8 space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            {/* Header Icon */}
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 text-destructive shadow-lg shadow-destructive/5">
                <AlertCircle className="h-12 w-12 stroke-[2.2]" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/80">
                Orion System • Recuperação de Falhas
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Ocorreu um erro inesperado
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {isChunkError
                  ? 'Uma nova versão do sistema foi disponibilizada ou a conexão oscilou durante o carregamento.'
                  : 'A aplicação encontrou uma instabilidade ao trocar de tela. Suas informações e sessão continuam seguras.'}
              </p>
            </div>

            {/* Sanitized summary banner */}
            <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60 text-left text-xs font-mono text-muted-foreground flex items-start gap-2.5 overflow-hidden">
              <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <span className="truncate flex-1 font-medium">{sanitizedMsg}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                onClick={this.handleReload}
                className="w-full sm:w-auto font-bold gap-2 rounded-md shadow-lg shadow-primary/20 h-10 px-5"
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar Sistema
              </Button>

              <Button
                variant="outline"
                onClick={this.handleClearCacheAndReload}
                className="w-full sm:w-auto font-bold gap-2 rounded-md border-border/70 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 h-10 px-4 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Limpar Cache e Reiniciar
              </Button>

              <Button
                variant="ghost"
                onClick={this.handleReset}
                className="w-full sm:w-auto font-bold gap-2 rounded-md h-10 px-4 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                Tentar Novamente
              </Button>
            </div>

            {/* Technical details toggle & copy */}
            <div className="border-t border-border/40 pt-4 text-left">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {this.state.showDetails ? 'Ocultar Detalhes Técnicos' : 'Ver Detalhes Técnicos'}
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleCopyDetails}
                  className="h-7 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-primary"
                >
                  {this.state.copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {this.state.copied ? 'Copiado!' : 'Copiar Diagnóstico'}
                </Button>
              </div>

              {this.state.showDetails && (
                <div className="mt-3 p-4 bg-muted/50 rounded-lg border border-border/60 text-[11px] font-mono overflow-auto max-h-48 custom-scrollbar space-y-2 text-muted-foreground">
                  <div>
                    <strong className="text-foreground font-bold">Mensagem:</strong> {sanitizedMsg}
                  </div>
                  {this.state.error?.stack && (
                    <div>
                      <strong className="text-foreground font-bold">Stack Trace:</strong>
                      <pre className="mt-1 whitespace-pre-wrap leading-relaxed opacity-80">
                        {sanitizeErrorMessage(this.state.error.stack)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
