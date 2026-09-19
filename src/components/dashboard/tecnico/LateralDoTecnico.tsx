import React, { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
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
    <div className="2xl:col-span-4 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-1 gap-6 items-start min-w-0">
      {/* Workload Section */}
      <Card className="border-border/50 rounded-xl bg-card overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Sua Carga de Trabalho
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
              <p className="text-sm text-muted-foreground">Nada pendente</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Closed (Revitalized) */}
      <section id="closed-tickets-section" className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground px-1 flex items-center justify-between">
          Fechados Recentemente
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        </h4>
        <div className="flex flex-col gap-2 h-full">
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
            {recentClosed.map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/ticket/${t.id}`)}
                className="w-full group p-3 rounded-xl border border-border/40 bg-card hover:bg-muted/40 transition-colors text-left flex items-center gap-3"
              >
                <div className="w-12 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-mono text-muted-foreground">#{t.ticket_number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.requester_name}</p>
                </div>
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/historico')}
            className="w-full text-xs font-medium text-muted-foreground hover:text-primary rounded-lg mt-1"
          >
            Ver histórico completo
          </Button>
        </div>
      </section>
    </div>
  );
};
