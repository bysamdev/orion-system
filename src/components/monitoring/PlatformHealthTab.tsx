import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Activity, Server, Monitor, Laptop, HelpCircle, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePlatformHealth } from '@/hooks/useMonitoring';

const deviceTypeLabel: Record<string, string> = {
  desktop: 'Computadores',
  notebook: 'Notebooks',
  server: 'Servidores',
  unknown: 'Não identificados',
};

const deviceTypeIcon: Record<string, React.ElementType> = {
  desktop: Monitor,
  notebook: Laptop,
  server: Server,
  unknown: HelpCircle,
};

function StatTile({ label, value, icon: Icon, tone = 'default' }: { label: string; value: React.ReactNode; icon: React.ElementType; tone?: 'default' | 'warning' | 'critical' | 'good' }) {
  const toneClasses: Record<string, string> = {
    default: 'text-foreground border-border/40',
    warning: 'text-amber-500 border-amber-500/20 bg-amber-500/5',
    critical: 'text-red-500 border-red-500/20 bg-red-500/5',
    good: 'text-green-500 border-green-500/20 bg-green-500/5',
  };
  return (
    <Card className={`p-4 flex items-center gap-3 rounded-xl border ${toneClasses[tone]}`}>
      <div className="p-2.5 rounded-xl bg-background/60 border border-current/20">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      </div>
    </Card>
  );
}

// PlatformHealthTab — Fase 10 do plano de escalabilidade: visão agregada
// cross-tenant da frota, para quem opera a plataforma (não é dado de um
// cliente específico). O backend (monitoringPlatformHealth) já restringe a
// escopo.Global() — aqui só refletimos um 403 como "acesso restrito" em vez
// de deixar a query re-tentando ou quebrando a tela.
export default function PlatformHealthTab() {
  const { data, isLoading, error } = usePlatformHealth();

  if (error) {
    return (
      <div className="bg-muted/40 border border-border/40 rounded-2xl p-8 text-center space-y-2">
        <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">Acesso restrito</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          A saúde da plataforma é uma visão operacional cross-cliente, disponível só para
          administradores globais (master/developer).
        </p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  const oldestPendingLabel = data.oldest_pending_command_age_seconds != null
    ? formatDistanceToNow(Date.now() - data.oldest_pending_command_age_seconds * 1000, { locale: ptBR })
    : '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Máquinas — Total" value={data.machines_total} icon={Activity} />
        <StatTile label="Online" value={data.machines_online} icon={Activity} tone="good" />
        <StatTile label="Offline" value={data.machines_offline} icon={Activity} tone={data.machines_offline > 0 ? 'warning' : 'default'} />
        <StatTile label="Em Alerta" value={data.machines_alerta} icon={AlertTriangle} tone={data.machines_alerta > 0 ? 'critical' : 'default'} />
        <StatTile label="Alertas Abertos" value={data.alerts_open} icon={ShieldAlert} tone={data.alerts_open > 0 ? 'critical' : 'good'} />
        <StatTile
          label="Comandos RMM Pendentes"
          value={data.commands_pending}
          icon={Clock}
          tone={data.commands_pending > 20 ? 'warning' : 'default'}
        />
      </div>

      {data.commands_pending > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          Comando pendente mais antigo: <strong className="text-foreground">{oldestPendingLabel}</strong> na fila —
          um backlog crescente costuma indicar que agentes não estão fazendo polling (ver latência de heartbeat).
        </p>
      )}

      <div className="space-y-3">
        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Frota por Tipo de Dispositivo</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.machines_by_device_type).map(([type, count]) => {
            const Icon = deviceTypeIcon[type] || HelpCircle;
            return (
              <Card key={type} className="p-3 flex flex-col items-center gap-1.5 rounded-xl border-border/40">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-lg font-black">{count}</span>
                <span className="text-[9px] font-bold uppercase text-muted-foreground text-center">
                  {deviceTypeLabel[type] || type}
                </span>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <Badge variant="outline" className="text-[9px] font-bold">
          {data.rate_limit_active_buckets} bucket(s) de rate limit ativos no último minuto
        </Badge>
      </div>

      <p className="text-[10px] text-muted-foreground px-1 italic">
        Esta visão cobre só o que já é coletado hoje — CPU/RAM da API e do banco, séries de latência
        e IOPS precisam ser medidas do lado da infraestrutura (ver ESCALABILIDADE.md).
      </p>
    </div>
  );
}
