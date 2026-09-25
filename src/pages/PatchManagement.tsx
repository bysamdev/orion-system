import React, { useMemo } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Layers, Loader2, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AgentInstallerCard } from '@/components/patch/AgentInstallerCard';
import { ForceUpdateButton } from '@/components/monitoring/ForceUpdateButton';
import { useAllMachines, useMonitoringDashboard } from '@/hooks/useMonitoring';
import { PageHeader } from '@/components/shared/PageHeader';

// Tela só do agente do Orion: gerar instalador e acompanhar a versão da frota.
// Pacotes de terceiros saíram para não guardar binários no banco.
const PatchManagement: React.FC = () => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: machines = [], isLoading: machinesLoading } = useAllMachines();
  const { data: dashboard } = useMonitoringDashboard();
  const ultima = dashboard?.latest_agent_version;

  const porVersao = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const m of machines) {
      const v = m.agent_version ?? 'desconhecida';
      contagem.set(v, (contagem.get(v) ?? 0) + 1);
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  }, [machines]);

  const desatualizadas = useMemo(
    () => (ultima ? machines.filter(m => m.agent_version !== ultima) : []),
    [machines, ultima]
  );

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!role || !['admin', 'developer', 'technician'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 space-y-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Instaladores & Updates requer privilégios de Administrador, Desenvolvedor ou Técnico.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        icon={Layers}
        badge="AGENTE ORION"
        title="Instaladores & Updates"
        description="Gere o instalador do agente por empresa e acompanhe a versão instalada nas máquinas."
        actions={<ForceUpdateButton />}
      />

      <AgentInstallerCard />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-5 space-y-4 border-border/50">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Versão mais recente</p>
            <p className="text-2xl font-bold font-mono mt-1">{ultima ? `v${ultima}` : '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Máquinas por versão</p>
            {machinesLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary/50" />
            ) : porVersao.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma máquina cadastrada.</p>
            ) : (
              <ul className="space-y-1.5">
                {porVersao.map(([versao, total]) => (
                  <li key={versao} className="flex items-center justify-between text-sm">
                    <span className="font-mono">{versao === 'desconhecida' ? versao : `v${versao}`}</span>
                    <Badge variant={versao === ultima ? 'default' : 'secondary'}>{total}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2 border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="font-bold text-sm">Máquinas desatualizadas</h2>
            <Badge variant="secondary">{desatualizadas.length}</Badge>
          </div>
          {desatualizadas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
              <p className="text-sm text-muted-foreground">Todas as máquinas estão na versão mais recente.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Último contato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {desatualizadas.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-semibold">{m.hostname}</TableCell>
                    <TableCell className="font-mono text-xs">{m.agent_version ? `v${m.agent_version}` : '—'}</TableCell>
                    <TableCell className="text-xs">{m.status === 'online' ? 'Online' : 'Offline'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {m.last_seen ? formatDistanceToNow(new Date(m.last_seen), { locale: ptBR, addSuffix: true }) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PatchManagement;
