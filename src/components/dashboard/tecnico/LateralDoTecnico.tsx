import React, { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, MousePointer2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface ChamadoFechado {
  id: string;
  ticket_number: number;
  title: string;
  requester_name: string;
}

// Carregado sob demanda: recharts só entra no bundle quando este
// widget é de fato renderizado, não no chunk padrão do dashboard.
const WorkloadChart = lazy(() => import('../WorkloadChart'));

export interface FatiaDeCarga {
  name: string;
  value: number;
  color: string;
}

// Coluna lateral: gráfico da carga do técnico e os chamados fechados há pouco.
export const LateralDoTecnico: React.FC<{ workload: FatiaDeCarga[] | null | undefined; recentClosed: ChamadoFechado[] }> = ({ workload, recentClosed }) => {
  const navigate = useNavigate();
  return (
    <div className="xl:col-span-4 space-y-8 min-w-0">
      {/* Workload Section */}
      <Card className="border-border/50 shadow-xs rounded-2xl bg-card overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center justify-between">
            Sua Carga de Trabalho
            <MousePointer2 className="w-4 h-4 opacity-40" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workload && workload.length > 0 ? (
            <Suspense fallback={<div className="h-[240px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" /></div>}>
              <WorkloadChart workload={workload} />
            </Suspense>
          ) : (
            <div className="text-center py-12 space-y-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nada pendente</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Closed (Revitalized) */}
      <section id="closed-tickets-section" className="space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-2 flex items-center justify-between">
          Fechados Recentemente
          <Clock className="w-3.5 h-3.5" />
        </h4>
        <div className="flex flex-col gap-2 h-full">
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
            {recentClosed.map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/ticket/${t.id}`)}
                className="w-full group p-3.5 rounded-2xl border border-border/40 bg-muted/15 hover:bg-primary/5 hover:border-primary/20 transition-all text-left flex items-center gap-3.5"
              >
                <div className="w-10 h-10 rounded-xl bg-background border border-border/40 flex items-center justify-center group-hover:scale-95 transition-transform">
                  <span className="text-[10px] font-mono font-bold">#{t.ticket_number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{t.title}</p>
                  <p className="text-[9px] font-medium text-muted-foreground uppercase">{t.requester_name}</p>
                </div>
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/historico')}
            className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary rounded-xl mt-2"
          >
            Ver histórico completo
          </Button>
        </div>
      </section>
    </div>
  );
};
