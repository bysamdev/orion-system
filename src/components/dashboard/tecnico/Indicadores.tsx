import React from 'react';
import { PlayCircle, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatCard } from './StatCard';

export interface NumerosDoTecnico {
  inProgress?: number;
  slaAtRisk?: number;
  pending?: number;
  resolvedToday?: number;
}

export type Indicador = 'in-progress' | 'sla' | 'pending' | 'resolved';

interface IndicadoresProps {
  stats: NumerosDoTecnico | null | undefined;
  kpiFilter: string | null;
  closedOpen: boolean;
  onSelecionar: (indicador: Indicador) => void;
}

// Os quatro cartões de números do topo. Clicar num deles filtra a lista.
export const Indicadores: React.FC<IndicadoresProps> = ({ stats, kpiFilter, closedOpen, onSelecionar }) => {
  const cartoes = [
    { id: 'in-progress' as const, title: 'Em Atendimento', value: stats?.inProgress || 0, description: 'Chamados em atendimento ativo', icon: PlayCircle, variant: 'info' as const, active: kpiFilter === 'in-progress' },
    { id: 'sla' as const, title: 'SLA Crítico', value: stats?.slaAtRisk || 0, description: 'Chamados com prazo vencido', icon: AlertTriangle, variant: (stats?.slaAtRisk || 0) > 0 ? 'danger' as const : 'default' as const, active: kpiFilter === 'sla' },
    { id: 'pending' as const, title: 'Minha Fila', value: stats?.pending || 0, description: 'Chamados pendentes na sua fila', icon: Clock, variant: 'warning' as const, active: kpiFilter === 'pending' },
    { id: 'resolved' as const, title: 'Resolvidos Hoje', value: stats?.resolvedToday || 0, description: 'Chamados concluídos hoje', icon: CheckCircle2, variant: 'success' as const, active: closedOpen },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cartoes.map(c => (
        <Tooltip key={c.id}>
          <TooltipTrigger asChild>
            <div className="w-full h-full">
              <StatCard
                title={c.title}
                value={c.value}
                description={c.description}
                icon={c.icon}
                variant={c.variant}
                active={c.active}
                onClick={() => onSelecionar(c.id)}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            <p>{c.description}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};
