import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Home, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RouteLoadingFallbackProps {
  message?: string;
  timeoutSeconds?: number;
}

export const RouteLoadingFallback: React.FC<RouteLoadingFallbackProps> = ({
  message = 'Carregando página...',
  timeoutSeconds = 5,
}) => {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, timeoutSeconds * 1000);

    return () => clearTimeout(timer);
  }, [timeoutSeconds]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4 max-w-sm">
        <div className="relative">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-primary/80">
            Orion System
          </p>
          <p className="text-sm font-medium text-muted-foreground">
            {message}
          </p>
        </div>

        {isTimedOut && (
          <div className="mt-4 p-4 rounded-lg bg-muted/60 border border-border/50 text-left space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                A resposta do servidor está demorando mais do que o habitual. Verifique sua conexão ou tente recarregar.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-md text-xs font-semibold gap-1.5 h-8 border-border/60"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recarregar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 rounded-md text-xs font-semibold h-8"
                onClick={() => { window.location.href = '/'; }}
              >
                Ir para Início
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteLoadingFallback;
