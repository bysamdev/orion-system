import { useState } from 'react';
import { ShieldAlert, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { usePendingMachines, useApproveMachine, useRejectMachine } from '@/hooks/useMonitoring';
import type { PendingMachine } from '@/hooks/useMonitoring';

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// Fila de máquinas que mandaram heartbeat mas nunca foram vistas antes —
// gate criado depois de VMs de análise dinâmica (VirusTotal e scanners
// multi-engine parecidos) terem executado o orion-agent.exe de verdade e
// se auto-registrado como máquinas online no painel. Só aparece pra quem
// pode gerenciar máquinas (admin/técnico — mesmo papel checado no backend).
export function PendingMachinesBanner() {
  const { data: pending = [], isLoading } = usePendingMachines();
  const approve = useApproveMachine();
  const reject = useRejectMachine();
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  if (isLoading || pending.length === 0) return null;

  const handleApprove = async (machine: PendingMachine) => {
    setActingOnId(machine.id);
    try {
      await approve.mutateAsync(machine.id);
      toast.success(`${machine.hostname} aprovada`);
    } catch (error) {
      toast.error('Erro ao aprovar', { description: (error as Error).message });
    } finally {
      setActingOnId(null);
    }
  };

  const handleReject = async (machine: PendingMachine) => {
    setActingOnId(machine.id);
    try {
      await reject.mutateAsync(machine.id);
      toast.success(`${machine.hostname} rejeitada e removida`);
    } catch (error) {
      toast.error('Erro ao rejeitar', { description: (error as Error).message });
    } finally {
      setActingOnId(null);
    }
  };

  return (
    <Card className="mb-6 border-amber-500/30 bg-amber-500/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="w-4.5 h-4.5 text-amber-500" />
          Máquinas aguardando aprovação
          <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">
            {pending.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Nunca vistas antes neste painel. Antes de aprovar, confira se hostname/usuário fazem sentido —
          nomes genéricos tipo <code className="text-xs">DESKTOP-XXXXXXX</code> com usuário aleatório costumam ser
          VM de sandbox de antivírus, não máquina real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((machine) => (
          <div
            key={machine.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{machine.hostname}</span>
                {machine.current_user && (
                  <span className="text-sm text-muted-foreground">· {machine.current_user}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {machine.ip_address || 'sem IP'} · {machine.domain || 'sem domínio'} · {machine.os || 'SO desconhecido'} ·
                {' '}visto {formatDate(machine.created_at)}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                disabled={actingOnId === machine.id}
                onClick={() => handleReject(machine)}
              >
                {actingOnId === machine.id && reject.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                Rejeitar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={actingOnId === machine.id}
                onClick={() => handleApprove(machine)}
              >
                {actingOnId === machine.id && approve.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Aprovar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
